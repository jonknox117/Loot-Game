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
    before = (ROOT / 'assets/manifest.json').read_bytes()
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
        assert (ROOT / 'assets/manifest.json').read_bytes() == before
        assert SLUG not in json.loads((ROOT / 'assets/skin-lines/paint-profiles.json').read_text())['weapons']
        assert SLUG not in json.loads((ROOT / 'assets/skin-lines/material-landmarks.json').read_text())['weapons']
        print('PASS: transparent staging, alpha, conservative OTHER material and publish gate')
    finally:
        shutil.rmtree(STAGING, ignore_errors=True)


if __name__ == '__main__':
    main()
