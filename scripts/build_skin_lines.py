#!/usr/bin/env python3
"""Build reusable skin-line WebPs from the actual 24 Loot Hub neutral masters."""
import argparse,base64,hashlib,io,json,math,random,re,shutil
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
    colors={'crimson':('#190608','#e22c44'),'kryptonite':('#071611','#129f57'),
            'bloom':('#30181b','#e8b7ad')}
    if line['type'] not in colors: raise ValueError('Unknown pattern type '+line['type'])
    gradient=line.get('palette') or colors[line['type']]
    if len(gradient)!=2: raise ValueError('Skin palette needs shadow and highlight colors')
    paint=ImageOps.colorize(ImageOps.grayscale(source),*gradient).convert('RGBA')
    paint.putalpha(source.getchannel('A'))
    result=Image.composite(paint,source,mask)
    result.putalpha(source.getchannel('A'))
    return result
def pattern(size,kind,seed):
    rng=random.Random(int(hashlib.sha256(seed.encode()).hexdigest()[:16],16))
    w,h=size;s=w/1600
    im=Image.new('RGBA',size,(0,0,0,0));d=ImageDraw.Draw(im,'RGBA')
    if kind=='crimson':
        for _ in range(44):
            x,y=rng.randrange(w),rng.randrange(int(.28*h),int(.82*h))
            radius=rng.randrange(max(6,round(13*s)),max(10,round(35*s)))
            direction=rng.choice((-1,1))
            start,end=(20,300) if direction>0 else (185,470)
            d.arc((x-radius,y-radius,x+radius,y+radius),start,end,
                  fill=(220,226,230,rng.randrange(85,155)),width=max(1,round(2*s)))
            d.line((x,y,x+direction*radius,y-radius//2),fill=(236,236,239,118),width=max(1,round(s)))
    elif kind=='kryptonite':
        for _ in range(22):
            x,y=rng.randrange(w),rng.randrange(int(.2*h),int(.8*h))
            pts=[(x,y)]
            for _ in range(rng.randrange(4,10)):
                x+=rng.randint(-26,42)*s;y+=rng.randint(-30,30)*s
                pts.append((int(x),int(y)))
            d.line(pts,fill=(13,255,112,72),width=max(3,round(7*s)),joint='curve')
            d.line(pts,fill=(138,255,177,207),width=max(1,round(2*s)),joint='curve')
    elif kind=='bloom':
        for _ in range(84):
            x,y=rng.randrange(w),rng.randrange(int(.17*h),int(.86*h))
            r=rng.randrange(max(3,round(4*s)),max(6,round(10*s)))
            d.line((x-2*r,y+r,x+r,y-r),fill=(115,67,65,118),width=max(1,round(2*s)))
            for k in range(5):
                angle=k*2*math.pi/5+.21
                px=x+math.cos(angle)*r;py=y+math.sin(angle)*r
                d.ellipse((px-r*.52,py-r*.52,px+r*.52,py+r*.52),fill=(255,201,215,166))
            d.ellipse((x-r*.32,y-r*.32,x+r*.32,y+r*.32),fill=(250,219,137,214))
    return im
def target(line,slug,width):
    return ROOT/'assets/renders/lines'/line/f'{slug}--{line}-{width}.webp'
def sources():
    manifest=json.loads((ROOT/'assets/manifest.json').read_text())
    definitions=json.loads((ROOT/'assets/skin-lines/lines.json').read_text())
    profiles=json.loads((ROOT/'assets/skin-lines/paint-profiles.json').read_text())['weapons']
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
        mask=paint_mask(source,profiles[slug])
        path=ROOT/'assets/skin-lines/masks'/f'{slug}--paint-main-1600.png'
        path.parent.mkdir(parents=True,exist_ok=True);mask.save(path,optimize=True)
        for line in defs['lines']:
            if not line['released']:continue
            out=recolor(source,mask,line)
            marks=pattern(source.size,line['type'],slug+':'+line['id'])
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
if __name__=='__main__':
    cli=argparse.ArgumentParser();cli.add_argument('--check',action='store_true')
    args=cli.parse_args()
    count=verify() if args.check else build()
    print(('Validated' if args.check else 'Generated'),count,'transparent skin-line images')
