#!/usr/bin/env python3
"""LootHub 0.3.3G Raptor's Gaze; deterministic geometrically fixed texture finish.
Usage: python build_raptors_gaze.py [root of extracted 0.3.3G production source archive]
Requires Pillow, OpenCV, NumPy. All artwork is studio 2D; original 960px subject is resampled.
The two user red-marked reference images are layout guides, not embedded artwork.
"""
from pathlib import Path
import sys, json, math
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ROOT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parent
S=ROOT/'source'; MS=ROOT/'masks'; PR=ROOT/'previews'; N=ROOT/'renders'/'masters'; F=ROOT/'renders'/'finishes'
for p in (S,MS,PR,N,F):p.mkdir(parents=True,exist_ok=True)

neutral=Image.open(S/'karambit-neutral-master-2400.png').convert('RGBA')
old_gold=Image.open(S/'karambit--golden-talon-finished-2400.png').convert('RGBA')
assert neutral.size==old_gold.size==(2400,1200)
assert np.array_equal(np.asarray(neutral.getchannel('A')),np.asarray(old_gold.getchannel('A')))
alpha=neutral.getchannel('A')
arr=np.array(neutral,dtype=np.float32)
old=np.array(old_gold,dtype=np.float32)
H,W=arr.shape[:2]
y,x=np.mgrid[0:H,0:W].astype(np.float32)
L=np.dot(arr[:,:,:3],[0.299,0.587,0.114])
# Polished/aged gold grounded in actual neutral surface luminance, retaining the
# underlying metal pits, bevel geometry and finish shading. No full eagle graphic.
base=np.zeros((H,W,3),np.float32)
base[:,:,0]=np.clip(L*1.06+58,0,255)
base[:,:,1]=np.clip(L*0.79+29,0,242)
base[:,:,2]=np.clip(L*0.36+8,0,152)
# Soft directional brushed gold across the metal; shared source image texture
# stays apparent, while the fabricated bird-head relief is erased.
brush=(np.sin((x+3*y)*0.125)+np.sin(x*0.023+y*.018))*1.7
base[:,:,0]+=brush
base[:,:,1]+=brush*.73
base[:,:,2]+=brush*.25
base=np.clip(base,0,255)
# Existing paint material masks derive from the unchanged neutral source.
blade=np.asarray(Image.open(MS/'blade-main.png').convert('L'),dtype=np.float32)/255
motif=np.asarray(Image.open(MS/'motif-zone.png').convert('L'),dtype=np.float32)/255
edge=np.asarray(Image.open(MS/'blade-edge.png').convert('L'),dtype=np.float32)/255
# Replace the old carved eagle head by neutral-based gold at the blade heel.
# The handle/ring retain their art treatment; blend confined to blade and heel.
heel_zone=motif*np.clip((x-1220)/160,0,1)
blade_region=np.maximum(blade,heel_zone)
blade_region=cv2.GaussianBlur(blade_region,(0,0),2.5)
# Preserve the source-specific golden hilt/hardware in black grip from old art.
new=old[:,:,:3]*(1-blade_region[:,:,None])+base*blade_region[:,:,None]
# Soften the highest old engraved feather trails left of blade for minimalism.
heel_mask=(motif*np.clip((x-1240)/150,0,1))
new=new*(1-heel_mask[:,:,None]*.7)+base*heel_mask[:,:,None]*.7
new=np.clip(new,0,255).astype('uint8')

# Draw complex brow as raised metallic ridge on one dedicated transparent layer:
# along the natural blade curvature, from the eye side left to tapered distal right.
def bezier(p0,p1,p2,p3,n=140):
    t=np.linspace(0,1,n)
    pts=(1-t)[:,None]**3*np.array(p0) + 3*(1-t)[:,None]**2*t[:,None]*np.array(p1) +3*(1-t)[:,None]*t[:,None]**2*np.array(p2)+t[:,None]**3*np.array(p3)
    return pts
curve=bezier((1450,505),(1590,458),(1780,529),(1990,714),200)
# Interior follows blade upper curvature, with one long arc, no separate facial forms.
shapes={}
def stroke_ribbon(points,width0,width1,offset=(0,0),color=(255,255,255),alpha=255):
    overlay=Image.new('RGBA',(W,H),(0,0,0,0));d=ImageDraw.Draw(overlay)
    pts=points.copy();pts[:,0]+=offset[0];pts[:,1]+=offset[1]
    for i in range(len(pts)-1):
      t=i/(len(pts)-1)
      r=max(.5,(width0*(1-t)+width1*t)/2)
      x0,y0=pts[i];x1,y1=pts[i+1]
      d.line([(round(x0),round(y0)),(round(x1),round(y1))],fill=color+(alpha,),width=max(1,round(r*2)),joint='curve')
      d.ellipse((round(x0-r),round(y0-r),round(x0+r),round(y0+r)),fill=color+(alpha,))
    return overlay

def blend(layer,mask=None):
    global merged
    if mask is not None:
      layer.putalpha(Image.fromarray((np.asarray(layer.getchannel('A'),dtype=np.float32)*mask).astype(np.uint8),'L'))
    merged.alpha_composite(layer)

merged=Image.fromarray(np.dstack([new,np.asarray(alpha)]).astype(np.uint8),'RGBA')
# Keep all sculpting strictly inside the canonical neutral alpha. Shadow, ridge,
# light and graphite inset are all 2D material illustration, not 3D topology.
full_mask=np.asarray(alpha,dtype=np.float32)/255
blend(stroke_ribbon(curve,32,5,(0,12),(73,39,9),228),full_mask)
blend(stroke_ribbon(curve,22,3,(0,4),(124,70,17),239),full_mask)
blend(stroke_ribbon(curve,16,2,(0,-3),(214,152,49),255),full_mask)
blend(stroke_ribbon(curve,6,1,(0,-8),(251,218,127),218),full_mask)
# Subtle falloff and shadow within the brow. No eye sockets or full eagle head.
# A single eyeball nested near blade root as per user's red dot.
EX,EY=1497,537
# Coordinates are right-facing mirror equivalents of marked left-facing photo.
eye_shadow=Image.new('RGBA',(W,H),(0,0,0,0));d=ImageDraw.Draw(eye_shadow)
d.ellipse((EX-29,EY-20,EX+34,EY+20),fill=(65,38,12,225))
d.ellipse((EX-23,EY-16,EX+26,EY+14),fill=(28,23,17,246))
d.ellipse((EX-17,EY-13,EX+14,EY+12),fill=(8,12,18,250))
d.ellipse((EX-7,EY-10,EX+6,EY+10),fill=(3,6,9,252))
d.ellipse((EX-6,EY-10,EX-1,EY-5),fill=(238,202,134,228))
# Eye-frame is a raised gold incised rim, closely hugging this one eyeball only.
d.arc((EX-29,EY-20,EX+34,EY+20),186,354,fill=(250,212,105,230),width=5)
d.arc((EX-29,EY-20,EX+34,EY+20),14,166,fill=(132,84,30,175),width=4)
blend(eye_shadow,full_mask)
# Very fine accent joining the brow to the eye, not a complete bird head.
# A tiny gold glint where the brow terminates above eye.
accent=stroke_ribbon(bezier((1450,505),(1465,500),(1478,508),(1493,515),40),5,7,(0,0),(248,201,93),187)
blend(accent,full_mask)

# Explicit image alpha authority. Preserve no external shadow, offscreen titles,
# or accidental painted alpha in the transparent background.
merged.putalpha(alpha)
merged.save(S/'karambit--raptors-gaze-finished-2400.png',optimize=True)
neutral.save(S/'karambit-neutral-master-2400.png',optimize=True)
assert np.array_equal(np.array(merged.getchannel('A')),np.array(neutral.getchannel('A')))
# Production-only mask layers for reproducible editing.
for name in ('blade-main','blade-edge','handle','ring','hardware','edge-highlight','ao-shadow'):
 p=MS/(name+'.png')
 assert p.exists(),p
brow_layer=stroke_ribbon(curve,28,4)
for name,layer in [('brow-ridge',brow_layer)]:
 a=np.uint8(np.asarray(layer.getchannel('A'),dtype=np.float32)*full_mask)
 Image.fromarray(a,'L').save(MS/(name+'.png'),optimize=True)
eye_layer=Image.new('L',(W,H),0);ImageDraw.Draw(eye_layer).ellipse((EX-34,EY-22,EX+37,EY+23),fill=255)
eye_layer.putdata(np.uint8(np.asarray(eye_layer,dtype=np.float32).ravel()*full_mask.ravel()).tolist())
eye_layer.save(MS/'eye-zone.png',optimize=True)

for width in (400,800,1600):
 sz=(width,width//2)
 n=neutral.resize(sz,Image.Resampling.LANCZOS)
 g=merged.resize(sz,Image.Resampling.LANCZOS)
 g.putalpha(n.getchannel('A'))
 npth=N/f'karambit-neutral-{width}.webp';gpth=F/f'karambit--raptors-gaze-{width}.webp'
 n.save(npth,'WEBP',quality=95,method=6,alpha_quality=100)
 g.save(gpth,'WEBP',quality=95,method=6,alpha_quality=100)
 nn=Image.open(npth).convert('RGBA');gg=Image.open(gpth).convert('RGBA')
 assert nn.size==gg.size==sz
 assert np.array_equal(np.asarray(nn.getchannel('A')),np.asarray(gg.getchannel('A')))
 assert gg.getpixel((0,0))[3]==0
 # ring aperture roughly center 400,720 in 2400x1200 work image
 assert gg.getpixel((round(400*width/2400),round(720*width/2400)))[3]==0

def on_dark(im):
 bg=Image.new('RGBA',im.size,(13,17,24,255));bg.alpha_composite(im);return bg.convert('RGB')

# Preview from real game exports, not separate regenerated images.
a=Image.open(N/'karambit-neutral-1600.webp').convert('RGBA')
b=Image.open(F/'karambit--raptors-gaze-1600.webp').convert('RGBA')
combo=Image.new('RGB',(1200,1250),(13,17,24))
combo.paste(on_dark(a.resize((1200,600))), (0,0))
combo.paste(on_dark(b.resize((1200,600))), (0,625))
combo.save(PR/'raptors-gaze-side-by-side.jpg',quality=94,subsampling=0)
on_dark(b).save(PR/'raptors-gaze-inspect.jpg',quality=95,subsampling=0)
on_dark(b.resize((400,200))).save(PR/'raptors-gaze-reel-card.jpg',quality=95,subsampling=0)
bcrop=on_dark(b).crop((890,200,1300,540));bcrop.resize((820,680)).save(PR/'brow-eye-close-up.jpg',quality=95,subsampling=0)
report={'schemaVersion':1,'id':'karambit--raptors-gaze','finish':'Raptor\'s Gaze','basedOn':'karambit-neutral-master-2400.png','currentOriginalSourceDescription':'Generated multi-panel original 1774x887; knife about 960px wide in original source. Export upsampled.',
        'originalSubjectWidthApprox':960,'nativeDetailNot1600':True,'workingDimensions':[2400,1200],'browCurve2200Canvas':[list(map(int,p)) for p in curve[::35]],'eyeCenter2400Canvas':[EX,EY],'maskNames':['blade-main','blade-edge','brow-ridge','eye-zone','handle','ring','hardware','edge-highlight','ao-shadow'],
        'sharedGeometry':True,'alphaIdenticalAtAllWidths':True,'rarity':'Legendary','releaseState':'provisional-2d-rendered','sourceRemainsAIgenerated':True}
(S/'render-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))