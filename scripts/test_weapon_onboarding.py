#!/usr/bin/env python3
"""Smoke-test staged onboarding without registering a 25th weapon in the live game."""
import json
import subprocess
import sys
import tempfile
import shutil
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SLUG = 'ci-unreleased-onboarding-probe'
STAGING = ROOT / 'assets/weapon-staging' / SLUG


def main():
    from sync_weapon_catalog import catalog_from_manifest
    protected_files = [
        'assets/manifest.json',
        'assets/skin-lines/paint-profiles.json',
        'assets/skin-lines/material-landmarks.json',
        'assets/weapon-catalog.js',
        'assets/skin-lines/paint-profile-data.js',
        'assets/skin-lines/line-data.js'
    ]
    original = {name: (ROOT / name).read_bytes() for name in protected_files}
    before = original['assets/manifest.json']
    catalog = catalog_from_manifest()
    assert len(catalog['catalog']) == len(catalog['modelSlugs'])
    assert len(catalog['catalog']) == len(json.loads(before)['items'])
    try:
        with tempfile.TemporaryDirectory() as tmp:
            image = Path(tmp) / 'probe.png'
            art = Image.new('RGBA', (600, 300))
            draw = ImageDraw.Draw(art)
            draw.rectangle((70, 110, 530, 150), fill=(80, 90, 98, 255))
            draw.rectangle((200, 150, 250, 275), fill=(110, 62, 35, 255))
            art.save(image)
            cmd = [sys.executable, str(ROOT / 'scripts/onboard_weapon.py'),
                   '--image', str(image), '--name', 'CI UNRELEASED',
                   '--slug', SLUG, '--tier', '0', '--value', '6']
            subprocess.run(cmd, cwd=ROOT, check=True, capture_output=True, text=True)
            for width in (400, 800, 1600):
                path = STAGING / f'{SLUG}-neutral-{width}.webp'
                with Image.open(path) as rendered:
                    assert rendered.size == (width, width // 2)
                    assert rendered.getchannel('A').getextrema()[0] == 0
            with Image.open(STAGING / 'material-1600.png') as material:
                assert material.size == (1600, 800)
                assert material.getpixel((800, 360))[:3] == (0, 0, 255)
            assert (STAGING / 'material-review.png').is_file()
            denied = subprocess.run(cmd + ['--publish'], cwd=ROOT,
                                    capture_output=True, text=True)
            assert denied.returncode != 0, 'Unreviewed weapon was published'
            # Exercise the real 25th-weapon route in this disposable CI checkout.
            review = Path(tmp) / 'approved-materials.json'
            points = Path(tmp) / 'landmarks.json'
            review.write_text(json.dumps({
                'paint': 'auto-material', 'protectDarkBelow': 16, 'patternScale': 1,
                'protectedRects': [],
                'wear': {
                    'metalRects': [[.12, .35, .89, .52]],
                    'woodRects': [[.31, .53, .44, .94]],
                    'polymerRects': [], 'protectedRects': [],
                    'reviewed': False, 'reviewStatus': 'unreviewed-draft'
                }
            }))
            points.write_text(json.dumps([['metal', .5, .43], ['wood', .37, .72]]))
            done = subprocess.run(cmd + ['--profile', str(review), '--landmarks',
                                         str(points), '--publish'], cwd=ROOT,
                                  capture_output=True, text=True)
            assert done.returncode == 0, done.stdout + done.stderr
            updated = json.loads((ROOT / 'assets/manifest.json').read_text())
            assert len(updated['items']) == len(json.loads(before)['items']) + 1
            assert updated['items'][-1]['weapon'] == 'CI UNRELEASED'
            for suffix in ('--silhouette-1600.png', '--material-1600.png'):
                assert (ROOT / 'assets/skin-lines/materials' / (SLUG + suffix)).is_file()
            node = subprocess.run(['node', 'tests/core.cjs'], cwd=ROOT,
                                  capture_output=True, text=True)
            assert node.returncode == 0, node.stdout[-4000:] + node.stderr[-4000:]
            audited = subprocess.run([sys.executable, 'scripts/audit_material_maps.py'],
                                     cwd=ROOT, capture_output=True, text=True)
            assert audited.returncode == 0, audited.stdout[-2000:] + audited.stderr[-2000:]
            print('PASS: 25th approved master, full maps, browser registry, Node gameplay')
        # The test restores the original live 24-weapon catalog in finally.
        assert SLUG not in json.loads((ROOT / 'assets/skin-lines/paint-profiles.json').read_text())['weapons']
        assert SLUG not in json.loads((ROOT / 'assets/skin-lines/material-landmarks.json').read_text())['weapons']
        print('PASS: transparent staging, alpha, conservative OTHER material and publish gate')
    finally:
        for name, content in original.items():
            (ROOT / name).write_bytes(content)
        for width in (400, 800, 1600):
            (ROOT / 'assets/renders/masters' / f'{SLUG}-neutral-{width}.webp').unlink(missing_ok=True)
        for suffix in ('--silhouette-1600.png', '--material-1600.png'):
            (ROOT / 'assets/skin-lines/materials' / (SLUG + suffix)).unlink(missing_ok=True)
        (ROOT / 'assets/skin-lines/masks' / f'{SLUG}--paint-main-1600.png').unlink(missing_ok=True)
        shutil.rmtree(STAGING, ignore_errors=True)


if __name__ == '__main__':
    main()
