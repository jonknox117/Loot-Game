#!/usr/bin/env python3
"""Export LootHub paint/material profiles for file:// and GitHub Pages browsing.

The JSON is the source of truth; the browser registry is generated, never edited.
Run: python scripts/export_paint_profiles.py [--check]
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/skin-lines/paint-profiles.json"
OUTPUT = ROOT / "assets/skin-lines/paint-profile-data.js"
PREFIX = "/* Generated from paint-profiles.json. Keep in sync with the source profiles. */\n"
PROLOGUE = "window.LootHubPaintProfiles = Object.freeze("


def render():
    data = json.loads(SOURCE.read_text("utf-8"))
    if data.get('schemaVersion') != 1 or not isinstance(data.get('weapons'), dict):
        raise ValueError('Invalid material-profile schema')
    manifest = json.loads((ROOT / 'assets/manifest.json').read_text('utf-8'))
    slugs = [item.get('modelSlug') or item['id'].removesuffix('--base') for item in manifest['items']]
    if not slugs or len(set(slugs)) != len(slugs) or set(slugs) != set(data['weapons']):
        raise ValueError('Profiles must match every unique manifest weapon')
    for slug, item in data["weapons"].items():
        wear = item.get("wear")
        if not isinstance(wear, dict):
            raise ValueError(f"Missing material profile: {slug}")
        for key in ("metalRects", "woodRects", "polymerRects", "protectedRects"):
            rects = wear.get(key)
            if not isinstance(rects, list):
                raise ValueError(f"Bad material rectangles for {slug}.{key}")
            for rect in rects:
                if (not isinstance(rect, list) or len(rect) != 4
                        or not all(isinstance(v, (int, float))
                                   and 0 <= v <= 1 for v in rect)
                        or rect[0] > rect[2] or rect[1] > rect[3]):
                    raise ValueError(f"Invalid normalized rectangle in {slug}.{key}")
    return PREFIX + PROLOGUE + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ");\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    result = render()
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text("utf-8") != result:
            raise SystemExit("paint-profile-data.js is out of sync; re-export profiles")
        print("PASS: 24 paint/material profiles match browser registry")
    else:
        OUTPUT.write_text(result, encoding="utf-8")
        print("Exported 24 paint/material profiles")


if __name__ == "__main__":
    main()
