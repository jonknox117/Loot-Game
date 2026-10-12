import cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import sys
P=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parent
S=P
orig=Image.open(S/'source/karambit-neutral-master-2400.png').convert('RGBA')
W,H=orig.size
img=np.asarray(orig).astype(np.float32)
alpha=img[:,:,3].copy()
RGB=img[:,:,:3].copy()
luma=(RGB[:,:,0]*.299+RGB[:,:,1]*.587+RGB[:,:,2]*.114)/255
YY,XX=np.mgrid[:H,:W].astype(np.float32)
B=np.array(Image.open(S/'masks/blade-main.png').convert('L')).astype(np.float32)/255
E=np.array(Image.open(S/'masks/blade-edge.png').convert('L')).astype(np.float32)/255
R=np.array(Image.open(S/'masks/ring.png').convert('L')).astype(np.float32)/255
T=np.array(Image.open(S/'masks/handle.png').convert('L')).astype(np.float32)/255
HARD=np.array(Image.open(S/'masks/hardware.png').convert('L')).astype(np.float32)/255
AL=alpha/255
# Actual image crop: knife x ~213..2165 y 288..913, bend on right. Finishes on existing neutral master, no geometry or artificial features.
base_l=np.clip(luma,0,1)
# independent smooth fractal material fields, fixed deterministic seeds; geometry and alpha are reused from neutral
rng=np.random.default_rng(60417)
def noise(shape):
 p=rng.standard_normal((max(2,H//shape),max(2,W//shape))).astype(np.float32)
 q=cv2.resize(p,(W,H),interpolation=cv2.INTER_CUBIC)
 q=cv2.GaussianBlur(q,(0,0),1.6)
 return q
n0=noise(145);n1=noise(80);n2=noise(37);n3=noise(19)
warp=n0*51+n1*27+n2*13+n3*4
# Grained wootz-like flowing currents (native material texture; no drawn features)
phase=(XX*.059 + YY*.016 + 11*np.sin(XX*.010+YY*.012) + 7*np.sin(XX*.004-YY*.021) + warp*.14)
current=np.sin(phase)+.36*np.sin(phase*1.8+.6)+.20*np.sin(phase*3.4+1.4)
bands=np.clip((current-.56)*1.35,0,1)**1.6
big=np.clip(.5+.28*n0+.19*n1+.11*np.sin(XX*.006+YY*.014+warp*.07),0,1)
metal=(.48+base_l*.92)[...,None]
spec=np.clip((base_l-.63)*2.2,0,.75)[...,None]

def color(hex):return np.array([int(hex[i:i+2],16) for i in (1,3,5)],np.float32)
def mix(c1,c2,t):
 a=c1[None,None,:] if c1.ndim==1 else c1
 b=c2[None,None,:] if c2.ndim==1 else c2
 return a*(1-t[...,None])+b*t[...,None]

def make(style):
 out=RGB.copy();
 if style=='starfall':
  # satin-sheened cobalt-to-amethyst anodized damascus, luminous blue/silver banding
  u=np.clip((XX-1050)/1200,0,1)
  field=np.clip(.18+u*.43+big*.35,0,1)
  body=mix(color('#211c58'),color('#1d8fbd'),field)
  pear=mix(color('#d58de9'),color('#b7eefb'),np.clip(u*.65+.25,0,1))
  body=body*(1-(bands*.70)[...,None])+pear*(bands*.70)[...,None]
  metal_colors=np.clip(body*metal+spec*color('#9fe8fd')*.78+4,0,255)
  # bright sapphire edge preserves actual metallic bevel texture
  edge=mix(color('#9cd3fc'),color('#e7dbff'),np.clip(.25+big*.65,0,1))
  edge=np.clip(edge*(.40+base_l*.98)[...,None]+spec*color('#b7f5ff')*.7,0,255)
  cRing=color('#d4a85b');cScrew=color('#c19b68')
 elif style=='blackgold':
  # obsidian metal with warm gold swirling wootz currents; gold razor bevel
  base=mix(color('#121c27'),color('#524435'),np.clip(big*.65,0,1))
  gold=mix(color('#996119'),color('#f3ce72'),np.clip(.5+big*.4,0,1))
  high=(np.clip((current+.32)*.42,0,1)**1.8)*.58
  body=mix(base,gold,high)
  metal_colors=np.clip(body*(.40+base_l*1.35)[...,None]+spec*color('#d6bd8c')*.35,0,255)
  edge_gold=mix(color('#b77522'),color('#ffe1a0'),np.clip(.36+big*.5,0,1))
  edge=np.clip(edge_gold*(.45+base_l*1.10)[...,None]+spec*color('#fff1bc')*.5,0,255)
  cRing=color('#caa653');cScrew=color('#d2b572')
 elif style=='bloodmoon':
  # deep garnet red damascus with polished rose gold and restrained amber tone
  field=np.clip(.32+big*.40+(.5+.5*np.sin(XX*.009+warp*.03))*.2,0,1)
  base=mix(color('#451124'),color('#af314a'),field)
  pearl=mix(color('#cb7b8a'),color('#ffaf81'),np.clip(big*.5,0,1))
  body=mix(base,pearl,np.clip(bands*.38,0,1))
  metal_colors=np.clip(body*(.42+base_l*1.20)[...,None]+spec*color('#feddb8')*.58,0,255)
  edge=np.clip(mix(color('#d29c78'),color('#ffd4b0'),np.clip(big,0,1))*(.45+base_l*.98)[...,None]+spec*color('#ffe8c7')*.70,0,255)
  cRing=color('#daa375');cScrew=color('#b88b6b')
 # Finish blade first. Main body and narrow cutting-bevel bright treatment blend with true steel source scratches.
 # E mask extends into parts of B and has irregular polygon. Inside blade smooth edge rate topologically.
 b=cv2.GaussianBlur(B,(0,0),3.0)
 # sharpen edge color transition to make blade faceted with bevel reflecting light (not a painted ribbon)
 eb=np.clip(E*.19,0,1)*b
 out=out*(1-b[...,None])+metal_colors*b[...,None]
 out=out*(1-eb[...,None])+edge*eb[...,None]
 # Grip deep cold black remains original; enhance source natural texturing rather than overlay icons
 handle=np.clip(T*(1-B)*AL,0,1)
 shadow=np.stack([np.clip(20+base_l*65,0,110),np.clip(20+base_l*69,0,114),np.clip(25+base_l*76,0,128)],axis=2)
 handle_src=out*.65+shadow*.35
 out=out*(1-handle[...,None]*.62)+handle_src*(handle[...,None]*.62)
 # Ring gilding, preserving steel machined microtexture, purely material transformation
 ring=np.clip(R*AL,0,1)
 # gold polished ring (different fine-grain from blade) with crisp actual highlights
 m=(.52+base_l*1.13)[...,None]
 ring_tone=np.clip(cRing[None,None,:]*m+spec*color('#fff5d9')*.8,0,255)
 out=out*(1-ring[...,None])+ring_tone*ring[...,None]
 # hardware: source detail brightened like plated screw heads
 hw=np.clip(HARD*.75*AL,0,1)
 hw_color=np.clip(cScrew[None,None,:]*(.43+base_l*1.0)[...,None]+spec*45,0,255)
 out=out*(1-hw[...,None])+hw_color*hw[...,None]
 # final micro metal sparkle only where original luma reflects; no synthetic decal/lines
 metal_refl=np.clip((base_l-.67)/.28,0,1)[...,None]
 out=out+metal_refl*(b[...,None]*9+ring[...,None]*6)
 out=np.uint8(np.clip(out,0,255))
 rgba=np.dstack((out,np.uint8(alpha)))
 return Image.fromarray(rgba,'RGBA')

styles=['starfall']
for style in styles:
 im=make(style)
 im.save(P/'source'/f'karambit--{style}-working-2400.png',optimize=True)
 for w in [400,800,1600]:
  a=im.resize((w,w//2),Image.Resampling.LANCZOS)
  a.putalpha(orig.resize((w,w//2),Image.Resampling.LANCZOS).getchannel('A'))
  a.save(P/'renders'/'finishes'/f'karambit--{style}-{w}.webp',quality=94,alpha_quality=100,method=6)
 # single item preview same aspect as game stage
 sm=im.resize((1000,500),Image.Resampling.LANCZOS)
 bg=Image.new('RGBA',sm.size,(12,16,22,255));bg.alpha_composite(sm)
 bg.convert('RGB').save(P/'previews'/f'{style}-inspect.jpg',quality=93)

print('Rebuilt Karambit | Starfall with identical neutral silhouette')