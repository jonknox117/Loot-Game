#!/usr/bin/env python3
"""Prepare original case/weapon art for LootHub's declarative case registry.

Requires Pillow: python -m pip install pillow
Example:
  python scripts/prepare_curated_case.py --case-id lavish --name Lavish \
    --closed path/to/closed.png --open path/to/open.png --price 75 \
    --skin "Thompson SMG:0:40=path/to/thompson.png" \
    --skin "M1911:1:110=path/to/m1911.png" \
    --skin "Mosin-Nagant:2:350=path/to/rifle.png" \
    --skin "Tactical Tomahawk:3:1050=path/to/tomahawk.png" \
    --skin "Double-Barrel Shotgun:4:4200=path/to/shotgun.png"

All inputs MUST already have a genuinely transparent background. This tool
does not erase backgrounds or redraw approved artwork: it only crops transparent
padding, scales the exact image, centers it and exports transparent WebP sizes.
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1]
SIZES_CASE = (400, 800, 1254)
SIZES_SKIN = (400, 800, 1600)
ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def catalog_slugs():
    source = (ROOT / "assets/weapon-catalog.js").read_text(encoding="utf-8")
    found = re.search(r"window\.LootHubWeaponCatalog\s*=\s*Object\.freeze\((\{.*\})\);\s*$", source, re.S)
    if not found:
        raise ValueError("Cannot parse weapon model names from assets/weapon-catalog.js")
    return json.loads(found.group(1))["modelSlugs"]


def read_approved_alpha(file: Path):
    if not file.is_file():
        raise ValueError(f"Missing approved source image: {file}")
    try:
        with Image.open(file) as raw:
            rgba = ImageOps.exif_transpose(raw).convert("RGBA")
    except (OSError, UnidentifiedImageError) as exc:
        raise ValueError(f"Cannot read source image {file}: {exc}") from exc
    alpha = rgba.getchannel("A")
    if alpha.getextrema()[0] > 16:
        raise ValueError(
            f"{file}: image appears opaque. Remove the white/black background "
            "from the original first; the converter must not destroy fine engraving."
        )
    w, h = rgba.size
    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    if any(alpha.getpixel(point) > 24 for point in corners):
        raise ValueError(f"{file}: expected transparent background in all four corners")
    mask = alpha.point(lambda value: 255 if value > 8 else 0)
    bbox = mask.getbbox()
    if bbox is None:
        raise ValueError(f"{file}: the entire artwork is transparent")
    return rgba.crop(bbox)


def encode_webp(original: Image.Image, pixels: int):
    # Square transparent canvas + object-fit:contain in the game ensures every
    # closed/open pose stays in frame on iPhone, irrespective of source ratio.
    edge = int(round(pixels * 0.055))
    max_dim = pixels - 2 * edge
    ratio = min(max_dim / original.width, max_dim / original.height)
    width = max(1, round(original.width * ratio))
    height = max(1, round(original.height * ratio))
    scaled = original.resize((width, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (pixels, pixels), (0, 0, 0, 0))
    canvas.alpha_composite(scaled, ((pixels - width) // 2, (pixels - height) // 2))
    output = io.BytesIO()
    canvas.save(output, format="WEBP", lossless=True, method=6)
    return output.getvalue()


def parse_skin(text: str, slugs: dict[str, str]):
    if "=" not in text:
        raise ValueError('Use --skin "Weapon name:tier:base=/path/to/transparent.png"')
    fields, file = text.split("=", 1)
    try:
        weapon, tier_text, base_text = fields.rsplit(":", 2)
        rarity, base = int(tier_text), int(base_text)
    except (ValueError, TypeError) as exc:
        raise ValueError(f"Invalid --skin value: {text}") from exc
    weapon = weapon.strip()
    if weapon not in slugs:
        raise ValueError(f'Weapon "{weapon}" is not registered. Choose a name from assets/weapon-catalog.js.')
    if rarity not in range(5) or not 1 <= base <= 100000000:
        raise ValueError(f"{weapon}: rarity must be 0–4 and base value must be 1–100,000,000")
    return weapon, rarity, base, Path(file).expanduser()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--case-id", required=True, help="lowercase ID, e.g. lavish")
    parser.add_argument("--name", help="display name for a new case, e.g. Lavish")
    parser.add_argument("--price", type=int, help="price of a new case in coins")
    parser.add_argument("--closed", type=Path, help="approved transparent closed-chest image")
    parser.add_argument("--open", type=Path, help="approved transparent open-chest image")
    parser.add_argument("--skin", action="append", default=[],
                        help='repeat "Weapon name:tier:base=/path/to/image.png"')
    parser.add_argument("--dry-run", action="store_true", help="verify and preview filenames without saving")
    parser.add_argument("--force", action="store_true", help="overwrite previously generated WebPs")
    args = parser.parse_args(argv)
    if not ID_RE.fullmatch(args.case_id):
        parser.error("case ID must use lowercase letters, numbers and hyphens")
    if not args.closed and not args.open and not args.skin:
        parser.error("Provide at least one artwork input: --closed, --open or --skin")
    if args.name is not None and not args.name.strip():
        parser.error("--name cannot be empty")
    if args.price is not None and not 1 <= args.price <= 100000000:
        parser.error("--price must be 1–100,000,000")
    slugs = catalog_slugs()
    skins = [parse_skin(v, slugs) for v in args.skin]
    if len(skins) > 200 or len({(w, args.name) for w, _, _, _ in skins}) != len(skins):
        parser.error("use between 1 and 200 unique registered weapons per curated case")
    planned = {}
    art = [(pose, filename, SIZES_CASE) for pose, filename in
           (("closed", args.closed), ("open", args.open)) if filename is not None]
    for pose, filename, sizes in art:
        rgba = read_approved_alpha(filename)
        for n in sizes:
            planned[ROOT / f"assets/cases/{args.case_id}-case-{pose}-{n}.webp"] = encode_webp(rgba, n)
    for weapon, _, _, filename in skins:
        rgba = read_approved_alpha(filename)
        model = slugs[weapon]
        for n in SIZES_SKIN:
            rel = f"assets/renders/lines/{args.case_id}/{model}--{args.case_id}-{n}.webp"
            planned[ROOT / rel] = encode_webp(rgba, n)
    collisions = [p for p in planned if p.exists()]
    if collisions and not args.force and not args.dry_run:
        parser.error(f"{len(collisions)} output files already exist; use --force to replace intentionally")
    for filename in planned:
        print(f"{'WOULD WRITE' if args.dry_run else 'PREPARED'} {filename.relative_to(ROOT)}")
    if not args.dry_run:
        for filename, data in planned.items():
            filename.parent.mkdir(parents=True, exist_ok=True)
            temp = filename.with_suffix(filename.suffix + ".tmp")
            try:
                temp.write_bytes(data)
                os.replace(temp, filename)
            finally:
                temp.unlink(missing_ok=True)
    if args.name and args.price and args.closed and args.open and skins:
        config = {
            "id": args.case_id,
            "name": args.name.strip(),
            "casePrice": args.price,
            "released": False,
            "description": f"Owner-approved {args.name.strip()} finishes.",
            "collectionId": f"{args.case_id}-v1",
            "collectionReward": 25,
            "items": [
                {"kind": "skin", "weapon": weapon, "skin": args.name.strip(),
                 "tier": rarity, "base": base}
                for weapon, rarity, base, _ in skins
            ],
        }
        print("\nCopy this object into EXTRA_CASES in assets/case-registry.js:")
        print(json.dumps(config, indent=2))
        print("\nKeep released:false until artwork, values and tests are approved.")
    else:
        print("\nArtwork-only update. Existing case definitions use the same filenames,")
        print("so replacing assets does not require changing the renderer or market code.")
    print("Run node tests/core.cjs and verify every approved frame in-game.")



if __name__ == "__main__":
    main()
