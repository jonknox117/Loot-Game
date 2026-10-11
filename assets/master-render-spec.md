# LootHub 0.3.3A — Five clean 2D weapon masters

Status: SPECIFICATION — no photoreal replacement art is created by this file. Existing game SVGs remain active until better artwork passes approval.

## Production decision

Render each accurate, rights-cleared base weapon into a clean 2D transparent image. The website does NOT need real-time 3D. If the best source is a licensed 3D model, use Blender only offline to produce still PNG/WebP images. A true high-fidelity weapon model (or accurately layered illustration) is necessary; upscaling existing SVGs or generating unrelated AI art for each skin would not meet the quality standard.

Asset licensing is part of delivery. Record original creator, download URL, license, modification and redistribution permission, and retrieval date. Do not extract proprietary models or textures from other games without rights. Preserve original high-resolution working files.

## Consistent studio render specification

- Source canvas: 2400 x 1200 (2:1), transparent RGBA, lossless PNG plus editable .blend or layered illustration source.
- Export sizes: inspection 1600 x 800 WebP, inventory 800 x 400 WebP, roulette 400 x 200 WebP. All derived from exactly one approved full-resolution original.
- Source framing: 2:1, near-side-profile with <=8 degrees horizontal and <=5 degrees vertical camera offset. All barrels/blade tips point toward the right.
- Projection: orthographic for any 3D-sourced model, with fixed framing/angle across finishes. No perspective-shortened barrel or crooked pistol frame.
- Coverage: rifles and sniper occupy 86–90% of canvas width; Glock 76–82%; Karambit 64–76%. Keep >=7% clear canvas padding at all sides; use equal perceived scale per item category.
- Lighting: studio key light from upper-left at ~45 degrees, neutral 5000–5500K, muted cool opposing rim, constrained clean metal highlights. No strong colored light baked into the master.
- Material: neutral blued/brushed steel; distinguish matte polymer, dark aluminum, glass and any wood. Preserve seams, trigger, rails, screws, sights, magazine and edges.
- Background: completely transparent. NO baked case background, rarity band, text, glow, labels, badge, artificial chromatic accents, watermark, or fake soft-edged opaque cutout.
- Color management: sRGB outputs, no palette change across reel, inventory and inspect; identical finish definition and item identity.
- Anti-aliasing: clean alpha boundaries, no white fringes, double stocks, blurry geometry, bent components or AI-generated structural artifacts.
- Never simply tint the entire gun. Paint only intended component masks, retain bare-metal and optics surfaces.

## The first five masters

| Model | Nonnegotiable identity checks | Preferred material treatment | Width occupancy |
|---|---|---|---|
| Glock-18 | Short squared slide, angled polymer grip, trigger guard, front and rear sights, magazine bottom; must read as the named pistol not a generic handgun | Graphite frame + satin steel slide | 76–82% |
| AK-47 | Distinct curved magazine, long barrel, visible front sight, gas-tube profile, iconic receiver and rear stock | Dark receiver + wood-like furniture where appropriate | 86–90% |
| AWP | Bolt-action precision rifle, heavy stock, large scope, long slender barrel, prominent optic mounting and stock shape | Matte stock, steel barrel, separate dark-glass optics | 86–90% |
| M4A4 | AR-family straight magazine, rail handguard, receiver, grip, stock and sight profile distinct from AK | Matte aluminum receiver, polymer grip/stock | 86–90% |
| Karambit | Hooked/talon blade, clear sharp cutting edge, curved grip and unmistakable open finger ring | Brushed blade + dark textured grip | 64–76% |

For each master, require a recognizable silhouette when image is shown WITHOUT label in a mobile 160px inventory card. If it isn't immediately identifiable, fix the source geometry before starting finish art.

## Non-destructive surface masks

Every master must expose matching 2400 x 1200 grayscale alpha masks. They must share precisely the same placement and clean anti-aliased edges:

- paint-main: large paintable slide, receiver or blade face.
- paint-secondary: another paintable surface, e.g. furniture/handguard.
- metal-exposed: barrel, edge or mechanism kept untreated.
- polymer-or-wood: handles, grips and stocks when independently colored.
- hardware: sights, optic, triggers, screws, magazine and pivots.
- edge-highlight: glints and accurate material contour highlights.
- ao-shadow: dark creases and physical surface depth preserved OVER any colored finishes.
- decal-safe: optional limited region for intentional original graphics.

A component's mask must never cover unrelated geometry. Scope glass must not become red because the receiver is painted red.

## Skin definition model

Each collectible finish is a versioned recipe with:
- baseModel: stable model ID, e.g. ak-47.
- palette: 2–4 finish-specific colors, unrelated to the item's rarity.
- surfaces: matte, metallic, anodized, brushed, enamel, varnish, etc., applied by mask.
- pattern: repeatable original pattern tile/graphic layer with seed and scale.
- decals: optional original artwork clipped to specific safe surfaces.
- wear: eventually a deterministic weathering map and float; do NOT simulate variation visually until built and tested.
- finishVersion: cache key for future revisions.

Render offline from the same master: neutral underpainting -> masked finishes/patterns -> retained highlights and AO/crevices -> transparent export at three sizes. No random recoloring during display. The reel winner, inventory item and final reward must use the SAME artwork/version. Preserve the fixed isolated paint CSS regression tests as backups.

## Future folder contract (do not advertise missing files as live)

assets/source/glock-18/neutral-master.blend
assets/source/glock-18/provenance.json
assets/source/glock-18/masks/paint-main.png
assets/source/glock-18/masks/paint-secondary.png
assets/source/glock-18/masks/metal-exposed.png
assets/source/glock-18/masks/polymer-or-wood.png
assets/source/glock-18/masks/hardware.png
assets/source/glock-18/masks/edge-highlight.png
assets/source/glock-18/masks/ao-shadow.png
assets/source/ak-47/
assets/source/awp/
assets/source/m4a4/
assets/source/karambit/
assets/renders/masters/glock-18-neutral-1600.webp
assets/renders/masters/glock-18-neutral-800.webp
assets/renders/masters/glock-18-neutral-400.webp
assets/skin-definitions/ak-47--ghostline.json
assets/renders/finishes/ak-47--ghostline-1600.webp
assets/renders/finishes/ak-47--ghostline-800.webp
assets/renders/finishes/ak-47--ghostline-400.webp

Paths above are the planned naming convention. Do not enable any missing path, or mark an asset approved without existence and visual review. The existing 17 SVG vector masters remain as fallbacks.

## 2D premium Inspect

- 1600px inspection artwork on neutral display stage; zoom 1x–2.5x, touch pan when zoomed, double-tap reset.
- A subtle independent light-sweep overlay is fine, but must never change real finish colors or recolor the gun.
- Show item, rarity, wear, float, pattern, StatTrak, approximate market value and relevant sell/list controls.
- No pretended 3D rotation: a single 2D render does not contain other angles.
- Mobile viewport target 390px, no horizontal overflow, >=44px touch hit targets, respect reduced motion.

## Acceptance tests — all mandatory

1. Identity: weapon immediately recognizable WITHOUT name at 400px and 160px widths.
2. Accuracy: correct specific stock, receiver, magazine, sight, optic, blade and finger ring as appropriate.
3. Alpha: inspect transparency on checkerboard; no baked background/halo.
4. Quality: no melted details or muddy texture when enlarged 2x.
5. Consistency: side-by-side five masters share lighting, angle and artistic treatment.
6. Finish: two finishes of the same model visibly reuse geometry but differ in masked material/pattern, not just hue.
7. Rights: source/provenance and licenses allow redistribution and modification in this browser game.
8. Runtime: 1600/800/400 files present, compressed reasonably, and correctly served at their respective URLs.
9. Reel: winning preview is pixel-identical in finish and model to the final reward, allowing only scale/crop difference.
10. Regression: existing saves, odds, inventory, listings and opening logic unchanged.

## Execution order and stop conditions

A. Acquire/prove one rights-cleared Glock-18 source, produce one studio master and show full/mobile outputs. If it fails identity/clarity, change sourcing route rather than pushing ahead.
B. Repeat for AK-47 and AWP, then M4A4 and Karambit with identical framing rules.
C. Use AK-47 Ghostline and Crimson Circuit to prove two original distinct finishes can be overlaid on ONE master without changing its silhouette.
D. Integrate manifest-aware image loading only after actual approved files exist. Use current SVG fallback for missing finishes.
E. Check inventory, reel, final reveal, market and inspect at 390px and 1280px. Run established regression tests and deploy.

Production caveat: obtaining high-fidelity, legally usable model geometry is the gating task. Changing the size of current SVG files or asking for separate AI-generated weapon drawings does not solve accuracy or consistency.
