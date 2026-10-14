# Adding Cases and Weapon Artwork

The single source of truth for themed cases is **assets/case-registry.js**.
Do not add individual case branches to the renderer, shop, inventory, market,
multi-open, roll engine or Collection Book.

The registry includes Arsenal, Cartel, Spec Ops, Lavish and a Vintage draft. Add new cases to the
EXTRA_CASES array. Existing save IDs and historic collections remain unchanged.
Cartel uses its original embedded approved skins; Spec Ops and new cases use
transparent WebP images.

## New case: approved open/closed chests and themed weapons

1. Prepare transparent PNG or WebP source images of the **closed case**, the
   **open case**, and each **approved weapon skin**. The image preparer never
   redraws weapons or strips opaque white/black backgrounds; review and remove
   those backgrounds before continuing.
2. From the project root run the image preparation tool. The fictional Heritage
   example below is a template only (not a released case or approved economy balance):

    python -m pip install pillow
    python scripts/prepare_curated_case.py --case-id heritage --name Heritage --price 75
      --closed ./approved/heritage-closed.png --open ./approved/heritage-open.png
      --skin "Thompson SMG:0:40=./approved/thompson.png"
      --skin "M1911:1:110=./approved/m1911.png"
      --skin "Mosin-Nagant:2:350=./approved/rifle.png"
      --skin "Tactical Tomahawk:3:1050=./approved/tomahawk.png"
      --skin "Double-Barrel Shotgun:4:4200=./approved/shotgun.png"

   Place the options on one line or use shell continuation. The tool prints a
   ready-to-paste case object; insert it into EXTRA_CASES in
   assets/case-registry.js.

3. Keep its released flag **false** until art, names, rarities and values are
   approved. Flip it to true after validation. No further game code is needed.
4. Run the pixel-level art audit (Pillow + Node required), the case registry/core
   tests, and the iPhone browser smoke flow. Missing or malformed released assets
   fail CI instead of shipping a broken case:

    python scripts/audit_artwork_integrity.py
    node tests/case-registry.cjs
    node tests/core.cjs
    node tests/smoke.cjs

   Inspect tests/artwork-review/artwork-review-sheet.png on both light and dark
   halves for alpha fringes, cropped silhouettes and small inscriptions. The
   JSON report checks machine-verifiable integrity; an owner must still verify
   that the pictures match the approved source designs. CI publishes both files
   in its artwork-integrity-review artifact.

## Automatic image filenames

Case chest CLOSED and OPEN (400/800/1254 pixels):
  assets/cases/<id>-case-closed-400.webp
  assets/cases/<id>-case-closed-800.webp
  assets/cases/<id>-case-closed-1254.webp
  assets/cases/<id>-case-open-400.webp
  assets/cases/<id>-case-open-800.webp
  assets/cases/<id>-case-open-1254.webp

For each themed skin (400/800/1600 pixels):
  assets/renders/lines/<id>/<model-slug>--<id>-400.webp
  assets/renders/lines/<id>/<model-slug>--<id>-800.webp
  assets/renders/lines/<id>/<model-slug>--<id>-1600.webp

The model slug is supplied by LootHubWeaponCatalog. For example the
Mosin-Nagant rifle uses its legacy slug kar98k to preserve saved identities.

Case pages, inventory and market listings use CLOSED case art. Reward reveals
use OPEN case art. All case artwork is centered via contain sizing, not cropped.
400 is the reel/tile size, 800 is the inventory/shop size, 1254 is the chest
inspection/open view, and 1600 is the detailed skin inspection size.

For special filenames, the case registry also accepts an explicit per-pose
art mapping of closed/open 400,800,1254 WebP paths, or per-item
art.skin mapping of 400,800,1600 WebPs. Assets must live in assets/ and
cannot traverse out of the repo. Default filenames are preferred.

## Replace just ONE chest image or gun image

The preparer also accepts an artwork-only call. Other files remain untouched.
Use --force only when intentionally replacing previously approved assets.

    python scripts/prepare_curated_case.py --case-id spec-ops
      --closed ./approved/updated-closed.png --force

    python scripts/prepare_curated_case.py --case-id spec-ops
      --skin "SPAS-12:2:350=./approved/updated-spas.png" --force

Use --dry-run to preview the destination filenames without writing. Existing
case prices, skin rarities and player inventories are unaffected by art swaps.

## Add an entirely NEW base gun model

Use the existing scripts/onboard_weapon.py onboarding workflow. It stages the
approved neutral master, rarity, price and material maps. Publishing updates
assets/manifest.json and regenerates assets/weapon-catalog.js, which the
curated registry reads for model names and image slugs. Do not edit the
generated catalog by hand. Verify with:

    python scripts/sync_weapon_catalog.py --check

Once a base gun is registered, a themed variant can use that exact model name
in EXTRA_CASES without modifying the rest of the code.

## What happens automatically after release

The registry handles case pricing, shop panel, 1–5 purchases, open/closed art,
case drop pool, reels, inventory, inspections, market valuation, saved rewards,
mixed multi-opens, and (with collectionId/collectionReward) a permanent
Collection Book reward. Future collections are initialized in older saves
without deleting previous completion records.

Unreleased drafts are excluded from the live shop, odds, market catalogs and
collection rewards. Do not mutate an already published collection roster:
create a new version instead. Cartel and Spec Ops remain unmodified.

## Required release checks

- Closed and open cases entirely fit the frame on iPhone.
- All original weapon art is transparent and loads at every size.
- Buy sealed, buy/open and mixed 1–5 openings work.
- Reload preserves the rolled item, condition, market listing and paid coins.
- No missing WebP assets and no silent fallback to a generic weapon rendering.
- NPC budgets remain independent of asking price for any newly added skin.

## Vintage artwork release

Vintage's five owner-selected models are already registered as a hidden draft:
Colt .45 Revolver, FN FAL, M60, M1 Garand and Butterfly Knife.
The fifth case is only activated once all approved files pass verification.
The complete lossless WebP export pack is distributed as **vintage-release.zip**,
which contains 21 renders and their SHA-256 manifest.

Upload that single archive into the repository at `assets/vintage-release.zip`
(on `main`). The dedicated Install approved Vintage case artwork workflow
checks every image, installs the cases and weapon files, enables the registry
entry, verifies the regression suite, removes the temporary ZIP, and pushes
the playable release to GitHub Pages. This avoids shipping placeholders or
forcing players to download missing art. The installed case uses a 75-coin
price and the existing 70/20/7.5/2/0.5 rarity odds, and joins the Collection
Book with a 25-coin completion reward.
