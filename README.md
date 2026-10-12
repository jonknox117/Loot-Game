# LootHub — Arsenal Alpha 0.3.3F (Karambit Golden Talon)

Live browser game: https://loot-game-kappa.vercel.app

## Playable features

- Start with zero coins and earn one coin per MicroTasks tap.
- Buy sealed Arsenal Cases for 25 coins, hold or resell them, or open them with an animated item reel.
- 19 original finish concepts covering recognizable firearm model names and rare knives.
- Common, Uncommon, Rare, Super Rare, Legendary tiers; published example drop odds 70/20/7.5/2/0.5%.
- Unique item instances with wear, float, pattern seed, StatTrak chance, rarity and market estimate.
- Instant dealer sale, direct negotiation, and player-owned marketplace listings with an NPC buyer simulation and 5% listing-sale fee.
- Player listings are kept separate from inventory and remain listed on reload; elapsed time is processed on return.
- Portfolio and transaction journal.
- Polished responsive dark website interface with sticky desktop navigation, bottom mobile navigation and sharper item cards.
- **17 original model-specific vector weapon masters**, still used as fallbacks for the full catalog.
- **Seven live transparent 2D finish pilots:** Glock-18 | Slate Grid; AK-47 | Ghostline and Crimson Circuit; AWP | Night Watch and Eclipse; M4A4 | Voltage Bloom; and **Karambit | Golden Talon**. All have 400px reel, 800px inventory and 1600px inspect WebPs, plus archived source art and reproducible scripts.

## Saving progress

**The game autosaves on the current device and browser.** It retains wallet balances, clicked earnings, purchase costs, sales, owned cases and skins, attributes, marketplace listings, negotiations, portfolio stats, transaction history, reputation and current page. Save format upgrades preserve earlier LootHub localStorage progress.

The Saves tab provides:
- JSON export of your entire saved game.
- Import of a previously exported save.
- Restoration of the previous local browser snapshot, if available.
- A local save indicator; storage write failures display a warning.

**This is not yet account-based or cloud saving.** Progress is associated with the current browser origin/profile, and can be lost if the browser's site data is deleted or the phone is replaced. Export your backup for transferring between devices. Changes in a different browser tab are not synchronized. Private Browsing is not reliable long-term storage.

## Developer checks

- `node tests/core.cjs` is a deterministic Node.js regression suite covering legacy save migration, interrupted openings, listing escrow, backup recovery, unsafe corruption, concurrent browser tabs, and `assets/manifest.json` parity. Vercel's `buildCommand` runs this suite before deployment.
- `node tests/smoke.cjs` runs a Playwright Chromium mobile-viewport UI smoke test. GitHub Actions is configured to run the Node suite, then this browser test, on pushes to `main`.
- A **READY** Vercel deployment is evidence of a successful deployment/build, not proof of browser-level usability. The Playwright job still needs an independently verified passing result.

## Patch 0.3 milestones

- **0.3.0 Foundation:** save integrity guard, recovery instead of destructive save reset, stale multi-tab protection, deterministic regressions, and 19-item approved-artwork production manifest.
- **0.3.1 Website:** mobile-first CSS design system, navigation, cards, dialogs, case page and portfolio visual consistency.
- **0.3.2 Weapon master foundations:** 17 distinctive, consistent 640 × 270 SVG model silhouettes wired into the existing game. All 19 current finishes map to the correct weapon master. Preliminary finish palettes are in place; original textured skin artwork remains unapproved.
- **0.3.3A Master pilot:** created a clean transparent Glock-style 2D base render, generated slide/body paint masks and a reusable Slate Grid finish, exported three high-quality sizes and integrated the actual WebPs into the live site (not base64 page data). Source geometry is AI-generated, a plausible Glock-like depiction rather than an OEM-certified 3D model. The remaining 18 finishes still use vector art.
- **0.3.3B–C AK pilot completed:** one AK-47 master with Ghostline and Crimson Circuit, sharing identical alpha and model geometry.
- **0.3.3D AWP pilot completed:** standalone right-facing AWP neutral master, Night Watch, and Eclipse, also sharing an exact silhouette.
- **0.3.3E M4A4 provisional bitmap pilot:** original generated M4A4 image, isolated from a comparison reference into one reusable neutral master, with a masked Voltage Bloom finish. All exports face right. The source weapon itself has approximately 1110 native horizontal pixels; the 1600px inspect image is an upscale/export, not native 1600px model detail. The result is **not marked final-approved** and can be upgraded later with a dedicated higher-resolution source.

- **0.3.3F Golden Talon pilot:** original right-facing karambit silhouette, premium burnished-gold blade, dark grip, and an eagle-shaped brow with a small dark recessed eye where blade meets hilt. Feathery relief engraving is drawn into the gold surface. Both neutral and finished exports use **pixel-identical alpha masks**, including the open finger ring, at all three sizes. The generated concept-board source is about 960px across the subject and does not have native 1600px detail; finish is **live but not final-approved**. Source and eight component masks: `/LootHub/loothub-karambit-master-033F.zip`.

## Known limitations

- Seven original finishes use standalone transparent raster artwork; the remaining 12 use model-specific SVG artwork. M4A4 and Karambit are provisional conversions from original generated comparison art, with about 1110px and 960px native weapon detail respectively; their 1600px inspect files are resampled, not native full-resolution originals. Both require final visual signoff. The app does not claim true 3D rotation.
- Still uses client-side random outcomes and client-authoritative transactions; not secure against save modification or exploits.
- NPC buyers are simplified, not a deep supply/demand economy.
- Save snapshots are finite browser-local storage; a full browser quota or cleared site data can still lose progress.
- No real-money transactions or cash-out.

## Next major work

1. Visually review the Golden Talon eagle brow and dark inset eye, then upgrade the provisional M4A4/Karambit native source renders if needed. Convert the remaining twelve SVG-backed finishes using high-resolution isolated masters and shared-geometry finish masks.
2. Add authenticated database-backed cloud saves and server-authoritative transaction records.
3. Refine cinematic openings and inspect screens.
4. Improve market simulation, prices, liquidity and negotiated offers.
5. Run and verify mobile end-to-end browser CI and audit persistence and economy edge cases.
