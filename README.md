# LootHub — Arsenal Alpha

Single-player browser-based loot trading prototype. Open `index.html` in a browser, or deploy this static site using GitHub Pages / Vercel.

## Current features
- Start at 0 coins; MicroTasks earns 1 coin per click.
- Arsenal Case costs 25 coins in the case store.
- NPC marketplace offers sealed cases and price negotiation.
- Sealed cases can be held, sold, or opened.
- Five universal rarity tiers with published drop rates: 70%, 20%, 7.5%, 2%, 0.5%.
- 19 original fictional finishes across real-world weapon model names, including rare knives.
- Floats, wear, patterns, StatTrak variants, item inspection and estimated valuations.
- Animated opening reel, skip, inventory, instant dealer sales and buyer negotiation.
- Portfolio, activity history, localStorage saves.

## Current limitations
- Local saves are device/browser specific, not account-based or cloud-synced.
- Placeholder emoji imagery; no final weapon renders or sound.
- NPC marketplace is simplified, not a fully simulated order book.
- Opening outcomes use browser randomness; production release needs server-authoritative transactional RNG.
- Price bands and odds are provisional, and economy balance is unverified.
- No real-money transactions or cash-out.

## Next milestones
1. Build and test the opening reel, mobile UI and purchase flow.
2. Replace placeholder art with consistent original weapon renders.
3. Add persistent account saving with authenticated, server-side transactions.
4. Deepen NPC market behavior, item listings and transaction safeguards.
5. Deploy a live preview and run regression tests.

This alpha intentionally prioritizes a playable economy loop over content volume.
