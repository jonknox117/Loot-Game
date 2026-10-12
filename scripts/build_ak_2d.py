from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageOps
import numpy as np, cv2, json, os, sys
from pathlib import Path
root=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parent
p=root/'source'
src=Image.open(p/'ak-47-neutral-original.png').convert('RGBA')
variants={'ghostline':Image.open(p/'ak-47-ghostline-source.png').convert('RGBA'), 'crimson-circuit':Image.open(p/'ak-47-crimson-circuit-source.png').convert('RGBA')}
W,H=2400,1200
SW,SH=src.size
# Fit 88.5% of the width without modifying the base silhouette or warping proportions.
scale=(W*0.885)/SW
size=(round(SW*scale),round(SH*scale));x=(W-size[0])//2;y=(H-size[1])//2

def frame(im):
 out=Image.new('RGBA',(W,H),(0,0,0,0))
 im=im.resize(size,Image.Resampling.LANCZOS)
 out.alpha_composite(im,(x,y))
 return out
neutral=frame(src)
neutral.save(root/'source/ak-47-neutral-2400.png',optimize=True)
alpha=np.array(neutral.getchannel('A'),dtype=np.uint8)
# Paintable material groups, in original pixel coords.
polygons={
 'stock':[(10,323),(278,315),(463,307),(473,356),(473,400),(346,442),(65,548),(14,536)],
 'receiver':[(466,250),(920,244),(982,262),(988,390),(760,414),(471,401)],
 'grip':[(487,384),(633,389),(611,534),(557,643),(440,624)],
 'magazine':[(747,374),(858,382),(910,498),(968,585),(1054,673),(995,753),(920,702),(815,582),(778,501)],
 'handguard':[(968,244),(1298,238),(1320,333),(1277,392),(985,397)],
 'barrel':[(1298,270),(1755,279),(1755,348),(1304,352)]
}
masks={}
for name,points in polygons.items():
 coords=[(round(px*scale+x),round(py*scale+y)) for px,py in points]
 mask=Image.new('L',(W,H),0)
 ImageDraw.Draw(mask).polygon(coords,fill=255)
 mask=mask.filter(ImageFilter.GaussianBlur(radius=3.3))
 mask=ImageChops.multiply(mask,neutral.getchannel('A'))
 masks[name]=mask
 mask.save(root/f'source/mask-{name}.png')
base_arr=np.array(neutral,dtype=np.float32)
base_alpha=base_arr[:,:,3:4]
for name,im in variants.items():
 tmp=frame(im)
 arr=np.array(tmp,dtype=np.float32)
 # This source is already aligned with the neutral model (~95-97% silhouette IoU),
 # but we deliberately enforce the *exact same* alpha mask and silhouette.
 # Region-specific transfers stop generated variation from changing barrel, optics, or metal hardware.
 out=base_arr.copy()
 strength={'stock':.95,'receiver':.87,'grip':.88,'magazine':.88,'handguard':.90}
 for region,opacity in strength.items():
  mask=np.array(masks[region],dtype=np.float32)/255
  weight=np.clip(mask*opacity,0,1)[:,:,None]
  out[:,:,:3]=out[:,:,:3]*(1-weight)+arr[:,:,:3]*weight
 out[:,:,3:4]=base_alpha
 result=Image.fromarray(np.uint8(np.clip(out,0,255)),'RGBA')
 result.save(root/f'finishes/ak-47--{name}-working-2400.png',optimize=True)
 for w in [400,800,1600]:
  version=result.resize((w,w//2),Image.Resampling.LANCZOS)
  version.save(root/f'renders/ak-47--{name}-{w}.webp','WEBP',quality=92,method=6,exact=True)
 for tag,version in [('preview',result.resize((800,400),Image.Resampling.LANCZOS))]:
  checker=Image.new('RGB',version.size,(28,34,45));d=ImageDraw.Draw(checker)
  for yy in range(0,400,32):
   for xx in range(0,800,32):
    if ((xx//32)+(yy//32))%2==0:d.rectangle((xx,yy,xx+31,yy+31),fill=(44,52,65))
  checker.paste(version,mask=version.getchannel('A'))
  checker.save(root/f'previews/ak-47--{name}-{tag}.jpg',quality=90)
for w in [400,800,1600]:
 version=neutral.resize((w,w//2),Image.Resampling.LANCZOS)
 version.save(root/f'renders/ak-47-neutral-{w}.webp','WEBP',quality=92,method=6,exact=True)
recipe={
 'schemaVersion':1,'model':'AK-47','neutralSource':'source/ak-47-neutral-2400.png','renderMasterResolution':[2400,1200],
 'sourceType':'previously generated original AI AK-47 art, RGB finish variants transferred to canonical master, masks spatially aligned',
 'matching':'All output alpha channels derive from one neutral master; identical silhouette across finishes',
 'patterns':{'Ghostline':'ice-blue ghost/spectral texture transfer','Crimson Circuit':'red circuitry transfer'},
 'exports':[400,800,1600], 'widthUsePercent':88.5,
 'warnings':['AI-generated source is not CAD/manufacturer-exact geometry','Source variants are generated art, converted into one canonical silhouette by mask-based blending']}
(root/'source/recipe.json').write_text(json.dumps(recipe,indent=2))
for f in sorted((root/'renders').glob('*.webp')):
 im=Image.open(f);print(f.name, im.size,round(f.stat().st_size/1024,1),'KB',im.convert('RGBA').getchannel('A').getextrema())