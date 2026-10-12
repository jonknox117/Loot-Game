# Karambit | Golden Talon — source prompt and production checklist

**Patch:** 0.3.3F artwork preparation  
**Status:** Production brief ready; no raster asset generated, approved, or enabled by this commit.  
**Existing catalog identity:** `Karambit | Golden Talon`, Legendary (tier 4).  
**Visual intent:** Luxury predator-inspired karambit. **An eagle brow and small dark eye are embossed at the blade-to-hilt junction**, not printed as a decal. The gold is physically credible; the black grip provides contrast.  
**Approved art references:** Same clarity and controlled studio lighting as LootHub's Glock-18, AK-47 and AWP pilot masters. The M4A4 raster is a provisional source and should not lower the standard.

## 1. Neutral master — generation / sourcing prompt

Use this prompt to obtain a **single isolated neutral base weapon**. Do not generate a multi-gun chart, text-heavy product poster, or several variants together.

> Single premium collectible karambit knife, **one object only**, isolated as a clean photorealistic 2D studio product render, near-perfect side profile using orthographic perspective, 2:1 landscape composition. **Finger ring on the left, hooked talon blade and sharp point on the right**, both fully visible. Immediately recognizable real-world-style karambit silhouette: strong inward-curved blade, accurately joined pivot/heel, compact ergonomic handle, perfectly open circular finger ring and believable hardware. Dark neutral satin steel blade and edge, graphite textured grip, understated metal ring and fasteners, precisely defined blade spine, grinding lines and cutting edge, no decorative finish yet. Realistic fine machining and bevel highlights, soft neutral studio key from upper left and subtle restrained cool rim light from opposite side. Centered across approximately 68–74% of the 2400×1200 canvas width, with at least 8% transparent breathing room on all four sides. Fine high-frequency detail remains crisp at a 160-pixel-wide mobile inventory card. **True transparent alpha background**, sRGB, full object including tip and ring, no shadows baked outside the subject, no letters, no labels, no watermark, no UI, no case, no glow, no hand, no second object.

**Rejection list:** Baked checkerboard backdrop; backwards orientation; straight dagger blade; closed finger ring; ring merged into grip; floating/pasted hardware; melted pivot; asymmetrical or warped blade; extra edge/blade; cropped tip/ring; cartoon prop styling; cheap 3D plastic; excessively shiny chrome; artificial colored skin elements; illegible hardware; bundled variants or weapon charts.

### Source discipline

- Prefer a single full-frame original, or a **rights-cleared accurate 3D mesh rendered offline to 2D**. Do not enlarge a 300–500px cutout from a moodboard and call it a 1600px original.
- Request the largest native image the creator/tool genuinely supports. Record **native resolution separately from working/export resolution**.
- If generated alpha is imperfect, segment and clean at source resolution without changing the knife's silhouette. Use a checkerboard only for QA, not in the exported background.
- Retain unflattened original and a lossless 2400×1200 RGBA working master, or honestly record that any larger canvas is interpolated.
- Neutral master is **finish-agnostic**. No gold in the base master.

## 2. Golden Talon — image-edit / finish direction prompt

**Use the exact approved neutral master as the input**. This is an in-place finish design/edit, **not** an instruction to reimagine or regenerate a different karambit. For photoreal consistency, preferably composite actual material masks onto that neutral source and hand-finish the metal-relief detail.

> Transform the **existing neutral karambit image** into LootHub's Legendary finish **Golden Talon**, keeping **every silhouette pixel, position, camera angle, finger-ring opening, hilt shape, pivot, edge, blade curvature, scale, and framing exactly unchanged**. Render a physically convincing **deep warm brushed gold blade**, with polished bright gold highlights along the cutting bevel and darker burnished-gold shadows inside the spine and engraved recesses. Keep the **grip matte black/charcoal with fine tactile crosshatch**, restrained warm gold structural trim and dark hardware. At the **blade-to-hilt junction near the heel, just forward of the pivot**, make the naturally rising spine look like a **sculpted eagle's angular forward-sweeping brow ridge**, and place **one small, oblique smoky-obsidian/black-enamel inset eye directly under that brow**. The brow should appear embossed or machined in metal, modeled with subtle highlight and contact-shadow relief, not painted onto the blade as a cartoon outline. Suggest an eagle's head **only through the brow-to-eye relationship and the existing hooked contour**, with no complete beak, literal bird picture, or added protrusions. Engrave **three to five restrained, fine feather-inspired swept lines** flowing backward from the brow into the upper handle/heel. Maintain a clean cutting edge, open finger ring, practical ergonomics, studio upper-left lighting, transparent background, and crisp metallic micro-detail. This is luxurious, predatory, elegant collectible craftsmanship—not exaggerated fantasy cosplay.

**Negative constraints:** No illustrated full eagle face, giant ruby eye, cartoon eyelashes, beak glued to blade, eagle skull, feathers pasted across cutting edge, engraved bird logo, oversized crest, ornamental spikes, gold-colored scope/guns, random bright blue/red neon, yellow plastic sheen, uniform gold tint over the grip, new blade geometry, altered silhouette, shifted pivot or ring, typographic branding, painted checkerboard.

### Exact motif layout (fractional local coordinates)

Measurements are relative to a bounding box around **the blade and heel section**, *not* absolute pixels. Final placement must be validated on the actual image.

- **Brow ridge:** on the raised spine where blade meets handle, just forward of pivot; roughly **10–18% of the blade section length**. The ridge follows the existing curve; **no additional external silhouette protrusion**.
- **Eye:** immediately below and slightly behind the highest brow point, oriented forward toward the hooked blade. Size about **2–3% of total knife width** in the 1600px inspect export; dark recess with a very fine warm gold reflective edge.
- **Feather cuts:** **3–5 thin engraved lines** radiating rearward from the motif zone toward the handle; shallow etched gold-on-gold contrast, visible under studio lighting but not intrusive at card size.
- **Gold zone:** blade flats and supporting collar/trim. The gold does **not** indiscriminately cover polymer grip, open ring interior, or dark mechanism.
- **Handle:** matte textured charcoal/black. Ring gets warm gold beveled structural edge, while its opening remains visibly transparent.

## 3. Geometry-locked production checklist

Complete sequentially. A failed gate stops that stage; do not replace live SVG until final files exist and pass QA.

- [ ] **Neutral-source identity.** Only one knife; blade pointed right, ring left. Correct inward-curved karambit shape, readable edge and pivot. No severe distortions at 160px.
- [ ] **Rights and provenance.** Save original source, creator/tool, generation date, origin, permission and native resolution to `assets/source/karambit/provenance.json`. Do not import protected game meshes/skins without rights.
- [ ] **Transparent master.** Produce `neutral-master-2400.png` (2400×1200 RGBA) plus optional editable/3D source. Background must be alpha=0, not a checkerboard image. Crop has 8% margin; ring hole visibly open.
- [ ] **Master source QA.** At true original resolution verify tip, tang, bevel, screws, ring interior, handle texture, no plastic gloss or double edges. Compare visually with existing pilot masters.
- [ ] **Paint masks.** Produce pixel-aligned grayscale masks: `blade-main`, `blade-edge`, `motif-zone`, `handle`, `ring`, `hardware`, `edge-highlight`, `ao-shadow`. All match master dimensions. Keep inner ring hole untouched.
- [ ] **Signature brow.** Emboss/machine a subtle forward-looking ridge **inside** the existing blade/heel contours. Ridge catches top-left light and has a small realistic contact shadow. No bird-outline sticker.
- [ ] **Eye and feathers.** Place one small dark inset eye under brow, with 3–5 thin rearward etched feather lines. Verify the design reads as an eagle only on closer inspection, not a cartoon face at card size.
- [ ] **Material realism.** Gold on blade and trim with dark recess depth; matte black textured handle, meaningful steel/hardware separation; keep cutting bevel sharp and reflective.
- [ ] **Canonical alpha parity.** Composite the finish **inside neutral masks**, then explicitly set its alpha equal to the neutral master. Assert exact alpha-channel byte equality for neutral versus Golden Talon at working resolution.
- [ ] **Generate exports.** Render `karambit-neutral-{400,800,1600}.webp` and `karambit--golden-talon-{400,800,1600}.webp` at exactly **400×200**, **800×400**, **1600×800**; WebP with transparency, sRGB and Lanczos scaling from the same working PNG—not from the 400px preview.
- [ ] **Export validation.** Check each file decodes, contains a real alpha channel, background is transparent and ring hole is open. Re-open finished WebPs and check neutral/finish alpha equality at each resolution.
- [ ] **Small-card review.** Test 160px and 320px effective display sizes. Should read as a **gold karambit** immediately; eye/embossing should reward zoom rather than clutter the thumbnail.
- [ ] **Inspect review.** At large inspect scale the dark eye, relief brow and engraved feathers are crisp and distinctly *material*, not printed/glowing.
- [ ] **Integrate via approved explicit asset mapping.** Keep exact weapon/finish identity `Karambit|Golden Talon`. Use 400/800/1600 paths in case reel, card/market and inspect respectively. Maintain vector SVG fallback for failed image loads.
- [ ] **Rendering parity.** Confirm winning reel tile and final reveal use the same finish/version and visual colors, with only export-resolution differences.
- [ ] **Gameplay regressions.** Verify case purchase/opening, inventory, save/reload, trading, listings, JSON backup/recovery and no error logs. No changes to rarity odds, weapon names, balance or item IDs.
- [ ] **Device QA and approval.** Test at 390px Safari and 1280px desktop; check 2D inspect stage, overflow, sharpness and tapping. Mark final `approved: true` **only after** independent visual approval.

## 4. Future asset paths

The following are **expected future outputs**. **No image file is asserted to exist yet.** Do not reference these URLs in runtime until they have been committed and verified.

```text
assets/source/karambit/
  neutral-master-2400.png
  provenance.json
  masks/
    blade-main.png
    blade-edge.png
    motif-zone.png
    handle.png
    ring.png
    hardware.png
    edge-highlight.png
    ao-shadow.png

assets/renders/masters/
  karambit-neutral-400.webp
  karambit-neutral-800.webp
  karambit-neutral-1600.webp

assets/renders/finishes/
  karambit--golden-talon-400.webp
  karambit--golden-talon-800.webp
  karambit--golden-talon-1600.webp

assets/skin-definitions/
  karambit--golden-talon.json
```

## 5. Compact acceptance rubric

| Area | Pass | Reject |
|---|---|---|
| Model identity | Clear hooked blade, sharp point, distinct ring, credible tang | Dagger/straight blade, incomplete ring, warped construction |
| Signature relief | **One embossed brow + recessed eye** integrated near blade heel | Full illustrated eagle, oversized gemstone, added silhouette |
| Material | Deep metallic gold with shadow depth, matte black grip | Flat yellow, plastic shine, indiscriminate gold overlay |
| Engraving | 3–5 subtle feather lines that follow metal | Printed bird graphic, heavy ornament across cutting edge |
| Geometry parity | Exact shared neutral and finished alpha channels | Different knife shapes between finishes or contexts |
| Small image | Readable at 160px, clean alpha | Blurry image, ring hole vanishes, muddy details |
| Source quality | Sufficient native detail, transparent source, provenance recorded | Tiny contact-sheet crop falsely labeled 1600px original |
| Runtime | All 6 real files, correct URLs, saved item unchanged | Placeholder URLs, reel/reveal mismatch, broken image |

**Stop condition:** If the eagle brow/eye does not read convincingly at 1600px inspection or changes the knife silhouette, redo the motif using the same master, not a different knife.
