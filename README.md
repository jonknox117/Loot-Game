# LootHub — Base Arsenal (Marketplace 0.4.1 Universal Listings)

**Playable:** https://jonknox117.github.io/Loot-Game/

A mobile-first, browser-based collectible weapon and marketplace game. The current live collection contains **17 base weapon models and zero collectible skins**. No cosmetic skin may enter the game without the owner's explicit selection and approval.

## Current Arsenal Case — base weapons only

| Drop tier | Models |
| --- | --- |
| Common | Glock-18, MP5, MAC-10, Tec-9, 12 Gauge Pump Shotgun |
| Uncommon | Desert Eagle, Colt .45 Revolver, SPAS-12 |
| Rare | AK-47, M4A4, Tactical Machete, M60 |
| Super Rare | AWP, Tactical Tomahawk, RPG-7 |
| Legendary | Karambit, Butterfly Knife |

Tier probabilities: 70% / 20% / 7.5% / 2% / 0.5%. A case costs 25 coins. Base weapons have distinct tiers and market values, but **no finish name, paint, float, pattern, or StatTrak roll**. Artwork in the case, opening reel, inventory, market listings, and inspect screen uses the same unskinned master for each model.

## Master artwork

- `assets/manifest.json` is the canonical, 17-model **base master registry**, and has `approvedSkins: []`.
- 12 supplied/approved weapon models load right-facing, transparent neutral masters through individual `assets/neutral-art/<model>.js` files containing 400/800/1600-pixel WebP images.
- Newest masters: **M60** (the supplied source JPEG was precisely keyed off its white background) and **RPG-7** (source transparency preserved).
- Glock-18, AK-47, AWP, M4A4 and Karambit use the original `assets/renders/masters/<model>-neutral-1600.webp` raster files.
- `assets/weapon-masters.js` is a neutral-only vector fallback for retired weapon models from older saves. Its colorful procedural finish palettes were removed.
- Previous finished skin images may remain as unused historical files in the repository; they are **not mapped, selectable, rolled, displayed, or used for marketplace trading**.
- Future skins will be introduced only following approval. A finish must never be improvised in the game.

## Marketplace 0.4.0 — Foundation patch

This release restructures the existing marketplace without changing gameplay or approving any skins.

- Market logic now lives in `market/core.js` (item eligibility, valuations and versioned state), `market/transactions.js` (wallet, inventory and escrow transfers), and `market/simulation.js` (existing NPC sale probability and elapsed intervals).
- Existing items, market listings, asking prices, coins, saved offers and unique item IDs carry forward. The save uses the same browser key and save version 4, with a new `market.schemaVersion` field and reserved empty collections for later NPC listings, negotiations, traders and price history.
- Current pricing, case odds, dealer negotiations, the 5% listing-sale fee and sale probabilities are unchanged.
- Added migration, double-settlement and price-equivalence tests, plus mobile smoke validation.
- **Zero skins are active or approved.** The new eligibility layer accommodates legacy items and future explicitly approved skins without creating cosmetics.
- Real multiplayer trading and account-based saving remain out of scope.

## Marketplace 0.4.1 — Universal listings

- All eligible owned cases and base weapons, including saved legacy weapon models, may be listed from inventory or directly from the Market trading desk. The transaction model also accepts cosmetic skin items **only once those skins are separately approved and released**; the active Arsenal Case still has **zero skins**.
- A mobile-friendly listing editor accepts any whole-coin asking price from 1 through 100,000,000. Quick-price suggestions, the item preview, estimated value, a live 5% fee calculation and net proceeds make each asking price transparent.
- Active listings now show their ask, estimated reference value, expected net proceeds and date. Sellers can **edit prices without cancelling**; repricing keeps the original listing and item IDs, original creation timestamp, and escrow ownership.
- Repricing resets the next simulated buyer-check time, so old elapsed intervals cannot be back-applied to a newly lowered price. Cancelling restores the exact item without fees.
- Every change is journaled and saved using the existing local save key and version 4; old backups and listings remain usable.
- Existing NPC sale odds, case odds, case pool and dealer offers are unchanged. Browsable NPC weapon listings and advanced haggling are planned for later patches.

## Economy and progression

Players earn starter coins through MicroTasks, buy unopened cases, open them, inspect rewards, negotiate dealer offers, instantly sell, or list items for simulated marketplace sales. Listings enter escrow; player-owned items and wallet changes are saved, and NPC purchases are simulated when enough time has elapsed. The portfolio keeps a transaction journal and market-value estimate.

## Save upgrade and safe migration

The game uses the **existing** browser-local key `loothub-arsenal-alpha-v1`, now writing **save version 4**. This release converts existing owned retired skins and active listings to their matching **unskinned base weapons**. It **preserves wallet, unique item IDs, item counts, case counts, history, listing escrow, asking prices, negotiation state, reputation, and market value at the conversion moment**. Wear/float/pattern and old finish names are removed from migrated items; the conversion applies their old valuation exactly once. Items from weapon types removed in an earlier catalog change remain accessible as legacy base weapons rather than being destroyed.

The previous raw save is automatically retained as a local snapshot during the first updated save. Older exported saves are accepted and migrated when loaded. Users can download, import, or restore progress from the Saves tab.

**Saving is device- and browser-specific, not cloud/account based.** Export a backup before clearing browser data or changing devices.

## Verification

- `node tests/core.cjs` checks base-only catalog/manifest parity, all active WebP masters, M60 and RPG-7 rendering paths, absence of old cosmetics, case opening, value-preserving migration, old save imports, listing escrow, backup recovery, and stale-tab safety.
- `node tests/smoke.cjs` runs the Playwright mobile UI test; Playwright Chromium must be installed.
- `.github/workflows/base-weapons-ci.yml` runs the Node core suite on pushes to `main`.

The `assets/neutral-art` JS modules are only a base64 transport mechanism for exact transparent WebP files on static hosting; they do not paint or stylize the approved neutral masters.

## Scope

The game is a simulated, local single-player economy, without real-money trading, server-authoritative transactions, or cloud saves. Case outcomes and market activity are generated locally.
