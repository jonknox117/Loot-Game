# Wear-only material maps

Blackout and Damascus procedural skin lines have been **retired at the owner's
request**. There are no purchasable procedural themed cases or generated skin
variants. Material maps are retained exclusively to support the existing
condition/wear effects on approved neutral masters and the 10 hand-approved skins.

## Retained art and masks

- `assets/skin-lines/materials/<slug>--silhouette-1600.png`: alpha
  silhouette aligned with each neutral weapon master.
- `assets/skin-lines/materials/<slug>--material-1600.png`: exhaustive
  red (metal), green (wood) and blue (other) classification; alpha matches
  the weapon image and exactly one material class is assigned to each visible
  pixel.
- `assets/skin-lines/masks/<slug>--paint-main-1600.png`: coating mask,
  independent of the material map.
- `assets/skin-lines/paint-profiles.json`,
  `assets/skin-lines/material-landmarks.json`, and their generated browser
  registries remain available for wear rendering and audit.

`market/wear-materials.js` and `market/wear-renderer.js` continue using the
material maps for metal-only rust, surface-specific scratch/chip/grime, and
coating fade. Material-map review remains essential: unknown areas must not
be labeled metal. The original 24 masters and custom skin artwork remain
unchanged.

## Removed

- Both purchasable cases: Blackout and Damascus.
- All 30 auto-generated Blackout/Damascus weapon WebPs.
- The six corresponding source texture WebPs.
- Both entries from `assets/skin-lines/lines.json`; browser registry
  `assets/skin-lines/line-data.js` is empty.

The old builder remains available for neutral-master processing and
compatibility testing, but it rejects **all** procedural line definitions
until the owner explicitly authorizes another finish-rendering approach.

## Saves and marketplace compatibility

On reload, existing *sealed* Blackout/Damascus Cases become sealed
Arsenal Cases of equal 25-coin value, preserving item ID and paid amount.
Previously opened procedural Blackout/Damascus skins become unskinned versions
of the same weapon, retaining unique ID, base value, rarity and saved wear
grade. The same conversion is applied to previously listed/escrowed items
and prior NPC inventory. Existing player asking prices and market activity
history are not rewritten. Repeating the migration does not duplicate items
or change values. Exported legacy save files containing these two retired
collections can still be imported and converted on load.

## Validation

```bash
python scripts/sync_weapon_catalog.py --check
python scripts/export_paint_profiles.py --check
python scripts/build_material_maps.py --check
python scripts/build_skin_lines.py --self-test
python scripts/build_skin_lines.py
python scripts/build_skin_lines.py --check
python scripts/audit_material_maps.py --output tests/material-review-sheet.png
node tests/core.cjs
node tests/smoke.cjs
```

The GitHub CI rebuild checks the maps and transparent neutral masters but
cannot publish procedurally patterned weapon skins while definitions are
disabled.
