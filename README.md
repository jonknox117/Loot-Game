# LootHub — Curated Arsenal (Procedural Wear Engine 0.5.3)

**Playable:** https://jonknox117.github.io/Loot-Game/

A mobile-first, browser-based collectible weapon and marketplace game. The collection contains **24 unskinned base weapon models and five owner-approved collectible skins**. Future skins may enter only through the game owner's explicit selection and approval.

## Current Arsenal Case — approved collection

| Drop tier | Models |
| --- | --- |
| Common | Glock-18, MP5, MAC-10, Tec-9, 12 Gauge Pump Shotgun |
| Uncommon | Desert Eagle, Colt .45 Revolver, SPAS-12, M1911, Thompson SMG |
| Rare | AK-47, M4A4, Tactical Machete, M60, M1 Garand, Kar98k, FN SCAR-L, FN FAL |
| Super Rare | AWP, Tactical Tomahawk, RPG-7 |
| Legendary | Karambit, Butterfly Knife, M134 Minigun, **MAC-10 | Red Devil (approved skin)** |

Tier probabilities: 70% / 20% / 7.5% / 2% / 0.5%. A case costs 25 coins. The 24 base models are unskinned and have no finish/paint, float, pattern, or StatTrak rolls. There are five approved cosmetics, beginning with **MAC-10 | Red Devil**, which is separately obtainable in the Legendary tier and does not overwrite the original MAC-10 model. Artwork in the case, opening reel, inventory, market listings, and inspect screen uses the unskinned master for base weapons and the separately approved Red Devil art only for that specific skin.


## October 12 owner-approved skin update

These five independently collectible skins use the exact owner-supplied images (transparent WebP exports for reel, inventory, and inspection) and do not overwrite neutral weapon artwork.

| Skin | Tier | Base value |
| --- | --- | ---: |
| MAC-10 \| Red Devil | Legendary | 1,800 |
| RPG-7 \| Glory | Super Rare | 1,200 |
| Colt .45 Revolver \| High Stakes | Super Rare | 900 |
| Butterfly Knife \| The Hydra | Legendary | 3,600 |
| FN FAL \| The Luck O The Irish | Rare | 320 |

All five can drop from the Arsenal Case and are eligible for inventory sales and NPC marketplace listings. The published tier odds and 25-coin case cost are unchanged, and existing saved items and wallets remain compatible.

## Master artwork

- `assets/manifest.json` is the canonical **24-base-model plus one-approved-skin registry**.
- 19 supplied/approved weapon models load right-facing, transparent neutral masters through individual `assets/neutral-art/<model>.js` files containing 400/800/1600-pixel WebP images.
- Newest user-supplied masters: **M1911, M1 Garand, Kar98k, Thompson SMG, FN SCAR-L, FN FAL, and M134 Minigun**. Original silhouettes and orientation are kept; supplied JPEG white backgrounds are converted to actual transparency.
- First approved skin: **MAC-10 | Red Devil**, sourced directly from the user's finished image and kept in `assets/skins/mac-10--red-devil.js`. The unpainted MAC-10 master stays separate.
- Glock-18, AK-47, AWP, M4A4 and Karambit use the original `assets/renders/masters/<model>-neutral-1600.webp` raster files.
- `assets/weapon-masters.js` is a neutral-only vector fallback for retired weapon models from older saves. Its colorful procedural finish palettes were removed.
- Previous unapproved skin art may remain as historical files in the repository, but is **not active, selectable, rolled or rendered**. Five owner-approved finishes are registered.
- Future skins enter only after approval. The supplied Red Devil design is currently assigned Legendary rarity; that placement can be changed without changing its image.

## Marketplace 0.4.0 — Foundation patch

The initial marketplace patch restructured the existing marketplace; the current curated-art update separately releases one owner-approved Red Devil skin.

- Market logic now lives in `market/core.js` (item eligibility, valuations and versioned state), `market/transactions.js` (wallet, inventory and escrow transfers), and `market/simulation.js` (existing NPC sale probability and elapsed intervals).
- Existing items, market listings, asking prices, coins, saved offers and unique item IDs carry forward. The save uses the same browser key and save version 4, with a new `market.schemaVersion` field and reserved empty collections for later NPC listings, negotiations, traders and price history.
- Current pricing, case odds, dealer negotiations, the 5% listing-sale fee and sale probabilities are unchanged.
- Added migration, double-settlement and price-equivalence tests, plus mobile smoke validation.
- **Five owner-selected skins are active, including MAC-10 | Red Devil.** The eligibility layer continues to support future cosmetics only after explicit approval.
- Real multiplayer trading and account-based saving remain out of scope.

## Marketplace 0.4.1 — Universal listings

- All eligible owned cases and base weapons, including saved legacy weapon models and the approved Red Devil finish, may be listed from inventory or directly from the Market trading desk. The transaction model also accepts cosmetic skin items **only after those skins are separately approved and released**; the active Arsenal Case now has **one individually approved skin**.
- A mobile-friendly listing editor accepts any whole-coin asking price from 1 through 100,000,000. Quick-price suggestions, the item preview, estimated value, a live 5% fee calculation and net proceeds make each asking price transparent.
- Active listings now show their ask, estimated reference value, expected net proceeds and date. Sellers can **edit prices without cancelling**; repricing keeps the original listing and item IDs, original creation timestamp, and escrow ownership.
- Repricing resets the next simulated buyer-check time, so old elapsed intervals cannot be back-applied to a newly lowered price. Cancelling restores the exact item without fees.
- Every change is journaled and saved using the existing local save key and version 4; old backups and listings remain usable.
- Existing NPC sale odds, case odds, case pool and dealer offers are unchanged. Browsable NPC weapon listings and advanced haggling are planned for later patches.

## Marketplace 0.4.2 — Browsable simulated NPC market

- The Market now offers 15 **persistent, individually priced NPC listings** drawn only from the game's currently approved drop catalog: 24 base weapon models, the five personally approved skins, and sealed cases. No unapproved or generated finishes enter the marketplace.
- Each offer has a stable seller, exact item ID, asking price, time posted, and expiration time. Search by weapon, finish, or seller; filter by item type/rarity and sort by price, value, or recency.
- Inspect a real listing's weapon image, rarity, posted price, reference value and item attributes before buying. A successful purchase debits the exact posted price, transfers the exact listed instance (preserving its identity and fields), removes the NPC listing, and records the event in the save's transaction history.
- Simulated NPC stock is generated and **saved on the first Market visit**, not regenerated on every page open. Stock replenishes at most once per 20-minute elapsed interval, up to a maximum of 15; unsold listings expire after 24–72 hours. No restocking by switching tabs or refreshing.
- The existing player listing editor, listing escrow and offline simulated player sales are preserved. Saving remains local to your device (same key and version 4). Older save exports remain importable; NPC import validation rejects bad prices, duplicate IDs and unapproved skins.
- This is a **single-player simulation**, not real player-to-player trading. Offer/counteroffer haggling with individual NPC traders is scoped to **Patch 0.4.3**.

## Marketplace 0.4.3 — Two-way haggling

- Every persistent NPC listing has **Make offer** controls, an offer transcript, seller counteroffers, and a maximum of three player-submitted offers. Seller limits are determined once per listing, not rerolled by closing the dialog, switching tabs, or reloading the browser.
- Sellers can accept, counter, or permanently walk away. Buyers can accept a counteroffer, decline the negotiation, or complete an agreed purchase. Asking-price purchases continue to work independently.
- Player-owned listings automatically receive one simulated collector offer when shown in the market; **Review offer** opens the matching saved transcript. The player can accept the NPC offer or counter. Final settlement credits proceeds after the same 5% listing fee.
- **Agreed is not the same as paid:** a final **Complete purchase** or **Complete sale** step must succeed before money or the exact collectible moves. Insufficient funds leave an agreement in place without an item transfer.
- Settlement helpers refuse negotiated discounts without a matching, still-valid saved agreement. Completed trades cannot repeat. Selling, cancelling, repricing, or expiration makes unfinished negotiations unavailable, rather than leaving stale bargains usable.
- Offer histories persist under the existing \`market.negotiations\` array and are included in local browser backups; older saves migrate with no inventory, wallet, listing ID, or case-odds changes.
- Existing fast instant sales and their separate legacy dealer option are unchanged. Advanced trader personalities and broader market pricing behavior are planned for subsequent patches.

## Marketplace 0.4.4 — NPC trader personalities

- Six distinct trading styles now shape prices and outcomes: Bargain Hunter, Collector, Impatient Trader, Veteran Dealer, Wealthy Enthusiast, and Opportunist. Each one has a different negotiation floor/ceiling, degree of concession, and patience (2–4 rounds).
- Ten existing NPC sellers now have persistent profiles. Six named specialist buyers enter the **Meet the Buyers** directory, with collectible preferences, saved finite budgets, and a visible negotiation style.
- NPC buyers prefer different weapon families (knives, rifles, pistols, shotguns, SMGs, cases, heavy weapons, sniper rifles, approved skins). A specific collector's budget and preferences influence whether they offer on your listing and how much they are willing to pay.
- Buyer wallets are debited only on successful negotiated transfers; NPC vendor wallets receive coins from purchases. An agreed sale cannot complete when its buyer lacks the funds. A new listing without any affordable buyer displays **No affordable buyer yet** rather than pretending an NPC can purchase it.
- Negotiations snapshot the selected trader, offer limits, patience and concession rate at their first opening. Closing or reloading does not reroll offers, and old negotiations lacking these new fields retain their prior behavior.
- The trade history, existing item IDs, local save key/version, marketplace fees, base weapon pool, and the originally approved Red Devil skin remain unchanged. Dynamic supply/demand pricing remains planned for 0.4.5.

## Marketplace 0.4.5 — Dynamic economy

- Every collectible retains its **fixed base estimate** from the approved weapon catalog. A distinct **market value** now responds to confirmed single-player marketplace purchases, player listing sales, and available listing supply. Price history is keyed to the weapon/finish type rather than an individual item ID.
- **Market Pulse** displays current values, base estimates, supply counts, percentage change, and observed trade volume for eight highlighted collectible markets. Inventory and escrow net-worth indicators use market marks; the fixed base estimate is separately available in portfolio and trading details.
- Every successful NPC purchase or completed player listing sale records the exact executed price and trade direction. Trades influence a small saved price momentum; posted NPC/player asking prices do not change after listing or on page refresh. Newly restocked NPC items price from the current market estimate.
- Manipulation guardrails: market multipliers are clamped to 70–135% of the base, a single trade changes momentum only modestly, at most six trades **per item type per day** may move prices, recent samples are bounded, clock rollback cannot trigger a new daily quota, and momentum decays over time. Listing scarcity contributes at most ±8%.
- Opening the marketplace, changing filters, reloading, or re-listing cannot themselves create a completed-trade signal. Only successful exchange of coins/items changes transaction-based momentum; old item IDs, save keys, dealer offers, active skin approval, and case odds remain unchanged.
- New saves retain market signals in \`market.priceHistory\`. Existing version 4 saves with empty price history work as-is; imports reject corrupt or unbounded history. This remains a **single-player simulated economy**, not a network-wide exchange or independent live market data.

## Marketplace 0.4.6 — Offline market simulation

- Leaving the game and returning now processes **elapsed marketplace activity**, regardless of which screen was previously selected. The same state engine also handles periodic market checks while playing.
- Player-owned escrow listings continue to use their original buyer probabilities and 5% sale fee. Expired NPC listings disappear; supply replenishes gradually from the owner-approved catalog. Pending negotiations for expired/sold items become unavailable.
- Simulated NPC buyers can autonomously buy up to **two existing NPC listings per catch-up pass**. These trades debit the finite buyer budget, credit the seller, remove the exact item from NPC escrow, and register an executed-market trade for dynamic pricing. They **never charge the player or add phantom inventory**. Already-agreed player–NPC purchases are protected from competing NPCs until expiry.
- NPC collectors may discover existing player listings while the player is away; offers are saved against the exact listing lifecycle, use trader preferences/budgets, and do not reroll on reload.
- Offline processing uses 15-minute market intervals and is capped at **8 simulated hours per return**, with at most two NPC-to-NPC trades and the existing 120-minute cap on unattended player listing sales. Excess time is deliberately skipped, rather than replayed on repeated refreshes. Going backward on the device clock cannot produce additional market events.
- The **While You Were Away** market panel summarizes how much time was simulated, completed player/NPC sales, offers, expired inventory, and restocks. The latest summary is saved with the market state and protected by import validation.
- All activity is local browser simulation, not actual background execution or live cross-device trading. Client-side time limitations reduce farming and accidental runaway effects but cannot reliably prevent intentional device-clock tampering; authoritative validation would require a server in a future version.

## Marketplace 0.4.7 — Mobile trading workspace

- The Market begins with **touch-friendly section shortcuts** for NPC browsing, your listings, the offers/history desk, and selling from your inventory. Jump buttons scroll to the corresponding section without changing your saved game.
- NPC search, rarity, item-type, and price sorting now include an **affordability** filter (only listings your wallet can afford) and an **at-or-below-market** filter, plus a clear Reset Filters control. Filtering does not reroll persistent offers, prices, or item IDs.
- The **List from Inventory** section now searches *every eligible owned collectible*, not just the first six. Filter by weapon/case/approved skin, sort by market value or name, and use **Show more** to page through large inventories in groups of 12. Listing and cancellation still operate on the exact selected item and its escrow ID.
- The new **Trading Desk** lets you filter saved negotiations by direction (buying/selling) and state (active, agreed, completed, closed/expired). Continue eligible open offers; finished or invalidated deals open a **read-only negotiation transcript**. New negotiations save the item name for future auditability, including after the item leaves the inventory.
- **Recent Market Activity** displays the existing market-related transaction journal; all historical records remain in the player's existing saved ledger. No new wallet mechanics, trade generation, cosmetic items, or unrelated background operations were introduced.
- All trading filters are UI-only and do not mutate the game. The approved 24 base models and MAC-10 | Red Devil, market price bands, buyer budgets, successful-sale fees, case odds, offline simulations, current browser save key and save version are preserved.

## Marketplace 0.4.8 — Final balancing and transaction hardening

- Fix save-export/import validation for legitimate **four-offer** negotiations from patient collectors. Invalid or out-of-range attempts still fail validation.
- Preserve accepted player-listing negotiations against competing automatic sales. The listing's simulated time is consumed while an agreed buyer has the item reserved.
- Reject purchases of expired NPC offers even when a stale listing remains open on screen.
- Respect outstanding accepted agreements before debiting an NPC buyer's remaining funds for a different trade. A completed sale cannot spend budget promised to another agreement.
- Add safe-integer wallet, sale-receipt, and spending-total checks before moving inventory. Oversized transactions fail without half-completing.
- Stop the older direct-sale buyer from being endlessly rerolled by walking away and restarting the negotiation. Once that buyer has rejected three offers, the refusal persists on that item.
- Increase deterministic regression and mobile coverage without changing the case odds, sale fee, dynamic pricing bands, NPC market pacing, local-save key, or the **five currently approved skins**. This remains a client-side simulated economy rather than server-authoritative multiplayer trading.

## Wear overhaul 0.5.3 — Reusable procedural weathering engine

`market/wear-renderer.js` creates **four increasingly worn surface treatments** with deterministic scratches, dirt patina, and spot corrosion. No new, duplicate, recolored, or compressed weapon image assets were created.

- **Pristine:** the unchanged original art with no wear canvas. The other four grades increase the number and intensity of scuffs, dark grime, and brown surface corrosion.
- **Automatic clipping:** each effect is drawn to a transparent canvas and then masked using the alpha pixels of the existing 1600-resolution weapon/skin image (`destination-in`). Wear cannot appear on transparent padding or surrounding card backgrounds. **No per-gun manual outline or material mask is needed.**
- **Permanent appearance:** a seeded pseudo-random generator derives every wear mark from an item's saved unique ID. A grade and ID yield the same wear marks across reloads, browsers, trades, and inspections. No game randomness or save fields are consumed by rendering.
- **iPhone-friendly:** weathering is generated on-demand, limited to a 1,100-pixel longest canvas side, device pixel ratio capped at 2, and loaded only after the image is ready. If canvas rendering is unavailable, the unmodified master remains visible. Source WebP art is never overwritten or recompressed.
- **Initial preview integration:** weapon/skin inspection panels, listing-editor large previews and case-opening reward details automatically show the wear overlay. Inventory tiles, small marketplace cards, and case-opening reel tiles will be integrated in **0.5.4** once the high-resolution mask and texture quality are validated.
- **Regression testing:** deterministic pattern density per grade, different shapes for different collectible IDs, zero overlay for Pristine, retina iPhone canvas coverage, alpha-clipped transparent regions, stable appearance after reload, and approved-skin compatibility.

## Wear overhaul 0.5.2 — Visible condition and adjusted market prices

Weapon and skin condition is now both **visible** and **economically meaningful**. All five grades use a shared price table in `market/wear.js`:

| Condition | Value multiplier |
| --- | ---: |
| Pristine | 1.00× |
| Lightly Worn | 0.95× |
| Field-Tested | 0.85× |
| Heavily Worn | 0.70× |
| Battle-Scarred | 0.55× |

- The original immutable **base value** is retained in every collectible. The **condition-adjusted value** is `max(1, round(base × multiplier))`, and the existing live marketplace supply/momentum adjustment applies afterward. For example an MP5 with base 8 in Field-Tested condition has a condition value of 7, followed by the normal market factor.
- Inventory cards, weapon inspections, case-opening reward reveals, NPC market listings and detail screens, player listings, and the market's inventory-for-sale shelf now identify each actual collectible's saved grade. Inspection/listing dialogs show base value, wear modifier, condition-adjusted value, and live market estimate separately.
- Instant sales, the original direct-buyer negotiation, marketplace recommendations and auto-sale probability, NPC-generated asking prices, and new buyer offers now use condition-adjusted market/value calculations. Item identity, condition and base remain unchanged across transfers.
- Previously owned weapons migrated to **Pristine** (1.00×) keep their old base value. **Existing player and NPC asking prices are not rewritten**, even when a different grade has already been saved on the item. Sealed cases have no wear grade and retain their 25-coin reference price.
- Model rarity odds (70/20/7.5/2/0.5), condition-roll odds (8/22/40/22/8), original master images, approved skin images, local save key, and trade history are unchanged. The actual grime/scratch/rust *visual effects* will follow in 0.5.3 and later.

## Wear overhaul 0.5.1 — Independent condition rolls

Each **newly generated weapon or approved skin** receives exactly one independent five-grade wear roll in `market/wear.js`. The random grade is saved with its individual collectible ID before it can be traded or revealed. This applies to the actual result of an Arsenal Case opening and to newly generated NPC listings. Newly purchased **sealed cases stay ungraded**.

| Wear grade | Probability |
| --- | ---: |
| Pristine | 8% |
| Lightly Worn | 22% |
| Field-Tested | 40% |
| Heavily Worn | 22% |
| Battle-Scarred | 8% |

- **Independent rarity**: existing tier odds remain 70%, 20%, 7.5%, 2%, 0.5%. The game determines a weapon/skin normally, then rolls condition using a separate random draw.
- **No rerolls**: an item with a valid saved grade retains it through trading, listing, cancellation, reopening and reload. Existing collectibles and imported legacy backups keep their condition from 0.5.0; any item missing metadata migrates to Pristine, not a random new grade.
- **No extra art yet**: this patch stores wear only. The four reusable transparent-image weathering effects are planned for 0.5.2/0.5.3. Wear labels, value modifiers and NPC negotiation strategies come later; prices remain unchanged in 0.5.1.
- **Tests**: exact threshold boundaries and 10,000 evenly spaced samples verify the 8/22/40/22/8 distribution, independent rarity selection, case isolation, NPC restocking, safe imports and permanent item identity across trading.

## Wear overhaul 0.5.0 — Condition data foundation

This patch introduces a separate, permanent five-grade wear property on each weapon or cosmetic skin instance. The `market/wear.js` module defines the grade index (`wearGrade`), labels, validators, and an idempotent save migration:

| Saved grade | Condition |
| --- | --- |
| 0 | Pristine |
| 1 | Lightly Worn |
| 2 | Field-Tested |
| 3 | Heavily Worn |
| 4 | Battle-Scarred |

- Every previously owned weapon or approved skin, player escrow item, and NPC market weapon/skin gains `wearGrade: 0` if missing. Valid existing grades are retained. Item IDs, asking prices, base values, wallets, art, and rarity stay unchanged.
- In 0.5.0, new weapon/skin drops and replenished NPC items were also Pristine. As of 0.5.1, new items independently roll condition. Sealed cases never have wear.
- Wear moves with the same item object during listing, cancellation, and purchases. Reloading or migration cannot reroll or otherwise change saved conditions.
- `wearSchemaVersion: 1` is stored alongside the game state. Existing backups without wear information remain importable and normalize on load. Invalid grades (anything except integer 0–4), a condition on a sealed case, or unsupported schema versions are rejected.
- This foundation patch did not add procedural overlays, labels, valuation multipliers or images. Wear rolling is now implemented in 0.5.1, while art and economic changes remain reserved for subsequent 0.5 patches.

## Economy and progression

Players earn starter coins through MicroTasks, buy unopened cases, open them, inspect rewards, negotiate dealer offers, instantly sell, or list items for simulated marketplace sales. Listings enter escrow; player-owned items and wallet changes are saved, and NPC purchases are simulated when enough time has elapsed. The portfolio keeps a transaction journal and market-value estimate.

## Save upgrade and safe migration

The game uses the **existing** browser-local key `loothub-arsenal-alpha-v1`, now writing **save version 4**. This release preserves all five approved skins and converts older unapproved skins and listings to their matching **unskinned base weapons**. It **preserves wallet, unique item IDs, item counts, case counts, history, listing escrow, asking prices, negotiation state, reputation, and market value at the conversion moment**. Wear/float/pattern and old finish names are removed from migrated items; the conversion applies their old valuation exactly once. Items from weapon types removed in an earlier catalog change remain accessible as legacy base weapons rather than being destroyed.

The previous raw save is retained as a local snapshot during the first updated save. Older exported saves are accepted and migrated when loaded. Users can download, import, or restore progress from the Saves tab.

**Saving is device- and browser-specific, not cloud/account based.** Export a backup before clearing browser data or changing devices.

## Verification

- `node tests/core.cjs` checks base-only catalog/manifest parity, all active WebP masters, the new seven bases and Red Devil rendering paths, absence of unapproved cosmetics, case opening, value-preserving migration, old save imports, listing escrow, backup recovery, and stale-tab safety.
- `node tests/smoke.cjs` runs the Playwright mobile UI test; Playwright Chromium must be installed.
- `.github/workflows/base-weapons-ci.yml` runs the Node core suite on pushes to `main`.

The `assets/neutral-art` and `assets/skins` JS modules are only a base64 transport mechanism for exact transparent WebP files on static hosting; they do not paint or stylize the approved neutral masters.

## Scope

The game is a simulated, local single-player economy, without real-money trading, server-authoritative transactions, or cloud saves. Case outcomes and market activity are generated locally.
