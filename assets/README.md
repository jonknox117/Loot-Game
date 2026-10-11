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
