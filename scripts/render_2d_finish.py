#!/usr/bin/env python3
"""Deterministic LootHub masked 2D finish compositor.

Usage:
  python render_2d_finish.py \
    --master source/glock-18-neutral-2400.png \
    --masks source/masks \
    --recipe recipes/glock-18--slate-grid.json \
    --output renders/regenerated/glock-18--slate-grid

Dependencies: Pillow 10 or newer. Input artwork is a transparent, accurately
framed 2D master. This compositor does not fabricate missing physical geometry.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageColor, ImageChops, ImageDraw


def load_mask(folder: Path, name: str, size: tuple[int, int]) -> Image.Image:
    file = folder / (name + '.png')
    if not file.is_file():
        raise FileNotFoundError(f'Required surface mask not found: {file}')
    mask = Image.open(file).convert('L')
    if mask.size != size:
        raise ValueError(f'Mask {name} has wrong dimensions: {mask.size} != {size}')
    return mask


def add_tint(image: Image.Image, mask: Image.Image, spec: dict) -> Image.Image:
    rgb = ImageColor.getrgb(spec['color'])
    opacity = max(0.0, min(1.0, float(spec.get('opacity', 0.2))))
    blend = max(0.0, min(1.0, float(spec.get('blendColorMix', 0.3))))
    tinted = Image.blend(image, Image.new('RGBA', image.size, (*rgb, 255)), blend)
    alpha = mask.point(lambda a: round(a * opacity))
    image.paste(tinted, (0, 0), alpha)
    return image


def add_grid(image: Image.Image, mask: Image.Image, spec: dict) -> Image.Image:
    if not spec.get('enabled', False):
        return image
    sx = max(8, int(spec.get('spacingX', 44)))
    sy = max(8, int(spec.get('spacingY', 35)))
    width = max(1, min(5, int(spec.get('lineWidth', 1))))
    color = ImageColor.getrgb(spec.get('lineColor', '#c4d9e4'))
    ox = max(0.0, min(1.0, float(spec.get('lineOpacityX', 0.22))))
    oy = max(0.0, min(1.0, float(spec.get('lineOpacityY', 0.19))))
    layer = Image.new('RGBA', image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for x in range(0, image.width, sx):
        draw.line((x, 0, x, image.height), fill=(*color, round(255 * ox)), width=width)
    for y in range(0, image.height, sy):
        draw.line((0, y, image.width, y), fill=(*color, round(255 * oy)), width=width)
    layer.putalpha(ImageChops.multiply(layer.getchannel('A'), mask))
    return Image.alpha_composite(image, layer)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--master', type=Path, required=True)
    p.add_argument('--masks', type=Path, required=True)
    p.add_argument('--recipe', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True, help='Output stem without extension or size')
    args = p.parse_args()

    recipe = json.loads(args.recipe.read_text(encoding='utf-8'))
    if recipe.get('schemaVersion') != 1:
        raise ValueError('Unsupported finish recipe version')
    neutral = Image.open(args.master).convert('RGBA')
    if neutral.width * 1 != neutral.height * 2:
        raise ValueError('A 2:1 neutral master is required')
    alpha = neutral.getchannel('A')
    paint_main = load_mask(args.masks, 'paint-main', neutral.size)
    paint_secondary = load_mask(args.masks, 'paint-secondary', neutral.size)
    img = neutral.copy()
    img = add_tint(img, paint_main, recipe.get('paintMain', {}))
    img = add_tint(img, paint_secondary, recipe.get('paintSecondary', {}))
    img = add_grid(img, paint_main, recipe.get('grid', {}))
    img.putalpha(alpha)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    img.save(args.output.parent / (args.output.name + '-working.png'), optimize=True)

    for width in sorted(set(map(int, recipe.get('exportWidths', [400, 800, 1600])))):
        if width < 200 or width > neutral.width:
            raise ValueError('Export width outside supported range')
        out = img.resize((width, width // 2), Image.Resampling.LANCZOS)
        filename = args.output.parent / f'{args.output.name}-{width}.webp'
        out.save(filename, 'WEBP', quality=94, method=6, exact=True)
        reopened = Image.open(filename).convert('RGBA')
        if reopened.size != (width, width // 2) or reopened.getchannel('A').getextrema() != (0, 255):
            raise RuntimeError('WebP export validation failed for ' + str(filename))
        print(f'OK {filename}: {width} x {width // 2}, {filename.stat().st_size} bytes')


if __name__ == '__main__':
    main()