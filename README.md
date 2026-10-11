# LootHub — Arsenal Alpha 0.2

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
- Responsive dark website interface with crisp, original vector item silhouettes.

## Saving progress

**The game autosaves on the current device and browser.** It retains wallet balances, clicked earnings, purchase costs, sales, owned cases and skins, attributes, marketplace listings, negotiations, portfolio stats, transaction history, reputation and current page. Save format upgrades preserve earlier LootHub localStorage progress.

The Saves tab provides:
- JSON export of your entire saved game.
- Import of a previously exported save.
- Restoration of the previous local browser snapshot, if available.
- A local save indicator; storage write failures display a warning.

**This is not yet account-based or cloud saving.** Progress is associated with the current browser origin/profile, and can be lost if the browser's site data is deleted or the phone is replaced. Export your backup for transferring between devices. Changes in a different browser tab are not synchronized. Private Browsing is not reliable long-term storage.

## Developer checks

`node tests/smoke.cjs` runs Playwright Chromium mobile-viewport tests. GitHub Actions is configured to run the smoke test for pushes to main. The test covers earning, purchase, inventory persistence, opening, selling, market listings, export, backup recovery, and JavaScript errors. A successful Vercel deployment only means the files built successfully; it does not itself prove the interactive browser test passed.

## Known limitations

- The current weapons are original **SVG illustration placeholders**, not final textured high-resolution rendered skins.
- Still uses client-side random outcomes and client-authoritative transactions; not secure against save modification or exploits.
- NPC buyers are simplified, not a deep supply/demand economy.
- Save snapshots are finite browser-local storage; a full browser quota or cleared site data can still lose progress.
- No real-money transactions or cash-out.

## Next major work

1. Add authenticated database-backed cloud saves and server-authoritative transaction records.
2. Refine cinematic openings, item art and inspect screens.
3. Improve market simulation, prices, liquidity and negotiated offers.
4. Run and verify mobile end-to-end browser CI and audit persistence and economy edge cases.
