# Arsenal visual asset pipeline (Patch 0.3.0)

This directory establishes the source-of-truth manifest for the 19 existing Arsenal finishes. **This patch does not yet supply or load any new bitmap images.** The SVG illustrations remain the intentional fallback.

## Approval process
1. Create a consistent approved weapon master for each model. Artwork must use a fixed side-profile/three-quarter presentation, weapon facing right.
2. Produce unique *original* finish artwork for each entry in `manifest.json`. Keep the weapon geometry and framing intact. High-rarity items receive stronger finishing detail, not different scale.
3. Review each full-resolution output for weapon identity, silhouette, texture alignment, shadows, transparent edges, readability and distortion before marking `approved:true`.
4. Preserve 1600px inspection exports and create separate 640px card and 320px grid derivatives. Never upscale thumbnails for detail screens.
5. Add assets only after their files exist and validate that every approved file is loadable. Missing/unapproved assets fall back to existing SVG graphics.
6. In future UI patches, load assets through a common manifest-based resolver, with each item slug mapping to exactly one set of image resolutions. Degrade gracefully on slow mobile connections.

## Fixed standards
- Original artwork only; real-world gun *model names* are okay, but no Counter-Strike skin duplication.
- Neutral transparent-background source images, no baked UI or baked rarity frames.
- Weapon orientation consistent across variants, centered on the same canvas.
- Rarity and condition metadata are *UI information*, not artwork watermarks.
- Each case, weapon and skin is distinct: no single generic firearm image used for all.
- End-to-end visual test should compare 390px mobile viewport and 1280px desktop.
- Never put losslessly sourced art into inline base64 application code.
