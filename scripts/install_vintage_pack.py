#!/usr/bin/env python3
"""Install the 21 lossless owner-approved Vintage WebP renders safely.

This release step intentionally requires the exact prepared ZIP archive.
No synthetic replacements, missing art or partial releases are permitted.
Usage: python scripts/install_vintage_pack.py --archive assets/vintage-release.zip
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import zipfile

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ENTRY = ROOT / "assets/case-registry.js"
CASE = "vintage"
POSES = {f"assets/cases/vintage-case-{pose}-{n}.webp"
         for pose in ("closed", "open") for n in (400, 800, 1254)}
SLUGS = ("colt-45-revolver", "fn-fal", "m60", "m1-garand", "butterfly-knife")
SKINS = {f"assets/renders/lines/vintage/{slug}--vintage-{n}.webp"
         for slug in SLUGS for n in (400, 800, 1600)}
EXPECTED = POSES | SKINS
DRAFT = "id:'vintage',name:'Vintage',casePrice:75,released:false"
LIVE = "id:'vintage',name:'Vintage',casePrice:75,released:true"


def validate_member(path: str, data: bytes, declared_hash: str):
    if path not in EXPECTED:
        raise ValueError(f"Unexpected release asset: {path}")
    if not isinstance(declared_hash, str) or hashlib.sha256(data).hexdigest() != declared_hash:
        raise ValueError(f"SHA-256 mismatch: {path}")
    if not data.startswith(b"RIFF") or data[8:12] != b"WEBP":
        raise ValueError(f"Non-WebP Vintage image: {path}")
    import io
    with Image.open(io.BytesIO(data)) as img:
        if img.format != "WEBP" or img.mode != "RGBA":
            raise ValueError(f"Expected transparent RGBA WebP: {path}")
        px = int(path.rsplit("-", 1)[1].split(".")[0])
        if img.size != (px, px):
            raise ValueError(f"Incorrect resolution for {path}: {img.size}")
        w, h = img.size
        alpha = img.getchannel("A")
        if any(alpha.getpixel(c) > 24 for c in
               ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))):
            raise ValueError(f"Opaque corner in {path}")
        if alpha.getbbox() is None:
            raise ValueError(f"Blank render: {path}")


def install(archive: Path) -> int:
    if not archive.is_file():
        raise ValueError(f"Missing Vintage release archive: {archive}")
    current = ENTRY.read_text(encoding="utf-8")
    if DRAFT not in current and LIVE not in current:
        raise ValueError("Vintage registry entry is missing or edited unexpectedly")
    with zipfile.ZipFile(archive, "r") as package:
        paths = {i.filename for i in package.infolist() if not i.is_dir()}
        if paths != EXPECTED | {"manifest.json"}:
            missing = EXPECTED - paths
            unexpected = paths - EXPECTED - {"manifest.json"}
            raise ValueError(f"Wrong archive contents; missing={sorted(missing)} extra={sorted(unexpected)}")
        manifest = json.loads(package.read("manifest.json"))
        if manifest.get("case") != "Vintage":
            raise ValueError("This archive is not the Vintage source art")
        records = manifest.get("files")
        if not isinstance(records, list) or len(records) != len(EXPECTED):
            raise ValueError("Vintage archive needs a complete 21-file checksum manifest")
        declared = {item["path"]: item["sha256"] for item in records}
        if len(declared) != len(EXPECTED) or set(declared) != EXPECTED:
            raise ValueError("Duplicate or missing manifest path")
        validated = {}
        if sum(i.file_size for i in package.infolist()) > 25000000:
            raise ValueError("Release package exceeds the 25 MB budget")
        for path in sorted(EXPECTED):
            data = package.read(path)
            validate_member(path, data, declared[path])
            target = ROOT / path
            if target.exists() and target.read_bytes() != data:
                raise ValueError(f"Will not overwrite a different approved asset: {path}")
            validated[target] = data
    # Publish only after every item has been checked. Preexisting contents are
    # preserved, and the old four cases retain their exact registry entries.
    for target, data in validated.items():
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            target.write_bytes(data)
    if DRAFT in current:
        ENTRY.write_text(current.replace(DRAFT, LIVE, 1), encoding="utf-8")
    # Only announce the new version once the approved image set is installed.
    index = ROOT / "index.html"
    source = index.read_text(encoding="utf-8")
    previous = "0.8.0 · Smart Inventory"
    if previous in source:
        index.write_text(source.replace(previous, "0.8.1 · Vintage Case", 1), encoding="utf-8")
    print(f"READY: Vintage enabled with {len(validated)} verified original WebP renders")
    return len(validated)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--archive", type=Path, required=True)
    args = p.parse_args()
    install(args.archive if args.archive.is_absolute() else ROOT / args.archive)


if __name__ == "__main__":
    main()
