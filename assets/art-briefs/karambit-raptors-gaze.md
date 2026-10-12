# LootHub 0.3.3G — Raptor's Gaze

Current finish: **Karambit | Raptor's Gaze** (Legendary, tier 4).  
Supersedes the previous Golden Talon artwork and title without changing item values or ownership.

## Visual reference

The user's annotated **neutral blade** is the placement authority.
The extended red curved mark indicates **only a single eyebrow**; the red spot near the blade/handle transition marks the **eyeball**. The gold version is meant to carry the same feature placement.

- Follow the natural blade curve with one long sculpted gold brow, tapering toward the hooked tip.
- Place one separately distinguishable dark eye on the blade face close to the heel, underneath the thick near-hilt part of the brow.
- Remove the complete carved eagle-head face and excessive feathers from Golden Talon.
- Keep premium warm gold, black texture on the grip, and an unobstructed ring.
- Do not modify the neutral silhouette or finger-hole opening.
- The relief and eye are 2D rendered details, not actual 3D displacement.

## Shipped assets

- Finished: `assets/renders/finishes/karambit--raptors-gaze-{400,800,1600}.webp`
- Neutral: `assets/renders/masters/karambit-neutral-{400,800,1600}.webp`
- Source and masks: `/LootHub/loothub-raptors-gaze-master-033G.zip` (Library)
- Deterministic build: `scripts/build_raptors_gaze_2d.py`
- Recipe: `assets/skin-definitions/karambit--raptors-gaze.json`

The actual source knife was ~960px wide in original generated concept art; the 1600px inspect export is resampled. This is a live **provisional** visual awaiting user acceptance and mobile Safari review.

## Legacy support

Previous Golden Talon inventory and listings display with the new Raptor's Gaze title and artwork. Preserve their individual IDs, costs, rarity, float, pattern, StatTrak and estimated market value. The legacy name remains accepted on import and converted during load; the existing save key stays intact.
