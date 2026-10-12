#!/usr/bin/env python3
"""LootHub M4A4 2D master prototype, extracted from original generated artwork.

Requires Pillow, numpy and OpenCV. Uses one exact RGBA silhouette for both
neutral and Voltage Bloom. Standalone model source *region* is 1110 px wide
and is upsampled for 2400px editing; this is not native CAD-quality art.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import numpy as np, cv2, math, random, json, argparse
ROOT=Path(__file__).resolve().parent
SRC=ROOT/'source/m4a4-reference-contact.png'
CANVAS=(2400,1200)

def polygon_mask(sz,points):
    layer=Image.new('L',sz,0);ImageDraw.Draw(layer).polygon(points,fill=255);return layer

def extract():
    orig=Image.open(SRC).convert('RGB')
    arr=np.asarray(orig)[0:354,270:1435].copy()
    h,w=arr.shape[:2]
    # Strict envelope excludes labels, separator and all other guns in reference image.
    domain=Image.new('L',(w,h),0)
    d=ImageDraw.Draw(domain)
    d.rectangle((44,12,1164,265),fill=255)
    d.polygon([(532,150),(657,152),(620,351),(505,335)], fill=255)
    d.polygon([(722,166),(804,175),(855,292),(783,322)],fill=255)
    # Unwanted lower row silhouettes never enter the alpha envelope.
    region=np.asarray(domain)
    gray=cv2.cvtColor(arr,cv2.COLOR_RGB2GRAY)
    gc=np.zeros((h,w),dtype=np.uint8)
    gc[region>0]=cv2.GC_PR_BGD
    strong=(gray>80)&(region>0)
    likely=(gray>32)&(region>0)
    gc[strong]=cv2.GC_FGD
    gc[likely&(~strong)]=cv2.GC_PR_FGD
    # guaranteed bg around cropped canvas edge; background is close to black.
    gc[0:5,:]=cv2.GC_BGD
    gc[:,-2:]=cv2.GC_BGD
    bg=np.zeros((1,65),dtype=np.float64);fg=bg.copy()
    cv2.grabCut(cv2.cvtColor(arr,cv2.COLOR_RGB2BGR),gc,None,bg,fg,7,cv2.GC_INIT_WITH_MASK)
    bits=np.isin(gc,(cv2.GC_FGD,cv2.GC_PR_FGD)).astype(np.uint8)*255
    # Remove incidental small glossy noise and colored components.
    n,labels,stats,cent=cv2.connectedComponentsWithStats(bits,8)
    clean=np.zeros_like(bits)
    for k in range(1,n):
        if stats[k,cv2.CC_STAT_AREA]>=38:
            clean[labels==k]=255
    # Subtle edge anti-aliasing, not blur of object itself.
    clean=cv2.GaussianBlur(clean,(3,3),0.53)
    rgba=Image.fromarray(np.dstack((arr,clean)),'RGBA')
    # Rotate full image so barrel faces RIGHT, as required by rest of Arsenal.
    rgba=rgba.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    # Produce canonical 2400x1200 working canvas, consistent presentation.
    bounds=rgba.getbbox();rgba=rgba.crop(bounds)
    scale=min(2150/rgba.width,780/rgba.height)
    render=rgba.resize((round(rgba.width*scale),round(rgba.height*scale)),Image.Resampling.LANCZOS)
    canvas=Image.new('RGBA',CANVAS,(0,0,0,0))
    # vertical positioning favors visible magazine/grip below the horizontal axis
    p=((CANVAS[0]-render.width)//2,(CANVAS[1]-render.height)//2-20)
    canvas.alpha_composite(render,p)
    canvas.save(ROOT/'source/m4a4-neutral-master-2400.png',optimize=True)
    return canvas

def mask_region(base,name,pts):
    shape=polygon_mask(CANVAS,pts)
    shape=ImageChops.multiply(shape,base.getchannel('A'))
    shape.save(ROOT/('source/masks/'+name+'.png'))
    return shape

def export(image,basename):
    outdir=ROOT/('renders/masters' if 'neutral' in basename else 'renders/finishes')
    for width in (400,800,1600):
        small=image.resize((width,width//2),Image.Resampling.LANCZOS)
        path=outdir/f'{basename}-{width}.webp'
        small.save(path,'WEBP',quality=94,method=6,exact=True)
        check=Image.open(path)
        assert check.mode=='RGBA' and check.size==(width,width//2),str(path)
        print('SAVED',path.relative_to(ROOT),path.stat().st_size)

def tint_region(base,mask,rgb,opacity):
    img=base.copy(); a=np.asarray(mask).astype(np.float32)/255
    raw=np.asarray(img).copy().astype(np.float32)
    # Preserve luminance contrast and mechanical texture. 0.82*orig + 0.18*desired
    target=np.zeros_like(raw[:,:,:3]);target[:]=np.asarray(rgb)
    luma=(0.2126*raw[:,:,0]+.7152*raw[:,:,1]+.0722*raw[:,:,2])/170.0
    desired=np.clip(target*(.47+.65*np.maximum(.22,luma[:,:,None])),0,255)
    factor=(a*opacity)[:,:,None]
    raw[:,:,:3]=raw[:,:,:3]*(1-factor)+desired*factor
    return Image.fromarray(raw.astype(np.uint8),'RGBA')

def energy_layer(base,regions):
    random.seed(14377)
    W,H=base.size
    layer=Image.new('RGBA',(W,H),(0,0,0,0))
    draw=ImageDraw.Draw(layer,'RGBA')
    # Artfully placed energy blossoms — distinct finish artwork, not whole-gun tint.
    flower_centers=[(415,480,44),(650,458,30),(1090,490,48),(1320,479,29),(1680,470,34),(1850,463,24)]
    for x,y,r in flower_centers:
        for petal in range(7):
            theta=2*math.pi*petal/7
            cx=x+math.cos(theta)*r*.50;cy=y+math.sin(theta)*r*.50
            dx=math.cos(theta)*r*.64;dy=math.sin(theta)*r*.64
            tangent=(-math.sin(theta),math.cos(theta))
            q1=(cx+tangent[0]*r*.25,cy+tangent[1]*r*.25)
            q2=(cx+dx,cy+dy)
            q3=(cx-tangent[0]*r*.25,cy-tangent[1]*r*.25)
            draw.polygon([q1,q2,q3,(x,y)],fill=(86,165,245,83))
            draw.line([q1,q2,q3],fill=(120,245,255,185),width=2)
        draw.ellipse((x-10,y-10,x+10,y+10),fill=(176,246,255,240))
        draw.ellipse((x-20,y-20,x+20,y+20),outline=(84,115,255,160),width=3)
    # Thin electric branches, snaking through paintable receiver and furniture
    paths=[[(310,475),(380,463),(450,484),(520,459),(600,484),(690,470),(750,493)],
           [(940,483),(1000,457),(1080,485),(1160,457),(1220,488),(1315,460)],
           [(1480,480),(1560,462),(1640,480),(1710,460),(1815,488),(1970,470)],
           [(1080,585),(1110,612),(1150,580),(1175,635)]]
    for p in paths:
        draw.line(p,fill=(30,128,255,110),width=14,joint='curve')
        draw.line(p,fill=(84,236,250,220),width=4,joint='curve')
        for q in p[1:-1]:draw.ellipse((q[0]-3,q[1]-3,q[0]+3,q[1]+3),fill=(202,251,255,245))
    # clip to union of painted regions; no glowing barrel/scope or empty air
    mask=Image.new('L',CANVAS,0)
    for region in regions:
        mask=ImageChops.lighter(mask,region)
    layer.putalpha(ImageChops.multiply(layer.getchannel('A'),mask))
    out=Image.alpha_composite(base,layer)
    return out

def main():
    base=extract()
    # Coordinates below are defined against the normalized, right-facing 2400x1200 source.
    # Mask regions fitted to visible components using preview overlay; no effects outside gun alpha.
    receiver=mask_region(base,'paint-main',[(890,398),(1575,392),(1600,605),(905,634)])
    handguard=mask_region(base,'paint-secondary',[(1530,397),(2020,396),(2020,580),(1550,587)])
    stock=mask_region(base,'stock',[(238,395),(825,385),(900,580),(220,585)])
    magazine=mask_region(base,'magazine',[(1040,565),(1220,570),(1190,1052),(930,1000)])
    grip=mask_region(base,'grip',[(1250,570),(1435,560),(1460,913),(1290,949)])
    for name,region in [('metal-exposed',ImageChops.subtract(base.getchannel('A'),ImageChops.lighter(ImageChops.lighter(receiver,handguard),stock))),('ao-shadow',base.getchannel('A'))]:
        region.save(ROOT/('source/masks/'+name+'.png'))
    fin=base.copy()
    for mask,color,opacity in [(receiver,(30,110,186),0.38),(handguard,(36,87,192),0.34),(stock,(34,100,169),0.30),(magazine,(40,143,206),0.36),(grip,(68,57,178),0.34)]:
        fin=tint_region(fin,mask,color,opacity)
    fin=energy_layer(fin,[receiver,handguard,stock,magazine,grip]);fin.putalpha(base.getchannel('A'))
    fin.save(ROOT/'source/m4a4--voltage-bloom-working-2400.png',optimize=True)
    export(base,'m4a4-neutral')
    export(fin,'m4a4--voltage-bloom')
    assert ImageChops.difference(base.getchannel('A'),fin.getchannel('A')).getbbox() is None
    print('PASS exact alpha geometry across neutral / finish')
    for name,image in [('neutral',base),('voltage-bloom',fin)]:
        card=image.resize((720,360),Image.Resampling.LANCZOS)
        checker=Image.new('RGB',card.size,(27,37,53));checker.paste(card,mask=card.getchannel('A'))
        checker.save(ROOT/f'previews/m4a4-{name}-on-dark.jpg',quality=93)
    # save layered source reference for reproducibility
    info={"sourceKind":"original generated multi-item comparison sheet cropped to M4A4 master", "sourcePixelsUsedApprox":[1110,326], "workingCanvas":[2400,1200],"output":[400,800,1600],"origin":"/mnt/data/a_clean_high_resolution_game_asset_style_promotio.png","license":"AI-generated original illustration, no third-party model", "orientation":"muzzle-right", "quality":"pilot, source detail is NOT native 1600px; acceptance requires visual review"}
    (ROOT/'source/provenance.json').write_text(json.dumps(info,indent=2))
if __name__=='__main__': main()