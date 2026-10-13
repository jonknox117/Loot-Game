#!/usr/bin/env python3
"""One-time v0.7.3 repair of clipped 400px Karambit Kryptonite artwork.

Only adds a narrow transparent safety margin to its existing 400px derivative.
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
    # Reframe the existing approved 400px pixels. No redraw, crop or color shifts.
    scaled = image.resize((round(w * .94), round(h * .94)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    canvas.alpha_composite(scaled, ((w-scaled.width)//2, (h-scaled.height)//2))
    result = io.BytesIO()
    canvas.save(result, "WEBP", lossless=True, method=6)
    encoded = base64.b64encode(result.getvalue()).decode("ascii")
    updated = content[:match.start(2)] + '"' + encoded + '"' + content[match.end(2):]
    FILE.write_text(updated, encoding="utf-8")
    print(f"Reframed Kryptonite 400px thumbnail with a 3% transparent safety margin "
          f"({w}x{h}); kept full-resolution originals untouched.")


if __name__ == "__main__":
    main()
