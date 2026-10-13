# Loot Hub 0.6.1 — Collection Book preparation

Status: **planning only**. This branch does not change the live game.

## Confirmed catalog
- Arsenal v1: **35 entries** = 25 original weapons plus 10 Arsenal skins.
- Cartel v1: **5 entries** = five Cartel skins.
- Completion means each distinct approved item has been acquired at least once. Selling or listing an item does not erase its discovery. Duplicates and item condition do not create extra progress.
- Each completed collection unlocks **25 sealed cases** of the matching type, claimable once per collection version and local save. Claimed cases are tradeable and compatible with 1–5 case opening.
- Preserve existing drop odds, item IDs, case prices, inventory, market listings, and old saved progress.

## Technical plan
1. Introduce a versioned, frozen `assets/collections.js` catalog generated from the approved manifest. Map item kind, weapon name and skin name to a canonical catalog ID. Never count case previews or NPC inventory as player discoveries.
2. Add `market/collections.js` with `ensure`, `discover`, `progress`, `validate`, and `claim` functions. Save separate arrays of unique discovered IDs and a one-time claimed receipt for Arsenal and Cartel.
3. Extend `upgrade.js` load, save and import validation. Credit legitimate items in owned inventory and player listing escrow upon upgrading an old save. Previously sold items absent from available records cannot be reconstructed reliably. Keep the existing local save key and backwards compatibility.
4. Reconcile player-owned approved inventory/escrow when the game saves. This covers single-case and five-case openings, marketplace purchases and future direct item trades without relying solely on case UI.
5. The claim function creates 25 unique sealed cases and a claim receipt together. Check space, serial limits and save availability; never show success before durable saving. Do not change coins, spent, earned or openings.
6. Correct the existing case valuation inconsistency in `market/core.js`: Arsenal Case 25 coins, Cartel Case 75 coins. Free claim provenance must not make a Cartel Case worth zero or 25.
7. Build a mobile-friendly Collection Book reachable from Cases and Inventory. Show 35/35 or 5/5 progress, approved thumbnails, locked/discovered tiles, completion notification and Claim 25 Cases. Avoid adding an eighth top navigation tab.
8. Extend `tests/core.cjs` and `tests/smoke.cjs` for duplicate acquisitions, market transfers, one-time claim, failed save, old import, 25 prize IDs, 1–5 opening, correct condition/odds and iPhone layout.

## Acceptance tests
- Exact catalog roster and stable IDs, independent of duplicate copies or wear.
- Selling, listing and trading never erase discoveries; NPC-to-NPC trades never count.
- Old saves load unchanged except additive discovery history from currently verifiable owned/listed items. Imports with invalid collection fields are rejected.
- Claim Arsenal produces exactly 25 Arsenal cases; claim Cartel produces exactly 25 Cartel cases. Repeated attempts produce none.
- Save errors, full inventory, stale-tab conflicts and invalid inputs do not partially grant items.
- Existing single and five-case opening behavior and case odds remain unchanged.
- Both GitHub CI workflows pass before merge. Verify deployment separately.

Local saves can be backed up and restored; preventing abuse across deliberate older-save rollbacks requires account-based server authority and is not part of this patch.

## Implementation notes

Implementation is delivered separately in the 0.6.1 feature branch. Both collections use their frozen v1 rosters. Collection completion grants 25 sealed cases once, without changing existing game odds or giving free coins. Existing player inventory and personal listing escrow are backfilled upon upgrade; previously sold items absent from the current save cannot be reconstructed.
