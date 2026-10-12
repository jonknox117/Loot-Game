#!/usr/bin/env python3
"""LootHub isolated AWP 2D master and deterministic original finish compositor.

Run: python build_awp.py [bundle-directory]
Dependencies: pillow, numpy, opencv-python
The same neutral alpha and geometry is retained for every finish. This is art,
not weapon assembly or weapon design. Provides no operational instructions.
"""
from pathlib import Path
import sys,json,math
import numpy as np
import cv2
from PIL import Image,ImageDraw,ImageFilter,ImageChops
ROOT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parent
SOURCE=ROOT/'source'
NEUTRAL_SOURCE=SOURCE/'awp-neutral-original.png'
W,H=2400,1200
Image.MAX_IMAGE_PIXELS=None
source=Image.open(NEUTRAL_SOURCE).convert('RGBA')
assert source.size==(1774,887),f'Unexpected source size {source.size}'
scale=(W*.916)/source.width
sz=(round(source.width*scale),round(source.height*scale)); ox=(W-sz[0])//2;oy=(H-sz[1])//2
working=Image.new('RGBA',(W,H),(0,0,0,0));working.alpha_composite(source.resize(sz,Image.Resampling.LANCZOS),(ox,oy))
working.save(SOURCE/'awp-neutral-2400.png',optimize=True)
rgba=np.array(working,dtype=np.float32); alpha=rgba[:,:,3].copy();base=rgba[:,:,:3].copy()
Y,X=np.indices((H,W),dtype=np.float32)
# Original source coordinate mapping. Hue + location isolate the olive-green chassis
# without painting gunmetal barrel, black sight glass, hardware, or voids.
sx=(X-ox)/scale;sy=(Y-oy)/scale
r,g,b=base[:,:,0],base[:,:,1],base[:,:,2]
olive_delta=.5*(r+g)-b
olive_strength=np.clip((olive_delta-5.8)/8,0,1)
chassis_area=((sx>550)&(sx<1730)&(sy>389)&(sy<652)).astype(np.float32)
stock_strength=olive_strength*chassis_area*np.clip(alpha/255,0,1)
# Add a soft rim within olive polygon but avoid repainting the black areas inside.
body_mask=np.uint8(np.clip(stock_strength*255,0,255))
body_mask=cv2.GaussianBlur(body_mask,(0,0),1.6)
# Split outer body for independent finish masks, untouched optics and hardware.
region_defs={
 'paint-main':[(550,387),(1678,386),(1726,438),(1710,592),(1608,611),(1430,617),(1300,646),(1180,573),(966,529),(850,503),(620,506)],
 'paint-secondary':[(555,390),(1068,390),(1157,435),(1089,518),(578,519)],
 'hardware':[(0,220),(1774,220),(1774,389),(0,389)],
 'scope-housing':[(788,225),(1439,225),(1439,386),(788,386)],
 'barrel':[(0,350),(1120,350),(1120,410),(0,410)]
}
masks={}
for name,coords in region_defs.items():
 poly=np.zeros((H,W),np.uint8)
 pts=np.array([[(round(x*scale+ox),round(y*scale+oy)) for x,y in coords]],np.int32)
 cv2.fillPoly(poly,pts,255)
 if name.startswith('paint'):
  result=cv2.multiply(poly,body_mask,scale=1/255)
 elif name=='scope-housing':
  result=np.uint8(np.float32(poly)*np.clip(alpha/255,0,1))
 elif name=='barrel':
  result=np.uint8(np.float32(poly)*np.clip(alpha/255,0,1))
 else:
  result=np.uint8(np.float32(poly)*np.clip(alpha/255,0,1))
 masks[name]=result
 Image.fromarray(result,'L').save(SOURCE/'masks'/f'{name}.png')
Image.fromarray(body_mask,'L').save(SOURCE/'masks'/'olive-chassis.png')
# Region independent of hand-drawn polygons: alpha/brightness mask and geometry stable.
mat=np.clip(body_mask.astype(np.float32)/255,0,1)
# Real olive surface brightness varying with surface relief. Original finish details
# (screws, seams, thumbhole, trigger) are explicitly kept by the mask.
y_luma=.24*r+.67*g+.09*b
rng=np.random.default_rng(79471)
noise=rng.standard_normal((H//8+1,W//8+1)).astype(np.float32)
cloud=cv2.resize(noise,(W,H),interpolation=cv2.INTER_CUBIC)
cloud=cv2.GaussianBlur(cloud,(0,0),9)
cloud=(cloud-cloud.mean())/(cloud.std()+1e-4)
# Surface visual coordinates x/y in the native source; no random render flicker.


def apply_base(color_a,color_b,name):
 p=(np.sin(X/650+Y/330)+1)/2
 col=np.array(color_a,np.float32)[None,None,:]*(1-p[:,:,None])+np.array(color_b,np.float32)[None,None,:]*p[:,:,None]
 lum=np.clip((y_luma/75),.18,1.65)[:,:,None]
 rgb=np.clip(col*lum+7,0,255)
 return base*(1-mat[:,:,None]*.93)+rgb*(mat[:,:,None]*.93)


def detail_overlay(rgb,layer,opacity=1):
 layer_rgb=layer[:,:,:3].astype(np.float32);layer_alpha=layer[:,:,3].astype(np.float32)/255
 weighted=np.clip(layer_alpha*opacity*mat,0,1)[:,:,None]
 return rgb*(1-weighted)+layer_rgb*weighted


def surface_art_night():
 img=Image.new('RGBA',(W,H),(0,0,0,0));d=ImageDraw.Draw(img,'RGBA')
 # Thin streams of phosphor nebula color with strong dark-space texture.
 rng=np.random.default_rng(31084)
 for i in range(60):
  nx=float(rng.uniform(800,2190));ny=float(rng.uniform(525,755))
  rad=float(rng.uniform(6,60))
  col=(int(rng.uniform(80,170)),int(rng.uniform(42,105)),int(rng.uniform(160,240)),int(rng.uniform(12,43)))
  d.ellipse((nx-rad,ny-rad*.6,nx+rad,ny+rad*.6),fill=col)
 # Arcs flow left to right with shallow trajectory, suggesting moving constellations.
 for i in range(11):
  x0=820+i*113
  y0=550+(i%5)*34
  pts=[(x0+j*22,y0+math.sin(j*.40+i)*9+j*.75) for j in range(0,10)]
  d.line(pts,fill=(96,143,247,165),width=3,joint='curve')
  d.line([(x,y-2) for x,y in pts],fill=(183,151,255,120),width=2)
 # Tiny pinprick stars over the stock/chassis, only inside paint mask.
 for i in range(140):
  x=int(rng.integers(700,2220));y=int(rng.integers(530,785)); rad=1 if i%3 else 2
  d.ellipse((x-rad,y-rad,x+rad,y+rad),fill=(208,224,255,int(rng.uniform(75,175))))
 # Intentional large original constellation crest visible at inventory scale.
 d.arc((1630,615,1794,779),30,315,fill=(127,202,255,220),width=7)
 d.arc((1641,627,1779,768),60,335,fill=(218,189,255,175),width=3)
 for x,y in [(1250,578),(1470,598),(1845,655),(1970,691)]:
  d.line((x-12,y,x+12,y),fill=(146,212,253,202),width=3)
  d.line((x,y-11,x,y+11),fill=(178,214,255,197),width=3)
 # Broad metallic blue-silver contours supply shape-readable pattern at 160px cards.
 for k in range(6):
  y=590+k*28
  pts=[(785+j*32,y+math.sin(j*.33+k)*14) for j in range(0,45)]
  d.line(pts,fill=(71,174,245,175),width=5,joint='curve')
  d.line([(x,yy-1) for x,yy in pts],fill=(205,203,255,117),width=2)
 return np.array(img,dtype=np.uint8)


def surface_art_eclipse():
 img=Image.new('RGBA',(W,H),(0,0,0,0));d=ImageDraw.Draw(img,'RGBA')
 gold=(237,183,77,210);low=(127,82,33,125);hi=(255,224,147,180)
 # Delicate repeating etched art-deco ellipse geometry with metallic striping.
 for x in range(800,2350,110):
  for y in range(525,805,88):
   d.arc((x-70,y-35,x+70,y+35),180,360,fill=low,width=2)
   d.arc((x-37,y-22,x+37,y+22),0,185,fill=gold,width=2)
   d.line((x,y-19,x+26,y+16),fill=low,width=2)
 # Eclipsed disc motif centred on the forward stock, clipped to real chassis.
 cx,cy=1490,606
 d.ellipse((cx-58,cy-58,cx+58,cy+58),outline=gold,width=7)
 d.ellipse((cx-39,cy-39,cx+39,cy+39),fill=(18,17,25,240))
 d.arc((cx-45,cy-45,cx+45,cy+45),35,320,fill=hi,width=4)
 for x in range(842,2270,210):
  d.polygon([(x,565),(x+16,548),(x+33,565),(x+16,582)],outline=hi)
 # Fine horizontal filigree strips as part of surface, not UI glow.
 d.line([(792,600),(2210,601)],fill=(235,178,76,220),width=4)
 d.line([(865,685),(2210,685)],fill=(219,170,74,160),width=3)
 # Raised gold veins that follow the weapon rather than covering the whole weapon.
 for k in range(5):
  x0=850+k*265
  pts=[(x0+j*19,645+math.sin((j+k)*.8)*26) for j in range(0,12)]
  d.line(pts,fill=(255,205,112,195),width=5,joint='curve')
  d.line([(x,yy-2) for x,yy in pts],fill=(255,234,165,140),width=2)
 # Emphasized concentric engraved sun disc at the centre of the chassis.
 cx,cy=1510,654
 d.ellipse((cx-88,cy-88,cx+88,cy+88),outline=(237,172,69,228),width=6)
 d.ellipse((cx-67,cy-67,cx+67,cy+67),outline=(255,224,135,188),width=3)
 d.ellipse((cx-40,cy-40,cx+40,cy+40),fill=(12,13,19,220))
 return np.array(img,dtype=np.uint8)


finishes={
 'night-watch':{'name':'Night Watch','rarity':'Rare','palette':['#242a55','#5b4689','#b5aaff']},
 'eclipse':{'name':'Eclipse','rarity':'Super Rare','palette':['#161920','#c18a39','#f5d69b']}
}
for slug,recipe in finishes.items():
 if slug=='night-watch':
  rgb=apply_base((28,32,72),(61,42,102),slug)
  rgb=np.clip(rgb+(cloud[:,:,None]*np.array([2,1.5,7])[None,None,:])*mat[:,:,None],0,255)
  rgb=detail_overlay(rgb,surface_art_night(),1)
  # subtle scope edge coloration; retain the original real metallic detail.
  scope=(np.float32(masks['scope-housing'])/255)[:,:,None]
  tint=np.array([84,64,111],np.float32)
  rgb=rgb*(1-scope*.13)+(np.maximum(rgb,tint))*scope*.13
 else:
  rgb=apply_base((26,24,24),(135,91,41),slug)
  rgb=np.clip(rgb+(cloud[:,:,None]*np.array([2,1.8,1.5])[None,None,:])*mat[:,:,None],0,255)
  rgb=detail_overlay(rgb,surface_art_eclipse(),1)
  scope=(np.float32(masks['scope-housing'])/255)[:,:,None]
  # warm-gold metal in scope small proportion, without filling the scope glass
  tint=np.array([105,79,35],np.float32)
  rgb=rgb*(1-scope*.16)+(np.maximum(rgb,tint))*scope*.16
 res=np.dstack([np.uint8(np.clip(rgb,0,255)),np.uint8(alpha)])
 image=Image.fromarray(res,'RGBA')
 image.save(ROOT/'finishes'/f'awp--{slug}-working-2400.png',optimize=True)
 for target in [400,800,1600]:
  out=image.resize((target,target//2),Image.Resampling.LANCZOS)
  out.save(ROOT/'renders'/f'awp--{slug}-{target}.webp','WEBP',quality=94,method=6,exact=True)
  assert out.getchannel('A').getextrema()==(0,255)
 (SOURCE/f'awp--{slug}-recipe.json').write_text(json.dumps({
  'version':1,'id':f'awp--{slug}','model':'AWP','finish':recipe['name'],
  'rarity':recipe['rarity'],'palette':recipe['palette'],'geometrySource':'source/awp-neutral-original.png',
  'neutralWorking':'source/awp-neutral-2400.png','exportWidths':[400,800,1600],
  'materialMasks':['olive-chassis','paint-main','paint-secondary','scope-housing','barrel','hardware'],
  'description':'Original deterministic shader and detail overlays, constrained to a shared master silhouette and using the same stored PNG for all image sizes.',
  'status':'pilot-awaiting-visual-acceptance','repeatable':True},indent=2)+'\n')
for target in [400,800,1600]:
 out=working.resize((target,target//2),Image.Resampling.LANCZOS)
 out.save(ROOT/'renders'/f'awp-neutral-{target}.webp','WEBP',quality=94,method=6,exact=True)
# Create a viewer-friendly proof sheet on dark navy backing.
P=Image.new('RGB',(1180,1000),(12,18,28));d=ImageDraw.Draw(P)
for row,(slug,title) in enumerate([('neutral','AWP NEUTRAL MASTER'),('night-watch','AWP NIGHT WATCH'),('eclipse','AWP ECLIPSE')]):
 fn=(ROOT/'renders'/('awp-neutral-800.webp' if slug=='neutral' else f'awp--{slug}-800.webp'))
 weapon=Image.open(fn).convert('RGBA').resize((1080,540),Image.Resampling.LANCZOS)
 weapon=weapon.crop((0,100,1080,440)).resize((1080,270),Image.Resampling.LANCZOS)
 P.paste(weapon,(50,row*320+37),weapon.getchannel('A'))
 d.text((55,row*320+12),title,fill=(225,231,244))
 d.line((50,(row+1)*320,1130,(row+1)*320),fill=(56,72,94),width=1)
P.save(ROOT/'previews'/'awp-master-finish-comparison.jpg',quality=92)
for p in sorted((ROOT/'renders').glob('*.webp')):
 im=Image.open(p)
 print(p.name,im.size,round(p.stat().st_size/1024,1),'KB',im.mode,im.getchannel('A').getextrema())