#!/usr/bin/env python3
"""Synchronize the in-browser weapon catalog and art/model registries from assets/manifest.json.

Run python scripts/sync_weapon_catalog.py after approving a new master;
use --check in CI to prevent manual registries from drifting.
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'assets/manifest.json'
OUTPUT = ROOT / 'assets/weapon-catalog.js'
PREFIX = '/* Generated from assets/manifest.json; do not edit manually. */\nwindow.LootHubWeaponCatalog = Object.freeze('


def catalog_from_manifest():
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    items = manifest.get('items')
    if not isinstance(items, list) or not items:
        raise ValueError('Weapon manifest must have at least one master')
    names, slugs, ids = set(), set(), set()
    catalog, model_slugs, neutral_models, file_masters = [], {}, {}, {}
    for item in items:
        name = item['weapon']
        slug = item.get('modelSlug') or item['id'].removesuffix('--base')
        if not isinstance(name, str) or not name.strip() or name in names:
            raise ValueError('Blank or duplicate weapon name: ' + repr(name))
        if not isinstance(slug, str) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug) or slug in slugs:
            raise ValueError('Invalid or duplicate weapon slug: ' + repr(slug))
        # Existing original IDs do not always equal their art slugs
        # (e.g. 12-gauge-pump-shotgun -> pump-shotgun). Preserve save IDs.
        if (not isinstance(item['id'], str) or not item['id'].endswith('--base') or
            item['id'] in ids or item.get('kind') != 'weapon'):
            raise ValueError('Weapon ID/kind mismatch for ' + name)
        if type(item['tier']) is not int or not 0 <= item['tier'] <= 4:
            raise ValueError('Invalid rarity tier for ' + name)
        if type(item['baseValue']) not in (float, int) or item['baseValue'] <= 0:
            raise ValueError('Invalid baseValue for ' + name)
        master = item['master']
        if not isinstance(master, str) or not master.startswith('assets/'):
            raise ValueError('Invalid source path for ' + name)
        target = (ROOT / master).resolve()
        if not target.is_relative_to((ROOT / 'assets').resolve()) or not target.is_file():
            raise ValueError('Missing or unsafe weapon master ' + master)
        mode = item['renderMode']
        if mode == 'transparent-webp-file':
            if not master.endswith('-1600.webp'):
                raise ValueError('File master must point to -1600.webp: ' + name)
            file_masters[name] = master
            for width in (400, 800, 1600):
                if not (ROOT / master.replace('-1600.webp', f'-{width}.webp')).is_file():
                    raise ValueError(f'Missing {width}px export for {name}')
        elif mode == 'transparent-webp-data-uri':
            neutral_models[name] = slug
        else:
            raise ValueError('Unknown renderMode for ' + name)
        names.add(name)
        ids.add(item['id'])
        slugs.add(slug)
        catalog.append([name, item['tier'], item['baseValue'], item.get('emoji', '🔫')])
        model_slugs[name] = slug
    if not all(any(row[1] == tier for row in catalog) for tier in range(5)):
        raise ValueError('Each published rarity needs an available base weapon')
    if manifest.get('neutralMasterPipeline', {}).get('baseModelCount') != len(items):
        raise ValueError('neutralMasterPipeline.baseModelCount is out of sync')
    return {'catalog': catalog, 'modelSlugs': model_slugs,
            'neutralModels': neutral_models, 'fileMasters': file_masters}


def render():
    return PREFIX + json.dumps(catalog_from_manifest(), ensure_ascii=False, separators=(',', ':')) + ');\n'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    source = render()
    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_text(encoding='utf-8') != source:
            raise SystemExit('assets/weapon-catalog.js differs from assets/manifest.json')
    else:
        OUTPUT.write_text(source, encoding='utf-8')
    print(('Verified' if args.check else 'Exported') + ' weapon catalog')


if __name__ == '__main__':
    main()
