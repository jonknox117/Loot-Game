# Arsenal visual asset pipeline (Patch 0.3.0)

This directory establishes the source-of-truth manifest for 19 existing Arsenal finishes. **Patch 0.3.2 now loads 17 distinct vector weapon masters** from `assets/weapon-masters.js`, using the same 640 × 270 framing. Every weapon model has dedicated silhouette geometry. These vector masters are visible in item cards, inventory, case contents, opening reels, and inspection. Finished, individually approved high-resolution skin illustrations are still planned for 0.3.3; they do not exist yet.

## Approval process
1. The 17 model-specific SVG masters now establish consistent composition, silhouette and aspect ratio. They are clean vector foundations rather than finished textured artwork.
2. Produce unique *original* finish artwork for each entry in `manifest.json`. Keep the weapon geometry and framing intact. High-rarity items receive stronger finishing detail, not different scale.
3. Review each subsequent full-resolution finish output for weapon identity, silhouette, texture alignment, shadows, transparent edges, readability and distortion before marking `approved:true`.
4. Preserve 1600px inspection exports and create separate 640px card and 320px grid derivatives. Never upscale thumbnails for detail screens.
5. Add external bitmap assets only after their files exist and validate that every approved file is loadable. Missing/unapproved skins continue using model-specific inline SVG masters. Imported legacy items outside the known model set retain the generic SVG fallback.
6. In future UI patches, load assets through a common manifest-based resolver, with each item slug mapping to exactly one set of image resolutions. Degrade gracefully on slow mobile connections.

## Fixed standards
- Original artwork only; real-world gun *model names* are okay, but no Counter-Strike skin duplication.
- Neutral transparent-background source images, no baked UI or baked rarity frames.
- Weapon orientation consistent across variants, centered on the same canvas.
- Rarity and condition metadata are *UI information*, not artwork watermarks.
- Each case, weapon and skin is distinct: no single generic firearm image used for all.
- End-to-end visual test should compare 390px mobile viewport and 1280px desktop.
- Never put losslessly sourced art into inline base64 application code.

## Patch 0.3.2 implementation notes

- The renderer is registered as `window.ArsenalMasters`. Each model has a dedicated composition with distinguishing receiver, stock, magazine, barrel, sights or blade geometry, as appropriate.
- `ArsenalMasters.render({kind:'skin',weapon,skin,tier})` returns an accessible 640 × 270 inline SVG. Each render uses a unique paint identifier to avoid gradient collisions across inventory grids.
- The current 19 finishes have preliminary color palettes and procedural surface marks, **not** final individual painted finish assets. Final artwork should retain the same silhouette geometry and use the manifest's future exported image paths.
- The case image remains its own vector illustration; this patch focuses on weapons.
- The gameplay save structure, drop chances, economy calculations and item instance IDs are unchanged.

## Patch 0.3.3A — Clean 2D master specifications

- [Five-master production standards](master-render-spec.md): model recognition, studio camera, transparency, layer masks, preview sizes, source provenance, skin composition and acceptance tests.
- [Machine-readable targets](master-render-spec.json): first five weapon models and required outputs with **status: not-rendered**.
- New master production uses 2:1 exports at 1600x800 / 800x400 / 400x200, superseding the older provisional 1600x850 / 640x340 / 320x170 targets for **future assets**. No existing output has been removed.
- The in-game renderer is unchanged until approved, actually existing replacement images are integrated. No high-fidelity master art is implied by this specification.

## 0.3.3A — First real transparent 2D master shipped

- Glock-18 neutral master WebPs: `assets/renders/masters/glock-18-neutral-{1600,800,400}.webp`.
- Pilot applied finish: `assets/renders/finishes/glock-18--slate-grid-{1600,800,400}.webp`.
- All images are genuine transparent WebP files committed as Git binary blobs, not inline base64 or upscaled thumbnails. The 1600px detail and 400px reel variants originate from the same layered working master.
- The source image, 2400x1200 working PNG, eight aligned surface masks, tested `scripts/render_2d_finish.py`, finish recipe and previews are preserved in `/LootHub/loothub-glock-master-033A.zip` in the user's Library.
- Reusable recipe: `assets/skin-definitions/glock-18--slate-grid.json`. Pillow compositor: `scripts/render_2d_finish.py`. Local regeneration reproduces the three published finish WebPs **byte-for-byte** in the current environment.
- The base render was generated from original AI imagery, not from an exact OEM 3D model; this is a convincing Glock-style visual pilot, not a claim of manufacturer-exact geometry. The source image was natively 1774x887 before the transparent 2400x1200 working canvas.
- The case catalog's **View finish** control lets players inspect this item at 1600px without needing to win it; no game state is modified.
- Other 18 finishes continue using model-specific vector artwork. Full-quality approval for the remaining masters is pending.

## 0.3.3C — AK-47 neutral model and two finished exports

- **Live:** AK-47 | Ghostline and AK-47 | Crimson Circuit. Both reuse the exact neutral model and alpha silhouette. Each is a standalone transparent WebP at **400 × 200**, **800 × 400**, and **1600 × 800**.
- Neutral master: `assets/renders/masters/ak-47-neutral-{400,800,1600}.webp`.
- Original finish artwork: `assets/renders/finishes/ak-47--ghostline-{400,800,1600}.webp` and corresponding `ak-47--crimson-circuit` files.
- The neutral generated source, both original finish sources, canonical 2400px working PNGs, six aligned paint-region masks, exact-geometry compositor, and review previews are archived at **/LootHub/loothub-ak-master-033C.zip** in the user's Library.
- To reproduce from an unzipped source bundle, use **`python scripts/build_ak_2d.py <unzipped bundle folder>`** with Pillow, NumPy and OpenCV. All variants are normalized to one neutral alpha mask and verified at every output size.
- The original source artwork is AI-generated (native 1774 × 887) and fitted into a 2400 × 1200 working canvas; no manufacturer-exact CAD/3D source is claimed. The 1600px image is an export resolution, not native 1600px source detail.
- Both AK exports use exact model and finish metadata in opening reels, inventory cards, and item inspection; other weapons continue to use their dedicated SVG fallbacks until they meet the same raster detail standard.
- Remaining initial anchors (AWP, M4A4, Karambit) still need **isolated, high-resolution neutral source renders**. Multi-weapon mood boards were **rejected as raster sources**: cropping their 400–700px artwork and upscaling it would not meet the approved Glock clarity benchmark.
- Work on the exact existing catalog finishes: **AWP Night Watch**, **AWP Eclipse**, **M4A4 Voltage Bloom**, and **Karambit Golden Talon**. Never create new inventory names merely because a design reference board contained them.

## 0.3.3D — AWP standalone raster master and two finishes

- **Live:** AWP | Night Watch (Rare) and AWP | Eclipse (Super Rare) are distinct, deterministic 2D finishes on **one isolated AWP master**.
- Original source render: `/LootHub/loothub-awp-master-033D.zip` in Library. Includes 1774x887 native generated transparent original, 2400x1200 working master, six pixel-aligned masks, finished artwork, reusable Python compositor, and 400px, 800px, 1600px WebPs.
- Production script: `scripts/build_awp_2d.py`. Regenerates the same neutral master and both finish sets with an exact shared alpha mask.
- In-game images: `assets/renders/finishes/awp--night-watch-{400,800,1600}.webp` and `awp--eclipse-{400,800,1600}.webp`. The matching neutral master resides in `assets/renders/masters/awp-neutral-{400,800,1600}.webp`.
- The generated original faced left. All published item exports are corrected to **barrel/muzzle right**, matching Glock and AK framing.
- Night Watch: original indigo/cyan constellation streams on the real stock/chassis only, with untouched barrel, scope and other hardware.
- Eclipse: masked dark metallic-gold chassis with original eclipse medallion, repeating engraved arcs, and gold edge lines. The real stock, magazine, bipod, scope, and silhouette remain intact.
- The actual neutral source is original AI-generated **illustration**, not CAD or a licensed manufacturer GLB. This is a high-resolution raster visual pilot; final iOS Safari review is still pending.
- No user balances, item odds, item attributes or save keys changed. All remaining non-raster items continue using their model-specific vector fallbacks.

## 0.3.3E — M4A4 neutral art + Voltage Bloom source-qualified pilot

- **Integrated:** M4A4 | Voltage Bloom (existing Rare catalog entry). A neutral M4A4 and distinct cyan/lightning/flower-pattern finish now share exact transparent silhouette and component masks.
- Renders: `assets/renders/masters/m4a4-neutral-{400,800,1600}.webp` and `assets/renders/finishes/m4a4--voltage-bloom-{400,800,1600}.webp`.
- All exports are transparent native WebP files committed as Git binary blobs, not embedded as base64 or stretched from the thumbnail output.
- Artwork source is an original generated 1774×887 comparison-sheet illustration. The actual rifle region used is about **1110 native horizontal pixels**, so the 2400×1200 working canvas and 1600px inspect output involve upsampling. This is clearly a **provisional** model master, *not* independently framed native 1600px detail.
- The source sheet, repeatable segmentation/compositor script, neutral source, finished source, masks, all six WebPs and previews are saved in Library at `/LootHub/loothub-m4a4-master-033E.zip`.
- Production: `python scripts/build_m4a4_2d.py` from an extracted bundle (requires Pillow, NumPy and OpenCV).
- Material masking keeps metallic mechanical details, rail and barrel intact and applies blue lacquer, electric flowers and fine energy tracery only on painted surfaces.
- Both images point the muzzle right like the other released masters, and their alpha channels are **pixel-identical** before compression and in exported WebPs at all three sizes.
- Current status: **pilot live; not final-approved**. A dedicated higher-detail source may replace this while keeping the finish recipe and asset addresses.
- No game economy, saves, rarity odds or item instance data changed.

## 0.3.3F — Golden Talon artwork (provisional pilot live)

- **Integrated in-game:** Karambit | Golden Talon (Legendary, tier 4). Existing item identity, case rarity weights, saves and economy remain unchanged.
- The **same neutral knife geometry** is used for both original 2D textures. One exact alpha mask (including a transparent open finger ring) is used across all 400/800/1600 exports; black background has been removed, not encoded in the sprites.
- **Signature motif:** Gold eagle-brow relief and small dark eye inset at the blade-to-hilt junction. Feather-inspired engraved lines extend into the blade surface. Black grip, burnished gold edge highlights and warm-gold ring hardware provide contrast.
- Art files: `assets/renders/masters/karambit-neutral-{400,800,1600}.webp` and `assets/renders/finishes/karambit--golden-talon-{400,800,1600}.webp`.
- `scripts/build_karambit_2d.py` regenerates the masked neutral and finish PNGs and real WebP exports from the **archived original source**: `/LootHub/loothub-karambit-master-033F.zip`. Run `python scripts/build_karambit_2d.py <unzipped bundle root>`; Pillow, NumPy and OpenCV required.
- The archive includes the generated design source, 2400×1200 working PNGs, all eight component masks, image previews, the working compositor and a provenance report.
- **Native detail caveat:** Knife illustrations originated in a single original AI-generated 1774×887 design board, with about **960 horizontal pixels across the knife**. The 1600px inspection file is upsampled—not original native 1600px detail. The apparent metal embossing is high-fidelity painted 2D relief, not physical displacement from CAD.
- Gold finish and neutral master are corrected together to **hook-right, finger-ring-left** orientation. Both have the identical shape, even though the original generated board shows separate neutral and gold illustrations.
- Current approval: **raster pilot live, `approved:false`** until the user judges the eye/brow and independent mobile Safari testing confirms visual quality. Existing model-specific SVG art remains the error fallback.
- [Production spec and source-generation brief](art-briefs/karambit-golden-talon.md) and [live versioned finish recipe](skin-definitions/karambit--golden-talon.json) remain in the repository.
