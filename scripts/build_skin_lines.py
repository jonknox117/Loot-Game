#!/usr/bin/env python3
"""Build reusable skin-line WebPs from the actual 24 Loot Hub neutral masters."""
import argparse,base64,io,json,re,shutil
from pathlib import Path
from PIL import Image,ImageChops,ImageDraw,ImageOps
ROOT=Path(__file__).resolve().parents[1]
SIZES=(400,800,1600)
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

def target(line,slug,width):
    return ROOT/'assets/renders/lines'/line/f'{slug}--{line}-{width}.webp'
def sources():
    manifest=json.loads((ROOT/'assets/manifest.json').read_text())
    definitions=json.loads((ROOT/'assets/skin-lines/lines.json').read_text())
    profiles=json.loads((ROOT/'assets/skin-lines/paint-profiles.json').read_text())['weapons']
    if definitions.get('schemaVersion')!=1:raise ValueError('Unexpected skin line schema')
    ids=set()
    for line in definitions['lines']:
        if not isinstance(line.get('id'),str) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',line['id']):
            raise ValueError('Invalid skin-line id')
        if line['id'] in ids:raise ValueError('Duplicate skin line id')
        ids.add(line['id'])
        if line.get('released'):
            if not line.get('name') or not isinstance(line.get('palette'),list) or len(line['palette'])!=2:
                raise ValueError('Released lines need a name and two-color palette')
    return manifest['items'],definitions,profiles
def build():
    items,defs,profiles=sources()
    if len(items)!=24 or len(profiles)!=24:raise ValueError('24 profiles and 24 weapon masters required')
    (ROOT/'assets/skin-lines/line-data.js').write_text(
        '/* Generated from lines.json; do not edit. */\nwindow.LootHubSkinLineData = Object.freeze('+
        json.dumps(defs,separators=(',',':'))+');\n',encoding='utf-8')
    # Remove stale generated line folders only; owner-made custom art is elsewhere.
    destination=ROOT/'assets/renders/lines'
    allowed={v['id'] for v in defs['lines'] if v['released']}
    if destination.exists():
        for stale in destination.iterdir():
            if stale.is_dir() and stale.name not in allowed:shutil.rmtree(stale)
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
            if not line['released']:continue
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
    valid_ids={line['id'] for line in defs['lines'] if line.get('released')}
    for file in (ROOT/'assets/renders/lines').glob('**/*.webp'):
        if file.parent.name not in valid_ids:raise AssertionError('Unregistered artwork: '+str(file))
    for item in items:
        slug=item.get('modelSlug') or item['id'].removesuffix('--base')
        if item['renderMode']=='transparent-webp-data-uri':
            for size in SIZES:
                image=Image.open(ROOT/'assets/renders/masters'/f'{slug}-neutral-{size}.webp').convert('RGBA')
                if image.size!=neutral(item,size).size or ImageChops.difference(image.getchannel('A'),neutral(item,size).getchannel('A')).getbbox():
                    raise AssertionError('Standalone master failed silhouette verification: '+slug)
        for line in defs['lines']:
            if not line['released']:continue
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
    return 'Generic recipe self-test passed'

if __name__=='__main__':
    cli=argparse.ArgumentParser();cli.add_argument('--check',action='store_true')
    cli.add_argument('--self-test',action='store_true')
    args=cli.parse_args()
    if args.self_test:print(self_test())
    else:
        count=verify() if args.check else build()
        print(('Validated' if args.check else 'Generated'),count,'transparent skin-line images')
