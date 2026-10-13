#!/usr/bin/env python3
"""Build reusable skin-line WebPs from the approved Loot Hub neutral masters."""
import argparse,base64,io,json,re,shutil
from pathlib import Path
from PIL import Image,ImageChops,ImageDraw,ImageOps
ROOT=Path(__file__).resolve().parents[1]
SIZES=(400,800,1600)
MATERIALS=('metal','wood','other')
MATERIAL_CHANNEL={'metal':'R','wood':'G','other':'B'}
# These user-approved curated case renders are not procedural skin-line output.
# Never delete or reject them while rebuilding retired/generated finish folders.
# Only folders from previously retired procedural lines may be cleaned.
# Unknown folders may be newly staged owner-approved curated case art; never
# delete them simply because the procedural line registry does not name them.
RETIRED_PROCEDURAL_FOLDERS=frozenset({'blackout','damascus'})
Image.MAX_IMAGE_PIXELS=16000000
def fit_canvas(image,width):
    # Source dimensions differ between older neutral masters. Center without
    # cropping, stretching or changing the original weapon silhouette.
    target=(width,width//2)
    if image.size==target:return image
    factor=min(target[0]/image.width,target[1]/image.height)
    w,h=max(1,round(image.width*factor)),max(1,round(image.height*factor))
    framed=Image.new('RGBA',target,(0,0,0,0))
    framed.alpha_composite(image.resize((w,h),Image.Resampling.LANCZOS),((target[0]-w)//2,(target[1]-h)//2))
    return framed
def neutral(item,width):
    path=ROOT/item['master']
    if item['renderMode']=='transparent-webp-file':
        raw=Image.open(str(path).replace('-1600.webp',f'-{width}.webp')).convert('RGBA')
    else:
        s=path.read_text('utf-8')
        match=re.search(r'"400":"([A-Za-z0-9+/=]+)","800":"([A-Za-z0-9+/=]+)","1600":"([A-Za-z0-9+/=]+)"',s)
        if not match: raise ValueError('Incomplete native WebP master: '+str(path))
        raw=Image.open(io.BytesIO(base64.b64decode(match[{400:1,800:2,1600:3}[width]]))).convert('RGBA')
    return fit_canvas(raw,width)
def paint_mask(image,profile):
    alpha=image.getchannel('A')
    threshold=int(profile.get('protectDarkBelow',16))
    shade=ImageOps.grayscale(image).point(lambda x:max(0,min(255,(x-threshold)*5)))
    mask=ImageChops.multiply(shade,alpha)
    draw=ImageDraw.Draw(mask)
    for coords in profile.get('protectedRects',[]):
        if len(coords)!=4 or not all(0<=n<=1 for n in coords): raise ValueError('Invalid protected rectangle')
        draw.rectangle(tuple(round(n*image.size[i%2]) for i,n in enumerate(coords)),fill=0)
    return mask
def recolor(source,mask,line):
    """Apply user-defined material palette, retaining source shadows and silhouette."""
    palette=line['palette']
    if not isinstance(palette,list) or len(palette)!=2:
        raise ValueError('Expected two-color palette: shadow and highlight')
    paint=ImageOps.colorize(ImageOps.grayscale(source),*palette).convert('RGBA')
    paint.putalpha(source.getchannel('A'))
    result=Image.composite(paint,source,mask)
    result.putalpha(source.getchannel('A'))
    return result

def pattern(size,line):
    """Repeat an artist-provided transparent texture. Never invent decorative art."""
    spec=line.get('pattern')
    output=Image.new('RGBA',size,(0,0,0,0))
    if not spec:return output
    path=spec.get('texture')
    if not isinstance(path,str) or not path.startswith('assets/skin-lines/textures/'):
        raise ValueError('Pattern texture must live in assets/skin-lines/textures/')
    texture_path=(ROOT/path).resolve()
    if not texture_path.is_relative_to((ROOT/'assets/skin-lines/textures').resolve()):
        raise ValueError('Texture path escapes asset directory')
    source=Image.open(texture_path).convert('RGBA')
    tile_width=int(spec.get('tileWidth',384))
    if not 24<=tile_width<=1600:raise ValueError('Tile width must be 24–1600')
    tile_height=max(1,round(source.height*tile_width/source.width))
    tile=source.resize((tile_width,tile_height),Image.Resampling.LANCZOS)
    offset_x=int(spec.get('offsetX',0))%tile_width
    offset_y=int(spec.get('offsetY',0))%tile_height
    for y in range(offset_y-tile_height,size[1],tile_height):
        for x in range(offset_x-tile_width,size[0],tile_width):
            output.alpha_composite(tile,(x,y))
    opacity=float(spec.get('opacity',1))
    if not 0<=opacity<=1:raise ValueError('Pattern opacity must be 0–1')
    output.putalpha(output.getchannel('A').point(lambda v:round(v*opacity)))
    return output


def material_pattern_definition(line):
    """An opt-in, single texture per material map. Legacy pattern remains supported."""
    materials=line.get('materials')
    if materials is None:
        return None
    if 'pattern' in line:
        raise ValueError('Use either legacy pattern or materials, not both')
    if not isinstance(materials,dict) or set(materials)!=set(MATERIALS):
        raise ValueError('Material skin lines require metal, wood and other entries')
    for kind in MATERIALS:
        spec=materials[kind]
        if not isinstance(spec,dict) or not isinstance(spec.get('texture'),str):
            raise ValueError('Missing texture for '+kind)
        validate_pattern_spec(spec)
    return materials

def validate_pattern_spec(spec,check_file=False):
    path=spec.get('texture')
    if not isinstance(path,str) or not path.startswith('assets/skin-lines/textures/'):
        raise ValueError('Texture must live in assets/skin-lines/textures/')
    root=(ROOT/'assets/skin-lines/textures').resolve()
    texture=(ROOT/path).resolve()
    if not texture.is_relative_to(root):
        raise ValueError('Texture path escapes the trusted asset directory')
    if texture.suffix.lower() not in ('.png','.webp'):
        raise ValueError('Texture must be PNG or WebP')
    if check_file and not texture.is_file():
        raise FileNotFoundError('Missing approved pattern: '+str(texture))
    tile_width=spec.get('tileWidth',384)
    if type(tile_width) is not int or not 24<=tile_width<=1600:
        raise ValueError('Tile width must be an integer in 24..1600')
    for key in ('offsetX','offsetY'):
        if type(spec.get(key,0)) is not int:
            raise ValueError(key+' must be an integer')
    opacity=spec.get('opacity',1)
    if type(opacity) not in (float,int) or not 0<=opacity<=1:
        raise ValueError('Opacity must be in 0..1')
    return texture

def validated_material_channels(source,material):
    """Strict map validation: same alpha, exactly one RGB 255 material per visible pixel."""
    if material.size!=source.size:
        raise ValueError('Material map must match normalized 1600x800 master')
    alpha=source.getchannel('A')
    if material.getchannel('A').tobytes()!=alpha.tobytes():
        raise ValueError('Material map alpha does not match master silhouette')
    channels={key:material.getchannel(value) for key,value in MATERIAL_CHANNEL.items()}
    aa=alpha.tobytes()
    rr,gg,bb=(channels[k].tobytes() for k in MATERIALS)
    for i,a in enumerate(aa):
        expected=1 if a else 0
        valid=(rr[i]==255 and gg[i]==0 and bb[i]==0,
               rr[i]==0 and gg[i]==255 and bb[i]==0,
               rr[i]==0 and gg[i]==0 and bb[i]==255)
        if sum(valid)!=expected:
            raise ValueError(f'Unclassified or overlapping material map pixel {i}')
    return channels

def protected_material_mask(size,profile):
    """Material finish exclusion independent of paint-main; keeps screws/sights safe."""
    blocked=Image.new('L',size,0)
    draw=ImageDraw.Draw(blocked)
    regions=profile.get('protectedRects',[])+profile.get('wear',{}).get('protectedRects',[])
    for rect in regions:
        if not isinstance(rect,list) or len(rect)!=4 or not all(
            type(x) in (int,float) and 0<=x<=1 for x in rect):
            raise ValueError('Invalid protected material rectangle')
        if rect[0]>rect[2] or rect[1]>rect[3]:
            raise ValueError('Inverted protected rectangle')
        draw.rectangle((round(rect[0]*size[0]),round(rect[1]*size[1]),
                        round(rect[2]*size[0]),round(rect[3]*size[1])),fill=255)
    return ImageOps.invert(blocked)

def material_finish(source,material_map,line,profile=None,loader=pattern):
    """Overlay each material texture only onto pixels classified for that material.
    Preserve exact weapon alpha. Legacy paint mask and named custom art are untouched."""
    materials=material_pattern_definition(line)
    if materials is None:
        raise ValueError('No material textures specified')
    channels=validated_material_channels(source,material_map)
    allowed=protected_material_mask(source.size,profile or {})
    alpha=source.getchannel('A')
    # Multiply texture RGB by a subtle shared shading map. Preserve source lighting
    # without replacing the uploaded artist's vivid base color with a grey palette.
    luminosity=ImageOps.grayscale(source).point(lambda value:round(205+50*value/255))
    output=source.copy()
    for kind in MATERIALS:
        tile=loader(source.size,{'pattern':materials[kind]})
        shade=Image.merge('RGB',(luminosity,luminosity,luminosity))
        textured=ImageChops.multiply(tile.convert('RGB'),shade).convert('RGBA')
        coverage=ImageChops.multiply(tile.getchannel('A'),channels[kind])
        coverage=ImageChops.multiply(coverage,allowed)
        coverage=ImageChops.multiply(coverage,alpha)
        output=Image.composite(textured,output,coverage)
    output.putalpha(alpha)
    return output

def target(line,slug,width):
    return ROOT/'assets/renders/lines'/line/f'{slug}--{line}-{width}.webp'
def sources():
    manifest=json.loads((ROOT/'assets/manifest.json').read_text())
    definitions=json.loads((ROOT/'assets/skin-lines/lines.json').read_text())
    profiles=json.loads((ROOT/'assets/skin-lines/paint-profiles.json').read_text())['weapons']
    if definitions.get('schemaVersion')!=1:raise ValueError('Unexpected skin line schema')
    if definitions.get('lines'):
        raise ValueError('Procedural skin lines are disabled; material maps are for wear only')
    ids=set()
    for line in definitions['lines']:
        if not isinstance(line.get('id'),str) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',line['id']):
            raise ValueError('Invalid skin-line id')
        if line['id'] in ids:raise ValueError('Duplicate skin line id')
        ids.add(line['id'])
        if line.get('released') or line.get('preview'):
            palette=line.get('palette')
            if not line.get('name') or (line.get('materials') is None and
                (not isinstance(palette,list) or len(palette)!=2)):
                raise ValueError('Released lines need a name and either material patterns or a two-color palette')
    known_weapons={item['weapon'] for item in manifest['items']}
    for line in definitions['lines']:
        allowed=line.get('weapons')
        if allowed is not None and (
            not isinstance(allowed,list) or not allowed or
            len(allowed)!=len(set(allowed)) or not set(allowed).issubset(known_weapons)):
            raise ValueError('Line weapons must be unique approved weapon names')
        if line.get('preview') and line.get('released'):
            raise ValueError('Preview must not also be released')
    for line in definitions['lines']:
        materials=material_pattern_definition(line)
        if line.get('released') or line.get('preview'):
            if materials:
                for kind in MATERIALS:
                    validate_pattern_spec(materials[kind],check_file=True)
            elif line.get('pattern'):
                validate_pattern_spec(line['pattern'],check_file=True)
    return manifest['items'],definitions,profiles
def build():
    items,defs,profiles=sources()
    slugs=[item.get('modelSlug') or item['id'].removesuffix('--base') for item in items]
    if not slugs or len(set(slugs))!=len(slugs) or set(slugs)!=set(profiles):
        raise ValueError('Each unique weapon master must have exactly one material profile')
    (ROOT/'assets/skin-lines/line-data.js').write_text(
        '/* Generated from lines.json; do not edit. */\nwindow.LootHubSkinLineData = Object.freeze('+
        json.dumps(defs,separators=(',',':'))+');\n',encoding='utf-8')
    # Custom owner-provided case assets can live alongside procedural exports.
    # Remove only the explicitly retired old procedural folders.
    destination=ROOT/'assets/renders/lines'
    allowed={v['id'] for v in defs['lines'] if v.get('released') or v.get('preview')}
    if destination.exists():
        for stale in destination.iterdir():
            if (stale.is_dir() and stale.name in RETIRED_PROCEDURAL_FOLDERS
                    and stale.name not in allowed):
                shutil.rmtree(stale)
    count=0
    for item in items:
        slug=item.get('modelSlug') or item['id'].removesuffix('--base')
        source=neutral(item,1600)
        if source.size!=(1600,800):raise ValueError('Unexpected master dimensions for '+slug)
        if item['renderMode']=='transparent-webp-data-uri':
            # Extract source WebPs to normal static files once; preserve original JS
            # master as provenance and use its exact alpha for line exports.
            for width in SIZES:
                master_file=ROOT/'assets/renders/masters'/f'{slug}-neutral-{width}.webp'
                master_file.parent.mkdir(parents=True,exist_ok=True)
                neutral(item,width).save(master_file,'WEBP',quality=94,method=4,exact=True,alpha_quality=100)
        path=ROOT/'assets/skin-lines/masks'/f'{slug}--paint-main-1600.png'
        if path.is_file():
            mask=Image.open(path).convert('L')
            if mask.size!=source.size:raise ValueError('Existing mask has wrong dimensions: '+str(path))
        else:
            mask=paint_mask(source,profiles[slug])
            path.parent.mkdir(parents=True,exist_ok=True)
            mask.save(path,optimize=True)
        for line in defs['lines']:
            if not (line.get('released') or line.get('preview')):continue
            if line.get('weapons') is not None and item['weapon'] not in line['weapons']:continue
            if line.get('materials') is not None:
                material_path=ROOT/'assets/skin-lines/materials'/f'{slug}--material-1600.png'
                if not material_path.is_file():
                    raise FileNotFoundError('Material map missing: '+str(material_path))
                material=Image.open(material_path).convert('RGBA')
                out=material_finish(source,material,line,profiles[slug])
            else:
                out=recolor(source,mask,line)
                marks=pattern(source.size,line)
                marks.putalpha(ImageChops.multiply(marks.getchannel('A'),mask))
                out=Image.alpha_composite(out,marks);out.putalpha(source.getchannel('A'))
            for size in SIZES:
                base=neutral(item,size)
                image=out.resize(base.size,Image.Resampling.LANCZOS)
                image.putalpha(base.getchannel('A'))
                dest=target(line['id'],slug,size)
                dest.parent.mkdir(parents=True,exist_ok=True)
                image.save(dest,'WEBP',quality=94,method=4,exact=True,alpha_quality=100)
                count+=1
    return count
def verify():
    items,defs,_=sources();count=0
    # Procedural verification owns procedural exports only. Curated-case
    # originals are validated by tests/case-registry.cjs instead.
    for file in (ROOT/'assets/renders/lines').glob('**/*.webp'):
        if file.parent.name in RETIRED_PROCEDURAL_FOLDERS:
            raise AssertionError('Retired procedural artwork must not ship: '+str(file))
    for item in items:
        slug=item.get('modelSlug') or item['id'].removesuffix('--base')
        if item['renderMode']=='transparent-webp-data-uri':
            for size in SIZES:
                image=Image.open(ROOT/'assets/renders/masters'/f'{slug}-neutral-{size}.webp').convert('RGBA')
                if image.size!=neutral(item,size).size or ImageChops.difference(image.getchannel('A'),neutral(item,size).getchannel('A')).getbbox():
                    raise AssertionError('Standalone master failed silhouette verification: '+slug)
        for line in defs['lines']:
            if not (line.get('released') or line.get('preview')):continue
            if line.get('weapons') is not None and item['weapon'] not in line['weapons']:continue
            for size in SIZES:
                base=neutral(item,size);path=target(line['id'],slug,size)
                if not path.is_file():raise FileNotFoundError(str(path))
                image=Image.open(path).convert('RGBA')
                if image.size!=base.size or ImageChops.difference(
                    image.getchannel('A'),base.getchannel('A')).getbbox():
                    raise AssertionError('Master silhouette changed: '+str(path))
                if image.getchannel('A').getextrema()!=(0,255):
                    raise AssertionError('Image has no proper transparent background: '+str(path))
                count+=1
    return count
def self_test():
    # No published line or files needed: validate user-supplied recipe machinery.
    original=Image.new('RGBA',(160,80),(40,55,60,0))
    ImageDraw.Draw(original).rectangle((20,20,140,60),fill=(100,110,120,255))
    alpha=original.getchannel('A')
    mask=alpha.copy()
    colored=recolor(original,mask,{'palette':['#14191e','#f4cc66']})
    assert ImageChops.difference(colored.getchannel('A'),alpha).getbbox() is None
    assert colored.getpixel((40,40))!=original.getpixel((40,40))
    assert pattern((160,80),{'pattern':None}).getchannel('A').getextrema()==(0,0)
    # Synthetic test, no image generation or source weapon modification:
    # one red/green/blue map region uses precisely its own texture.
    surface=Image.new('RGBA',(9,3),(255,255,255,255))
    surface.putpixel((0,0),(255,255,255,0))
    mapped=Image.new('RGBA',surface.size,(0,0,255,255))
    for x in range(9):
        label=(255,0,0,255) if x<3 else ((0,255,0,255) if x<6 else (0,0,255,255))
        for y in range(3):mapped.putpixel((x,y),label)
    mapped.putpixel((0,0),(0,0,0,0))
    entries={key:{'texture':'assets/skin-lines/textures/'+key+'.png'} for key in MATERIALS}
    shades={'metal':(254,0,0,255),'wood':(0,254,0,255),'other':(0,0,254,255)}
    def mock_tile(size,spec):
        kind=Path(spec['pattern']['texture']).stem
        return Image.new('RGBA',size,shades[kind])
    out=material_finish(surface,mapped,{'materials':entries},loader=mock_tile)
    assert out.getchannel('A').tobytes()==surface.getchannel('A').tobytes()
    assert out.getpixel((1,1))[:3]==(254,0,0)
    assert out.getpixel((4,1))[:3]==(0,254,0)
    assert out.getpixel((7,1))[:3]==(0,0,254)
    assert out.getpixel((0,0))[3]==0
    protected={'protectedRects':[[.3,0,.4,1]]}
    safe=material_finish(surface,mapped,{'materials':entries},protected,loader=mock_tile)
    assert safe.getpixel((3,1))[:3]==(255,255,255),'Protected detail was painted'
    bad=mapped.copy();bad.putpixel((4,1),(255,255,0,255))
    try:
        material_finish(surface,bad,{'materials':entries},loader=mock_tile)
    except ValueError:pass
    else:raise AssertionError('Overlapping material regions were accepted')
    try:
        material_pattern_definition({'materials':{'metal':entries['metal']}})
    except ValueError:pass
    else:raise AssertionError('Incomplete 3-material recipe was accepted')
    return 'Legacy palette and three independently masked material textures passed'

if __name__=='__main__':
    cli=argparse.ArgumentParser();cli.add_argument('--check',action='store_true')
    cli.add_argument('--self-test',action='store_true')
    args=cli.parse_args()
    if args.self_test:print(self_test())
    else:
        count=verify() if args.check else build()
        print(('Validated' if args.check else 'Generated'),count,'transparent skin-line images')
