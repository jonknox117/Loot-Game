#!/usr/bin/env python3
"""One-time v0.7.3 repair of clipped 400px Karambit Kryptonite artwork.

Regenerates just the 400px derivative from the approved 1600px master, with padding.
The approved 800px/1600px originals, skin design and all game data are unchanged.
Idempotent: already transparent corners are not touched.
"""
from __future__ import annotations

import base64
import io
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FILE = ROOT / "assets/skins/karambit--kryptonite.js"


def main():
    content = FILE.read_text(encoding="utf-8")
    match = re.search(r'("400"\s*:\s*)(.*?)(?=,\s*"800"\s*:)', content, re.S)
    if not match:
        raise ValueError("400px field not found in Kryptonite skin")
    parts = re.findall(r'"([A-Za-z0-9+/=]+)"', match.group(2))
    if not parts:
        raise ValueError("Cannot decode existing 400px art")
    with Image.open(io.BytesIO(base64.b64decode("".join(parts), validate=True))) as original:
        if original.format != "WEBP":
            raise ValueError("Original is not a WebP")
        image = original.convert("RGBA")
    if max(image.size) != 400:
        raise ValueError(f"Unexpected 400px image shape: {image.size}")
    alpha = image.getchannel("A")
    w, h = image.size
    corner_alpha = [alpha.getpixel(c) for c in
                    ((0, 0), (w-1, 0), (0, h-1), (w-1, h-1))]
    if max(corner_alpha) < 32:
        print("Kryptonite 400px artwork already has transparent corners; unchanged.")
        return
    # Derive the thumbnail from the approved 1600px inspection master, not
    # the previously clipped 400px export; keeps exactly the same silhouette.
    full = re.search(r'("1600"\s*:\s*)(.*?)(?=\s*}\s*;)', content, re.S)
    if full is None:
        raise ValueError("Cannot locate the approved 1600px render")
    chunks = re.findall(r'"([A-Za-z0-9+/=]+)"', full.group(2))
    if not chunks:
        raise ValueError("Cannot decode 1600px reference")
    with Image.open(io.BytesIO(base64.b64decode("".join(chunks), validate=True))) as reference:
        if reference.format != "WEBP" or max(reference.size) != 1600:
            raise ValueError("Invalid high-resolution original")
        high_res = reference.convert("RGBA")
    alpha_mask = high_res.getchannel("A").point(lambda v: 255 if v > 8 else 0)
    bbox = alpha_mask.getbbox()
    if bbox is None:
        raise ValueError("1600px reference contains no visible artwork")
    cropped = high_res.crop(bbox)
    margin_x, margin_y = max(3, round(w * .015)), max(2, round(h * .015))
    limit_w, limit_h = w - 2 * margin_x, h - 2 * margin_y
    factor = min(limit_w/cropped.width, limit_h/cropped.height)
    scaled = cropped.resize((max(1, round(cropped.width * factor)),
                             max(1, round(cropped.height * factor))),
                            Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    canvas.alpha_composite(scaled, ((w-scaled.width)//2, (h-scaled.height)//2))
    result = io.BytesIO()
    canvas.save(result, "WEBP", lossless=True, method=6)
    encoded = base64.b64encode(result.getvalue()).decode("ascii")
    updated = content[:match.start(2)] + '"' + encoded + '"' + content[match.end(2):]
    FILE.write_text(updated, encoding="utf-8")
    print(f"Reframed Kryptonite 400px thumbnail from 1600px master with a transparent margin "
          f"({w}x{h}); kept full-resolution originals untouched.")


if __name__ == "__main__":
    main()
