#!/usr/bin/env python3
"""Visual and semantic QA for all 24 weapon material maps.

Verify every known reference point is inside the source silhouette and has the
expected material category. Draw an all-weapon contact sheet for visual review.
Usage: python scripts/audit_material_maps.py [--output tests/material-review-sheet.png]
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from build_skin_lines import neutral
from build_material_maps import compose, source_files, verify_pixels, OUTPUT

ROOT=Path(__file__).resolve().parents[1]
LANDMARKS=ROOT/'assets/skin-lines/material-landmarks.json'
RGB={ 'metal':(255,0,0), 'wood':(0,255,0), 'other':(0,0,255) }

def audit(output=None):
    landmarks=json.loads(LANDMARKS.read_text('utf-8'))
    items,profiles=source_files()
    expected=set(profiles)
    actual=set(landmarks.get('weapons',{}))
    if expected!=actual:
        raise AssertionError('Each master needs landmarks. Missing: '+
            str(sorted(expected-actual))+' extra: '+str(sorted(actual-expected)))
    count=0
    exceptions=[]
    blocks=[]
    for item in items:
        slug=item.get('modelSlug') or item['id'].removesuffix('--base')
        source=neutral(item,1600)
        map_path=OUTPUT/f'{slug}--material-1600.png'
        alpha_path=OUTPUT/f'{slug}--silhouette-1600.png'
        material=Image.open(map_path).convert('RGBA')
        silhouette=Image.open(alpha_path).convert('L')
        if material.size!=source.size or silhouette.size!=source.size:
            raise AssertionError('Source/map size mismatch '+slug)
        if silhouette.tobytes()!=source.getchannel('A').tobytes():
            raise AssertionError('Full source-alpha mismatch '+slug)
        verify_pixels(material,silhouette)
        counts={k:material.getchannel(c).histogram()[255] for k,c in
          [('metal','R'),('wood','G'),('other','B')]}
        for label,x,y in landmarks['weapons'][slug]:
            count+=1
            ix=min(1599,int(x*1600))
            iy=min(799,int(y*800))
            px=material.getpixel((ix,iy))
            if px[3]<100 or tuple(px[:3])!=RGB[label]:
                exceptions.append(f'{slug} at {x:.3f},{y:.3f}: expected {label}, got {px}')
        # Show original, raw material labels and composited version at native 400px.
        original=source.resize((400,200),Image.Resampling.LANCZOS)
        painted=material.resize((400,200),Image.Resampling.NEAREST)
        back=Image.new('RGBA',(400,200),(22,29,40,255))
        plain=Image.alpha_composite(back,original)
        overlay=painted.copy()
        overlay.putalpha(overlay.getchannel('A').point(lambda v:int(v*.42)))
        mixed=Image.alpha_composite(plain,overlay)
        blocks.append((slug,plain.convert('RGB'),mixed.convert('RGB'),counts))
    if exceptions:
        raise AssertionError('Semantic material anchors failed:\n'+'\n'.join(exceptions))
    if count<48:raise AssertionError('Too few independent reference points')
    print('PASS:',len(items),'complete silhouettes,',count,
      'human-selected semantic landmarks, 3 mutually exclusive materials')
    if output:
        dest=Path(output)
        dest.parent.mkdir(parents=True,exist_ok=True)
        cols=3
        cw,ch=420,460
        rows=(len(blocks)+cols-1)//cols
        sheet=Image.new('RGB',(cols*cw,rows*ch),(13,19,30))
        d=ImageDraw.Draw(sheet)
        for i,(slug,plain,mixed,counts) in enumerate(blocks):
            x=i%cols*cw+10
            y=i//cols*ch+8
            d.text((x+3,y+2),slug+' | metal '+str(counts['metal'])+
                   ' wood '+str(counts['wood'])+' other '+str(counts['other']),
                   fill=(233,235,239))
            sheet.paste(plain,(x,y+20))
            sheet.paste(mixed,(x,y+224))
            d.text((x+4,y+425),'TOP original | BOTTOM material overlay',
                   fill=(180,198,209))
        sheet.save(dest,optimize=True)
        print('Wrote review sheet to',dest)
    return count

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',default=None)
    args=parser.parse_args()
    audit(args.output)
