#!/usr/bin/env python3
"""Generate full-coverage silhouette and metal/wood/other maps for all LootHub masters.

Outputs:
  <slug>--silhouette-1600.png: exact neutral source alpha
  <slug>--material-1600.png: RGBA labels red=metal, green=wood, blue=other;
  alpha is EXACTLY the original weapon silhouette. Every visible pixel is
  assigned to precisely one class. Uncertain regions default to other.

Usage: python scripts/build_material_maps.py [--check]
The profile rectangles are conservative draft material zones requiring art review.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw
from build_skin_lines import neutral

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'assets/skin-lines/materials'
SIZES=(1600,800)

def region(size,rects):
    mask=Image.new('L',size,0)
    drawer=ImageDraw.Draw(mask)
    for rect in rects:
        if not isinstance(rect,list) or len(rect)!=4 or not all(
          isinstance(n,(float,int)) and 0<=n<=1 for n in rect) or (
          rect[0]>rect[2] or rect[1]>rect[3]):
            raise ValueError('Invalid normalized material rectangle')
        drawer.rectangle((round(rect[0]*size[0]),round(rect[1]*size[1]),
            round(rect[2]*size[0]),round(rect[3]*size[1])),fill=255)
    return mask

def compose(source,profile):
    alpha=source.getchannel('A')
    visible=alpha.point(lambda a:255 if a else 0)
    w=profile['wear']
    metal=region(source.size,w['metalRects'])
    wood=region(source.size,w['woodRects'])
    other=region(source.size,w['polymerRects'])
    protected=region(source.size,profile.get('protectedRects',[])+w['protectedRects'])
    # Priority: protected/other -> wood -> metal. Never infer bare metal
    # from a paint-main mask or from grayscale color alone.
    wood=ImageChops.subtract(wood,ImageChops.lighter(other,protected))
    metal=ImageChops.subtract(metal,ImageChops.lighter(
        ImageChops.lighter(wood,other),protected))
    metal=ImageChops.multiply(metal,visible)
    wood=ImageChops.multiply(wood,visible)
    classified=ImageChops.lighter(metal,wood)
    remaining=ImageChops.subtract(visible,classified)
    other=ImageChops.lighter(other,remaining)
    other=ImageChops.multiply(other,visible)
    result=Image.merge('RGBA',(metal,wood,other,alpha))
    verify_pixels(result,alpha)
    return result,alpha

def verify_pixels(material,alpha):
    if material.getchannel('A').tobytes()!=alpha.tobytes():
        raise AssertionError('Material silhouette does not match master alpha')
    r,g,b,_=material.split()
    visible=alpha.point(lambda a:255 if a else 0)
    # Reject unclassified pixels AND multi-class overlap. This is strict
    # per-pixel equality, not only a bounding box or histogram check.
    channels=[r.tobytes(),g.tobytes(),b.tobytes()]
    expected=visible.tobytes()
    for i,v in enumerate(expected):
        total=(channels[0][i]==255)+(channels[1][i]==255)+(channels[2][i]==255)
        if total!=(1 if v else 0):
            raise AssertionError(f'Pixel {i}: expected exactly one material label')

def source_files():
    items=json.loads((ROOT/'assets/manifest.json').read_text())['items']
    p=json.loads((ROOT/'assets/skin-lines/paint-profiles.json').read_text())
    if len(items)!=24 or len(p['weapons'])!=24:
        raise ValueError('Every one of the 24 weapon masters needs a profile')
    return items,p['weapons']

def build(check=False):
    items,profiles=source_files()
    if not check:OUTPUT.mkdir(parents=True,exist_ok=True)
    summary={}
    for item in items:
        slug=item.get('modelSlug') or item['id'].removesuffix('--base')
        if slug not in profiles:raise ValueError('Missing material profile: '+slug)
        source=neutral(item,1600)
        material,alpha=compose(source,profiles[slug])
        colors=material.getchannel('R').histogram()[255],material.getchannel('G').histogram()[255],material.getchannel('B').histogram()[255]
        if not sum(colors):raise AssertionError('Empty silhouette: '+slug)
        summary[slug]=dict(zip(['metal','wood','other'],colors))
        sil_path=OUTPUT/f'{slug}--silhouette-1600.png'
        mat_path=OUTPUT/f'{slug}--material-1600.png'
        if check:
            if not sil_path.exists() or not mat_path.exists():
                raise FileNotFoundError('Missing generated material mask: '+slug)
            existing_alpha=Image.open(sil_path).convert('L')
            existing_material=Image.open(mat_path).convert('RGBA')
            if existing_alpha.tobytes()!=alpha.tobytes():
                raise AssertionError('Stale silhouette map for '+slug)
            if existing_material.tobytes()!=material.tobytes():
                raise AssertionError('Stale material segmentation map for '+slug)
        else:
            alpha.save(sil_path,optimize=True)
            material.save(mat_path,optimize=True)
    if len(summary)!=24:raise AssertionError('Incomplete material-map set')
    print(('Validated' if check else 'Generated'),len(summary),
      'full silhouettes and metal/wood/other classification maps')
    for slug,classes in summary.items():print(slug,classes)
    return summary

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    build(check=args.check)
