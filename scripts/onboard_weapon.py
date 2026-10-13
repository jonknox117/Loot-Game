#!/usr/bin/env python3
"""Stage a transparent weapon image; publish only with a reviewed material profile.

Staging does NOT affect drops, item IDs, prices or saves. Publishing adds one new
neutral master to the existing catalog; subsequent skin/wear builds discover it.
"""
import argparse
import json
import re
from pathlib import Path

from PIL import Image, ImageChops, ImageOps
from build_skin_lines import fit_canvas, paint_mask
from build_material_maps import compose, verify_pixels

ROOT = Path(__file__).resolve().parents[1]
STAGING = ROOT / 'assets/weapon-staging'
MASTER = ROOT / 'assets/renders/masters'
PROFILES = ROOT / 'assets/skin-lines/paint-profiles.json'
LANDMARKS = ROOT / 'assets/skin-lines/material-landmarks.json'
MANIFEST = ROOT / 'assets/manifest.json'
KINDS = {'metal': (255, 0, 0), 'wood': (0, 255, 0), 'other': (0, 0, 255)}
RARITY = ('Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary')


def save_master(source, root, slug):
    root.mkdir(parents=True, exist_ok=True)
    for width in (400, 800, 1600):
        image = fit_canvas(source, width)
        image.save(root / f'{slug}-neutral-{width}.webp',
                   'WEBP', quality=94, method=4, exact=True, alpha_quality=100)


def default_profile():
    # Unknown materials are deliberately OTHER: never guess rustable metal.
    return {'paint': 'auto-material', 'protectDarkBelow': 16,
            'patternScale': 1, 'protectedRects': [],
            'wear': {'metalRects': [], 'woodRects': [], 'polymerRects': [],
                     'protectedRects': [], 'reviewed': False,
                     'reviewStatus': 'unreviewed-draft'}}


def validate_landmarks(material, points):
    if not isinstance(points, list) or len(points) < 2:
        raise ValueError('Provide at least two human-reviewed material anchor points')
    if not any(isinstance(p, list) and p[0] in ('metal', 'wood') for p in points
               if len(p) == 3):
        raise ValueError('At least one source point must identify metal or wood')
    for anchor in points:
        if (not isinstance(anchor, list) or len(anchor) != 3 or
            anchor[0] not in KINDS or
            not all(type(n) in (int, float) and 0 < n < 1 for n in anchor[1:])):
            raise ValueError('Invalid landmark: ' + repr(anchor))
        kind, x, y = anchor
        rgba = material.getpixel((min(1599, int(x * 1600)),
                                  min(799, int(y * 800))))
        if rgba[3] < 100 or tuple(rgba[:3]) != KINDS[kind]:
            raise ValueError(f'Landmark mismatch for {kind} at {x},{y}: {rgba}')


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--image', type=Path, required=True,
                   help='Transparent source PNG/WebP with the entire side-view weapon')
    p.add_argument('--name', required=True, help='Unique in-game weapon name')
    p.add_argument('--slug', required=True, help='Unique lowercase hyphenated ID')
    p.add_argument('--tier', required=True, type=int, choices=range(5))
    p.add_argument('--value', required=True, type=int, help='Positive base coin value')
    p.add_argument('--emoji', default='🔫')
    p.add_argument('--profile', type=Path, help='Reviewed JSON paint/material profile')
    p.add_argument('--landmarks', type=Path, help='Reviewed JSON [[kind,x,y], ...]')
    p.add_argument('--publish', action='store_true',
                   help='Owner-approved publication; never implied by staging')
    args = p.parse_args()
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', args.slug):
        p.error('Slug must be lowercase and hyphenated')
    if args.value <= 0 or not args.name.strip():
        p.error('Supply a positive value and a weapon name')
    if args.image.suffix.lower() not in ('.png', '.webp') or not args.image.is_file():
        p.error('Source must be an existing PNG or WebP')
    source = Image.open(args.image).convert('RGBA')
    alpha = source.getchannel('A')
    if min(source.size) < 100 or not (0 in alpha.getextrema() and alpha.getextrema()[1] > 0):
        p.error('Weapon master must have actual transparent and visible pixels, >=100px')
    # Fit the source once. Never crop or stretch the weapon.
    source = fit_canvas(source, 1600)
    manifest = json.loads(MANIFEST.read_text('utf-8'))
    profiles = json.loads(PROFILES.read_text('utf-8'))
    landmarks = json.loads(LANDMARKS.read_text('utf-8'))
    if args.name in (v['weapon'] for v in manifest['items']) or args.slug in (
            (v.get('modelSlug') or v['id'].removesuffix('--base')) for v in manifest['items']):
        p.error('Weapon name or slug already exists; onboarding never overwrites an original')
    if args.slug in profiles['weapons'] or args.slug in landmarks['weapons']:
        p.error('Weapon slug already has a profile or landmarks')
    if args.profile:
        profile = json.loads(args.profile.read_text('utf-8'))
    else:
        profile = default_profile()
    if not isinstance(profile, dict) or not isinstance(profile.get('wear'), dict):
        p.error('Invalid paint/material profile')
    for field in ('metalRects', 'woodRects', 'polymerRects', 'protectedRects'):
        if not isinstance(profile['wear'].get(field), list):
            p.error('Profile missing ' + field)
    if not isinstance(profile.get('protectedRects', []), list):
        p.error('Invalid protectedRects')
    # Round-trip the actual file encoding before mapping for exact alpha parity.
    draft_dir = STAGING / args.slug
    save_master(source, draft_dir, args.slug)
    rendered = Image.open(draft_dir / f'{args.slug}-neutral-1600.webp').convert('RGBA')
    mapped, silhouette = compose(rendered, profile)
    verify_pixels(mapped, rendered.getchannel('A'))
    mapped.save(draft_dir / 'material-1600.png', optimize=True)
    silhouette.save(draft_dir / 'silhouette-1600.png', optimize=True)
    paint_mask(rendered, profile).save(draft_dir / 'paint-main-1600.png', optimize=True)
    # A staging report contains the original and a translucent map overlay for review.
    legend = Image.new('RGBA', rendered.size, (22, 29, 40, 255))
    original = Image.alpha_composite(legend, rendered)
    overlay = mapped.copy()
    overlay.putalpha(overlay.getchannel('A').point(lambda a: round(a * .4)))
    Image.alpha_composite(original, overlay).save(draft_dir / 'material-review.png')
    (draft_dir / 'profile-template.json').write_text(
        json.dumps(profile, indent=2) + '\n', encoding='utf-8')
    if not args.publish:
        print('STAGED ONLY:', draft_dir)
        print('Review the map; edit profile-template.json and create semantic landmarks.')
        print('Re-run with --profile, --landmarks and --publish only after approval.')
        return
    if not args.profile or not args.landmarks:
        p.error('Publishing requires --profile and --landmarks, plus explicit --publish')
    points = json.loads(args.landmarks.read_text('utf-8'))
    validate_landmarks(mapped, points)
    if not any(profile['wear'][part] for part in ('metalRects', 'woodRects')):
        p.error('Reviewed profile needs at least one metal or wood region')
    # Treat the publish flag as explicit owner acceptance of the reviewed segmentation.
    profile['wear']['reviewed'] = True
    profile['wear']['reviewStatus'] = 'owner-reviewed'
    for width in (400, 800, 1600):
        target = MASTER / f'{args.slug}-neutral-{width}.webp'
        if target.exists():
            p.error('Won\'t overwrite existing master: ' + str(target))
    MASTER.mkdir(parents=True, exist_ok=True)
    for width in (400, 800, 1600):
        (MASTER / f'{args.slug}-neutral-{width}.webp').write_bytes(
            (draft_dir / f'{args.slug}-neutral-{width}.webp').read_bytes())
    from build_material_maps import build as build_material_maps
    from build_skin_lines import build as build_skin_lines, verify as verify_skins
    from export_paint_profiles import render as export_profile_data, OUTPUT as PROFILE_JS
    from sync_weapon_catalog import render as export_catalog, OUTPUT as CATALOG_JS
    path = f'assets/renders/masters/{args.slug}-neutral-1600.webp'
    manifest['items'].append({
        'id': args.slug + '--base', 'weapon': args.name, 'modelSlug': args.slug,
        'kind': 'weapon', 'displayName': args.name, 'tier': args.tier,
        'rarity': RARITY[args.tier], 'baseValue': args.value, 'emoji': args.emoji,
        'finish': None, 'skin': None, 'status': 'approved-user-supplied-base-master-live',
        'hasCosmeticSkin': False, 'master': path,
        'renderMode': 'transparent-webp-file',
        'inspection': path,
        'inventory': path.replace('-1600.webp', '-800.webp'),
        'thumbnail': path.replace('-1600.webp', '-400.webp'),
        'sourceType': 'user-supplied-original-image'
    })
    manifest['neutralMasterPipeline']['baseModelCount'] = len(manifest['items'])
    manifest['neutralMasterPipeline'].setdefault('originalWebPModels', []).append(args.slug)
    manifest['catalogMode'] = 'base-weapon-models-plus-ten-user-approved-skins'
    manifest['assetStatus'] = f"{len(manifest['items'])}-approved-neutral-masters"
    manifest['notes'] = ('Approved neutral base masters plus existing separately approved skins; '
                         'new master added without replacing any item, save, wear or existing artwork.')
    profiles['weapons'][args.slug] = profile
    landmarks['weapons'][args.slug] = points
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n',
                        encoding='utf-8')
    PROFILES.write_text(json.dumps(profiles, indent=2, ensure_ascii=False) + '\n',
                        encoding='utf-8')
    LANDMARKS.write_text(json.dumps(landmarks, indent=2, ensure_ascii=False) + '\n',
                         encoding='utf-8')
    CATALOG_JS.write_text(export_catalog(), encoding='utf-8')
    PROFILE_JS.write_text(export_profile_data(), encoding='utf-8')
    build_material_maps()
    build_skin_lines()
    verify_skins()
    print('PUBLISHED:', args.name, '(tier', args.tier, ', base', args.value, ')')
    print('Run python scripts/audit_material_maps.py and node tests/core.cjs before merge')


if __name__ == '__main__':
    main()
