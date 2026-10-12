# LootHub — Curated Arsenal (Marketplace 0.4.2)

**Playable:** https://jonknox117.github.io/Loot-Game/

A mobile-first, browser-based collectible weapon and marketplace game. The collection contains **24 unskinned base weapon models and one individually approved collectible skin**. Future skins may enter only through the game owner's explicit selection and approval.

## Current Arsenal Case — approved collection

| Drop tier | Models |
| --- | --- |
| Common | Glock-18, MP5, MAC-10, Tec-9, 12 Gauge Pump Shotgun |
| Uncommon | Desert Eagle, Colt .45 Revolver, SPAS-12, M1911, Thompson SMG |
| Rare | AK-47, M4A4, Tactical Machete, M60, M1 Garand, Kar98k, FN SCAR-L, FN FAL |
| Super Rare | AWP, Tactical Tomahawk, RPG-7 |
| Legendary | Karambit, Butterfly Knife, M134 Minigun, **MAC-10 | Red Devil (approved skin)** |

Tier probabilities: 70% / 20% / 7.5% / 2% / 0.5%. A case costs 25 coins. The 24 base models are unskinned and have no finish/paint, float, pattern, or StatTrak rolls. The only currently approved cosmetic is **MAC-10 | Red Devil**, which is separately obtainable in the Legendary tier and does not overwrite the original MAC-10 model. Artwork in the case, opening reel, inventory, market listings, and inspect screen uses the unskinned master for base weapons and the separately approved Red Devil art only for that specific skin.

## Master artwork

- `assets/manifest.json` is the canonical **24-base-model plus one-approved-skin registry**.
- 19 supplied/approved weapon models load right-facing, transparent neutral masters through individual `assets/neutral-art/<model>.js` files containing 400/800/1600-pixel WebP images.
- Newest user-supplied masters: **M1911, M1 Garand, Kar98k, Thompson SMG, FN SCAR-L, FN FAL, and M134 Minigun**. Original silhouettes and orientation are kept; supplied JPEG white backgrounds are converted to actual transparency.
- First and only approved skin: **MAC-10 | Red Devil**, sourced directly from the user's finished image and kept in `assets/skins/mac-10--red-devil.js`. The unpainted MAC-10 master stays separate.
- Glock-18, AK-47, AWP, M4A4 and Karambit use the original `assets/renders/masters/<model>-neutral-1600.webp` raster files.
- `assets/weapon-masters.js` is a neutral-only vector fallback for retired weapon models from older saves. Its colorful procedural finish palettes were removed.
- Previous unapproved skin art may remain as historical files in the repository, but is **not active, selectable, rolled or rendered**. The only registered finish is Red Devil.
- Future skins enter only after approval. The supplied Red Devil design is currently assigned Legendary rarity; that placement can be changed without changing its image.

## Marketplace 0.4.0 — Foundation patch

The initial marketplace patch restructured the existing marketplace; the current curated-art update separately releases one owner-approved Red Devil skin.

- Market logic now lives in `market/core.js` (item eligibility, valuations and versioned state), `market/transactions.js` (wallet, inventory and escrow transfers), and `market/simulation.js` (existing NPC sale probability and elapsed intervals).
- Existing items, market listings, asking prices, coins, saved offers and unique item IDs carry forward. The save uses the same browser key and save version 4, with a new `market.schemaVersion` field and reserved empty collections for later NPC listings, negotiations, traders and price history.
- Current pricing, case odds, dealer negotiations, the 5% listing-sale fee and sale probabilities are unchanged.
- Added migration, double-settlement and price-equivalence tests, plus mobile smoke validation.
- **Exactly one skin is active and approved: MAC-10 | Red Devil.** The eligibility layer continues to support future cosmetics only after explicit approval.
- Real multiplayer trading and account-based saving remain out of scope.

## Marketplace 0.4.1 — Universal listings

- All eligible owned cases and base weapons, including saved legacy weapon models and the approved Red Devil finish, may be listed from inventory or directly from the Market trading desk. The transaction model also accepts cosmetic skin items **only after those skins are separately approved and released**; the active Arsenal Case now has **one individually approved skin**.
- A mobile-friendly listing editor accepts any whole-coin asking price from 1 through 100,000,000. Quick-price suggestions, the item preview, estimated value, a live 5% fee calculation and net proceeds make each asking price transparent.
- Active listings now show their ask, estimated reference value, expected net proceeds and date. Sellers can **edit prices without cancelling**; repricing keeps the original listing and item IDs, original creation timestamp, and escrow ownership.
- Repricing resets the next simulated buyer-check time, so old elapsed intervals cannot be back-applied to a newly lowered price. Cancelling restores the exact item without fees.
- Every change is journaled and saved using the existing local save key and version 4; old backups and listings remain usable.
- Existing NPC sale odds, case odds, case pool and dealer offers are unchanged. Browsable NPC weapon listings and advanced haggling are planned for later patches.

## Marketplace 0.4.2 — Browsable simulated NPC market

- The Market now offers 15 **persistent, individually priced NPC listings** drawn only from the game's currently approved drop catalog: 24 base weapon models, the personally approved MAC-10 | Red Devil skin, and sealed cases. No unapproved or generated finishes enter the marketplace.
- Each offer has a stable seller, exact item ID, asking price, time posted, and expiration time. Search by weapon, finish, or seller; filter by item type/rarity and sort by price, value, or recency.
- Inspect a real listing's weapon image, rarity, posted price, reference value and item attributes before buying. A successful purchase debits the exact posted price, transfers the exact listed instance (preserving its identity and fields), removes the NPC listing, and records the event in the save's transaction history.
- Simulated NPC stock is generated and **saved on the first Market visit**, not regenerated on every page open. Stock replenishes at most once per 20-minute elapsed interval, up to a maximum of 15; unsold listings expire after 24–72 hours. No restocking by switching tabs or refreshing.
- The existing player listing editor, listing escrow and offline simulated player sales are preserved. Saving remains local to your device (same key and version 4). Older save exports remain importable; NPC import validation rejects bad prices, duplicate IDs and unapproved skins.
- This is a **single-player simulation**, not real player-to-player trading. Offer/counteroffer haggling with individual NPC traders is scoped to **Patch 0.4.3**.

## Economy and progression

Players earn starter coins through MicroTasks, buy unopened cases, open them, inspect rewards, negotiate dealer offers, instantly sell, or list items for simulated marketplace sales. Listings enter escrow; player-owned items and wallet changes are saved, and NPC purchases are simulated when enough time has elapsed. The portfolio keeps a transaction journal and market-value estimate.

## Save upgrade and safe migration

The game uses the **existing** browser-local key `loothub-arsenal-alpha-v1`, now writing **save version 4**. This release preserves the one currently approved Red Devil skin and converts older unapproved skins and listings to their matching **unskinned base weapons**. It **preserves wallet, unique item IDs, item counts, case counts, history, listing escrow, asking prices, negotiation state, reputation, and market value at the conversion moment**. Wear/float/pattern and old finish names are removed from migrated items; the conversion applies their old valuation exactly once. Items from weapon types removed in an earlier catalog change remain accessible as legacy base weapons rather than being destroyed.

The previous raw save is retained as a local snapshot during the first updated save. Older exported saves are accepted and migrated when loaded. Users can download, import, or restore progress from the Saves tab.

**Saving is device- and browser-specific, not cloud/account based.** Export a backup before clearing browser data or changing devices.

## Verification

- `node tests/core.cjs` checks base-only catalog/manifest parity, all active WebP masters, the new seven bases and Red Devil rendering paths, absence of unapproved cosmetics, case opening, value-preserving migration, old save imports, listing escrow, backup recovery, and stale-tab safety.
- `node tests/smoke.cjs` runs the Playwright mobile UI test; Playwright Chromium must be installed.
- `.github/workflows/base-weapons-ci.yml` runs the Node core suite on pushes to `main`.

The `assets/neutral-art` and `assets/skins` JS modules are only a base64 transport mechanism for exact transparent WebP files on static hosting; they do not paint or stylize the approved neutral masters.

## Scope

The game is a simulated, local single-player economy, without real-money trading, server-authoritative transactions, or cloud saves. Case outcomes and market activity are generated locally.
