#!/usr/bin/env python3
"""LootHub v0.7.3: audit the *pixels* of every published case/weapon illustration.

This is read-only. Approved source images and rendered WebPs are never modified.
Run: python scripts/audit_artwork_integrity.py
Requires Pillow; use --output-dir PATH to store the review sheet and JSON report.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1]
RESOLUTIONS = {400, 800, 1254, 1600}
ALPHA_THRESHOLD = 32
MASK_SIZE = 96


def registered_art():
    """Use the real runtime registry, not a duplicated list of case IDs."""
    code = r"""
const fs=require('fs'),vm=require('vm');
const context=vm.createContext({window:{}});
for(const name of ['assets/weapon-catalog.js','assets/cartel-case.js',
                   'assets/spec-ops-case.js','assets/case-registry.js']){
 vm.runInContext(fs.readFileSync(name,'utf8'),context,{filename:name,timeout:10000});
}
const r=context.window.LootHubCaseRegistry;
const result={cases:[],paths:[]};
for(const c of r.all()){
 if(!c.released)continue;
 result.cases.push(c.id);
 for(const pose of ['closed','open'])for(const px of r.DEFAULT_CASE_SIZES)
   result.paths.push(r.chestImage(c.id,pose,px));
 if(c.skinArt==='webp')for(const item of c.items)
   for(const px of r.DEFAULT_SKIN_SIZES)result.paths.push(r.skinImage(item,px));
}
console.log(JSON.stringify(result));
"""
    result = subprocess.run(
        ["node", "-e", code], cwd=ROOT, check=True, text=True,
        capture_output=True, timeout=30
    )
    return json.loads(result.stdout)


def gather():
    expected = registered_art()
    candidates = set()
    for directory in ("assets/cases", "assets/renders"):
        candidates.update(p for p in (ROOT / directory).rglob("*.webp"))
    candidates.update(ROOT / path for path in expected["paths"])
    embedded = sorted((ROOT / "assets/skins").glob("*.js"))
    return expected, sorted(candidates), embedded


def bytes_of_embedded(path):
    source = path.read_text(encoding="utf-8")
    match = re.search(r'window\.LootHubSkinArt\[[^\]]+\]\s*=\s*(\{.*\})\s*;\s*$', source, re.S)
    if match is None:
        raise ValueError("Cannot read embedded approved skin JSON")
    obj = json.loads(match.group(1))
    if set(obj) != {"400", "800", "1600"}:
        raise ValueError("Embedded skin must have 400/800/1600 originals")
    return {int(k): base64.b64decode(v, validate=True) for k, v in obj.items()}


def open_webp(value, name):
    try:
        if isinstance(value, Path):
            with Image.open(value) as src:
                if src.format != "WEBP":
                    raise ValueError("Not WebP")
                return src.convert("RGBA")
        with Image.open(io.BytesIO(value)) as src:
            if src.format != "WEBP":
                raise ValueError("Not WebP")
            return src.convert("RGBA")
    except (OSError, UnidentifiedImageError) as exc:
        raise ValueError(f"Cannot decode WebP: {exc}") from exc


def mask_alpha(image):
    return image.getchannel("A").point(lambda v: 255 if v >= ALPHA_THRESHOLD else 0)


def bounds_and_alpha(image):
    alpha = image.getchannel("A")
    width, height = image.size
    bbox = mask_alpha(image).getbbox()
    if bbox is None:
        raise ValueError("No visible artwork")
    transparent = alpha.histogram()[:ALPHA_THRESHOLD]
    clear_ratio = sum(transparent) / (width * height)
    corners = [alpha.getpixel(x) for x in
               ((0, 0), (width-1, 0), (0, height-1), (width-1, height-1))]
    if max(corners) >= ALPHA_THRESHOLD:
        raise ValueError("Nontransparent corner; possible baked background or crop")
    if clear_ratio < .035:
        raise ValueError("Insufficient transparent area; possible baked backdrop")
    margins = (bbox[0] / width, bbox[1] / height,
               (width-bbox[2]) / width, (height-bbox[3]) / height)
    return bbox, round(clear_ratio, 4), margins


def silhouette_similarity(a, b):
    am = mask_alpha(a).resize((MASK_SIZE, MASK_SIZE), Image.Resampling.LANCZOS)
    bm = mask_alpha(b).resize((MASK_SIZE, MASK_SIZE), Image.Resampling.LANCZOS)
    aa = am.tobytes()
    bb = bm.tobytes()
    intersection = sum(x > 127 and y > 127 for x, y in zip(aa, bb))
    union = sum(x > 127 or y > 127 for x, y in zip(aa, bb))
    return intersection / union if union else 0


def contact_sheet(previews, target):
    """A side-by-side dark/light backdrop reveals accidental baked pixels."""
    cols, cw, ch, rows_per_group = 4, 330, 186, 8
    previews.sort(key=lambda it: it[0])
    width = cols * cw
    height = ((len(previews) + cols - 1) // cols) * ch
    result = Image.new("RGB", (width, max(ch, height)), "#23272c")
    canvas = ImageDraw.Draw(result)
    for i, (name, image) in enumerate(previews):
        x, y = (i % cols) * cw, (i // cols) * ch
        canvas.rectangle((x+3, y+3, x+cw//2-1, y+153), fill="#222830")
        canvas.rectangle((x+cw//2, y+3, x+cw-4, y+153), fill="#e4e3df")
        preview = image.copy()
        preview.thumbnail((cw-20, 145), Image.Resampling.LANCZOS)
        px = x + (cw - preview.width)//2
        py = y + (152 - preview.height)//2
        layer = Image.new("RGBA", result.size, (0, 0, 0, 0))
        layer.alpha_composite(preview, (px, py))
        result.paste(Image.alpha_composite(result.convert("RGBA"), layer).convert("RGB"))
        canvas = ImageDraw.Draw(result)
        canvas.text((x+9, y+158), name[:46], fill="#f4f4f3")
    target.parent.mkdir(parents=True, exist_ok=True)
    result.save(target, optimize=True)


def audit(output_dir):
    errors, warnings, groups, samples, previews, reports = [], [], defaultdict(dict), {}, [], []
    expected, paths, embedded = gather()
    expected_set = {ROOT / p for p in expected["paths"]}
    for file in expected_set:
        if not file.is_file():
            errors.append(f"Missing published image: {file.relative_to(ROOT)}")
    if not paths:
        errors.append("No WebP assets found")
    for file in paths:
        if not file.is_file():
            continue
        name = str(file.relative_to(ROOT))
        resolution = re.search(r'-(400|800|1254|1600)\.webp$', name)
        if not resolution:
            errors.append(f"{name}: unknown published resolution")
            continue
        size = int(resolution.group(1))
        stem = name[:resolution.start()]
        try:
            image = open_webp(file, name)
            bbox, transparent, margins = bounds_and_alpha(image)
            if max(image.size) != size:
                raise ValueError(f"Size {image.size} does not match {size}px long edge")
            if name.startswith("assets/cases/") or "/lines/" in name:
                if image.size != (size, size):
                    raise ValueError("Curated art must have a square, contain-sized canvas")
                if min(margins) < .008:
                    warnings.append(f"{name}: silhouette within 0.8% of canvas edge")
            groups[stem][size] = image
            samples[stem] = name
            reports.append({"path": name, "size": list(image.size),
                            "alpha_empty_fraction": transparent,
                            "visible_bbox": list(bbox)})
            if size in (1254, 1600):
                previews.append((stem.removeprefix("assets/"), image.copy()))
        except (ValueError, OSError) as exc:
            errors.append(f"{name}: {exc}")

    for file in embedded:
        try:
            by_size = bytes_of_embedded(file)
        except (ValueError, OSError) as exc:
            errors.append(f"{file.relative_to(ROOT)}: {exc}")
            continue
        stem = str(file.relative_to(ROOT)).removesuffix(".js")
        for size, binary in by_size.items():
            name = f"{stem}#{size}"
            try:
                image = open_webp(binary, name)
                bbox, transparent, margins = bounds_and_alpha(image)
                if max(image.size) != size:
                    raise ValueError(f"Embedded size {image.size} does not match {size}")
                groups[stem][size] = image
                reports.append({"path": name, "size": list(image.size),
                                "alpha_empty_fraction": transparent,
                                "visible_bbox": list(bbox)})
                if size == 1600:
                    previews.append((stem.removeprefix("assets/"), image.copy()))
            except (ValueError, OSError) as exc:
                errors.append(f"{name}: {exc}")

    for stem, versions in sorted(groups.items()):
        needed = {400, 800, 1254} if stem.startswith("assets/cases/") else {400, 800, 1600}
        if set(versions) != needed:
            errors.append(f"{stem}: expected {sorted(needed)}, got {sorted(versions)}")
            continue
        largest = versions[max(needed)]
        for px in sorted(needed - {max(needed)}):
            smaller = versions[px]
            score = silhouette_similarity(largest, smaller)
            if score < .80:
                errors.append(f"{stem}: {px}px silhouette differs from largest export (IoU {score:.3f})")

    # At minimum every published case pose must differ from its counterpart.
    for case in expected["cases"]:
        a = groups.get(f"assets/cases/{case}-case-closed", {}).get(400)
        b = groups.get(f"assets/cases/{case}-case-open", {}).get(400)
        if a is None or b is None:
            errors.append(f"{case}: missing closed/open case pose")
        elif silhouette_similarity(a, b) > .985:
            errors.append(f"{case}: open and closed case have virtually identical silhouettes")

    # An audit cannot authenticate artistic fidelity to owner-approved originals.
    # The generated sheet allows a human to review that qualitative requirement.
    output_dir.mkdir(parents=True, exist_ok=True)
    if previews:
        contact_sheet(previews, output_dir / "artwork-review-sheet.png")
    report = {
        "status": "FAIL" if errors else "PASS",
        "released_cases": expected["cases"],
        "image_exports_checked": len(reports),
        "groups_checked": len(groups),
        "errors": errors, "warnings": warnings,
        "export_details": reports,
        "human_review_required": [
            "Match each design, lettering and weapon silhouette against the owner-approved original",
            "Inspect engravings and small markings at 400/800/1600 sizes",
            "Review semi-transparent fringe pixels on both light and dark backgrounds"
        ]
    }
    (output_dir / "artwork-audit.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    for warning in warnings:
        print("WARN", warning)
    for error in errors:
        print("FAIL", error, file=sys.stderr)
    print(f"{report['status']}: audited {len(reports)} images in {len(groups)} groups; "
          f"{len(errors)} errors, {len(warnings)} warnings. "
          f"Review: {output_dir / 'artwork-review-sheet.png'}")
    return 1 if errors else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "tests" / "artwork-review")
    args = parser.parse_args()
    return audit(args.output_dir)


if __name__ == "__main__":
    sys.exit(main())
