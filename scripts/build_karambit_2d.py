#!/usr/bin/env python3
"""LootHub 0.3.3F Golden Talon: rebuild exact-silhouette neutral/finish exports.

Run: python build_karambit.py
Dependencies: Pillow, NumPy, OpenCV. This source explicitly uses a generated
concept render as an ORIGINAL ART ILLUSTRATION, not an accurate CAD source.
An approximately 950px native blade is upsampled for the 1600px inspect export.
"""
import io
import json
import math
import pathlib
import sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageOps

ROOT=pathlib.Path(sys.argv[1]).resolve() if len(sys.argv)>1 else pathlib.Path(__file__).resolve().parent
SRC=ROOT/'source'/'original-neutral-and-golden-concept.png'
PRE=ROOT/'previews'; PRE.mkdir(exist_ok=True)
MAST=ROOT/'renders'/'masters'; MAST.mkdir(parents=True, exist_ok=True)
FIN=ROOT/'renders'/'finishes'; FIN.mkdir(parents=True, exist_ok=True)
MASKS=ROOT/'masks';MASKS.mkdir(exist_ok=True)
NATIVE=Image.open(SRC).convert('RGB')
# Crop only the standalone, long-side-on render from each portion of the sheet.
# These crops intentionally omit all headings, other thumbnails and motif callouts.
NEU=np.array(NATIVE.crop((410,3,1420,318)))
GOLD=np.array(NATIVE.crop((410,322,1420,632)))
H,W=NEU.shape[:2]

def canonical_alpha(rgb):
    gray=cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY)
    foreground=((gray>28).astype(np.uint8)*255)
    foreground=cv2.morphologyEx(foreground,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
    contours,hierarchy=cv2.findContours(foreground,cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
    out=np.zeros((H,W),np.uint8)
    # Two disjoint components at threshold: main knife body and metal ring. Fill
    # the many tiny surface depressions, without closing the actual finger hole.
    major=[(i,cv2.contourArea(c)) for i,c in enumerate(contours)
           if hierarchy[0][i][3]<0 and cv2.contourArea(c)>9000]
    if len(major)!=2:raise AssertionError(f'Expected one knife and one ring; got {major}')
    for i,area in major:cv2.drawContours(out,contours,i,255,-1)
    # Exclude the actual ring aperture. Detect the large dark child of the
    # ring contour rather than manually cutting a fake circular hole.
    ring_index=min(major,key=lambda t: t[1])[0]
    holes=[]
    for i,c in enumerate(contours):
        if hierarchy[0][i][3] == ring_index and cv2.contourArea(c)>3500:
            holes.append((i,cv2.contourArea(c)))
    if len(holes)!=1:raise AssertionError(f'Expected 1 clear ring aperture, got {holes}')
    cv2.drawContours(out,contours,holes[0][0],0,-1)
    # Preserve fine antialiasing along source edges without changing the hole.
    out=cv2.GaussianBlur(out,(3,3),0.50)
    return out

base_alpha=canonical_alpha(NEU)
# Align the generative Golden Talon *surface illustration* to the neutral's
# actual target silhouette. The gold source has its ring ~25px lower than the
# neutral source; a smooth local correction aligns grip/ring, keeping the
# eagle eye intact. NEUTRAL ALPHA remains authoritative for BOTH exports.
xx,yy=np.meshgrid(np.arange(W,dtype=np.float32),np.arange(H,dtype=np.float32))
mapx=xx+1.0
vertical_shift=4.0-29.0*np.clip(xx/885.0,0,1.1)**1.65
mapy=yy-vertical_shift
mapped=cv2.remap(GOLD,mapx,mapy,cv2.INTER_CUBIC,borderMode=cv2.BORDER_CONSTANT,borderValue=(6,6,6))

# Base pixels are the original neutral source. Gold pixels come from the unique
# eagle relief source; thresholded background pixels are repaired with an
# understated warm gold tint of the original neutral detail, not black bands.
neutral=NEU.copy()
base_float=NEU.astype(np.float32)
# Warm gold backing follows source sculptural luminance rather than a flat tint.
luma=cv2.cvtColor(NEU,cv2.COLOR_RGB2GRAY).astype(np.float32)
gold_back=np.stack([np.clip(luma*1.28+28,0,255),np.clip(luma*0.96+9,0,255),np.clip(luma*0.57+1,0,255)],axis=2)
# Valid golden pixels are brighter than the dark studio background.
glum=cv2.cvtColor(mapped,cv2.COLOR_RGB2GRAY).astype(np.float32)
valid=np.clip((glum-20.0)/20.0,0.0,1.0)[...,None]
# For grip use same received artist finish (charcoal + gold filigree); in
# invalid dark areas preserve the neutral material, not the blade's gold tint.
grip_region=np.clip((xx-475.0)/110.0,0.0,1.0)[...,None]
backup=gold_back*(1-grip_region)+base_float*grip_region
finished=np.clip(mapped.astype(np.float32)*valid+backup*(1-valid),0,255).astype(np.uint8)
# Preserve original knife's dark handle texture while keeping painterly warm
# pinstriping/trim in the finish source.

# Work canvas: source bounds have breathing room. This is an interpolated
# 2400x1200 image, NOT native 2400px detail.
CANVAS=(2400,1200)
SCALE=1.99
scaled=(round(W*SCALE),round(H*SCALE))
anchor=((CANVAS[0]-scaled[0])//2,(CANVAS[1]-scaled[1])//2)

def make_working(rgb,alpha):
    rgba=np.concatenate([rgb,alpha[...,None]],axis=2)
    subject=Image.fromarray(rgba,'RGBA').resize(scaled,Image.Resampling.LANCZOS)
    image=Image.new('RGBA',CANVAS,(0,0,0,0));image.alpha_composite(subject,dest=anchor)
    return image
neutral_img=ImageOps.mirror(make_working(neutral,base_alpha))
finished_img=ImageOps.mirror(make_working(finished,base_alpha))
# Force mathematically exact alpha, including downsampled antialias pixels.
finished_img.putalpha(neutral_img.getchannel('A'))
neutral_img.save(ROOT/'source'/'karambit-neutral-master-2400.png',optimize=True)
finished_img.save(ROOT/'source'/'karambit--golden-talon-finished-2400.png',optimize=True)

def region_masks():
    # Mask geometry is registered to the same source canvas before resizing.
    # Includes all production mask names; no false claim of CAD material IDs.
    def poly(points):
        img=Image.new('L',(W,H),0);ImageDraw.Draw(img).polygon(points,fill=255)
        return np.array(img)
    def base_mask(region):return cv2.bitwise_and(base_alpha,region)
    whole=np.full((H,W),255,np.uint8)
    blade=poly([(0,0),(570,0),(555,60),(485,195),(375,228),(0,H)])
    edge=poly([(0,220),(220,118),(410,92),(515,120),(512,171),(410,203),(170,290),(0,H)])
    motif=poly([(252,1),(590,1),(605,145),(465,196),(320,137)])
    handle=poly([(420,0),(1010,0),(1010,H),(745,H),(500,175),(420,95)])
    ring=np.zeros((H,W),np.uint8);cv2.circle(ring,(885,199),103,255,-1)
    metal=np.zeros((H,W),np.uint8)
    for p in [(671,121),(759,157),(806,172)]:cv2.circle(metal,p,10,255,-1)
    # For highlights use boundary ring, and for AO bottom-side softness.
    outer=cv2.morphologyEx(base_alpha,cv2.MORPH_GRADIENT,np.ones((5,5),np.uint8))
    shadow=np.clip((yy-110)/180,0,1)
    masks={'blade-main':base_mask(blade),'blade-edge':base_mask(edge),
           'motif-zone':base_mask(motif),'handle':base_mask(handle),
           'ring':base_mask(ring),'hardware':base_mask(metal),
           'edge-highlight':outer,'ao-shadow':np.uint8(base_alpha*shadow)}
    for name,mask in masks.items():
        out=Image.new('L',CANVAS,0)
        pic=Image.fromarray(mask,'L').resize(scaled,Image.Resampling.LANCZOS)
        out.paste(pic,anchor)
        ImageOps.mirror(out).save(MASKS/f'{name}.png',optimize=True)
    return masks
region_masks()

# Actual PNG/WebP export files. Each context is independently downsampled
# from the 2400px lossless working original.
for width in (400,800,1600):
    target=(width,width//2)
    n=neutral_img.resize(target,Image.Resampling.LANCZOS)
    f=finished_img.resize(target,Image.Resampling.LANCZOS)
    f.putalpha(n.getchannel('A'))
    n.save(MAST/f'karambit-neutral-{width}.webp',format='WEBP',quality=94,alpha_quality=100,method=6)
    f.save(FIN/f'karambit--golden-talon-{width}.webp',format='WEBP',quality=94,alpha_quality=100,method=6)
    nr=Image.open(MAST/f'karambit-neutral-{width}.webp').convert('RGBA')
    fr=Image.open(FIN/f'karambit--golden-talon-{width}.webp').convert('RGBA')
    assert nr.size==fr.size==target
    assert np.array_equal(np.asarray(nr.getchannel('A')),np.asarray(fr.getchannel('A')))
    assert nr.getchannel('A').getbbox()==fr.getchannel('A').getbbox()
    # True transparent corners, and open hole in the finger ring.
    assert fr.getpixel((0,0))[3]==0 and fr.getpixel((width-1,target[1]-1))[3]==0
    hole_x=width-1-round((anchor[0]+885*SCALE)*width/CANVAS[0]);hole_y=round((anchor[1]+200*SCALE)*width/CANVAS[0])
    assert fr.getpixel((hole_x,hole_y))[3]==0,('Ring hole blocked',width, hole_x,hole_y)

# The standalone review image is generated from the SAME 1600px game exports.
# Show them against a flat studio charcoal stage; no baked shadows in sprites.
def on_dark(img,sz=(960,480)):
    resized=img.resize(sz,Image.Resampling.LANCZOS)
    bg=Image.new('RGBA',sz,(16,19,25,255));bg.alpha_composite(resized)
    return bg.convert('RGB')
n=Image.open(MAST/'karambit-neutral-1600.webp').convert('RGBA')
f=Image.open(FIN/'karambit--golden-talon-1600.webp').convert('RGBA')
comparison=Image.new('RGB',(1000,1040),(12,15,20))
comparison.paste(on_dark(n,(1000,500)),(0,0))
comparison.paste(on_dark(f,(1000,500)),(0,515))
comparison.save(PRE/'karambit-master-golden-talon-comparison.jpg',quality=92,subsampling=0)
on_dark(f,(1600,800)).save(PRE/'golden-talon-inspect-on-dark.jpg',quality=94,subsampling=0)
# Compact test card at true approximate 160px item width.
card=on_dark(f,(400,200));card.save(PRE/'golden-talon-400px-card.jpg',quality=94)

report={'schemaVersion':1,'asset':'karambit--golden-talon','originalIllustrationSource':'original-neutral-and-golden-concept.png',
        'originalSourceDimensions':list(NATIVE.size),'neutralCrop':[410,3,1420,318],
        'goldenCrop':[410,322,1420,632],'nativeSubjectApproxWidth':960,
        'workingCanvas':list(CANVAS),'nativeDetailNot1600':True,'sourceFacing':'hook-left, ring-right', 'finalFacing':'hook-right, ring-left',
        'orientationCorrection':'Both original panels were horizontally mirrored together for the approved hook-right, ring-left orientation, with no relative geometry drift.',
        'alphaIdentityVerified':True,'realAlphaTransparency':True,'ringHoleOpen':True,
        'exportDimensions':{str(x):[x,x//2] for x in (400,800,1600)},
        'note':'Original AI-generated artwork, extracted from a high-resolution production concept board. Eagle eye and feather relief are image texture, not editable 3D raised geometry.'}
(ROOT/'source'/'provenance.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))