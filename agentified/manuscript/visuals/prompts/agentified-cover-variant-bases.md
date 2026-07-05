# Agentified cover variant base prompts

These prompts create textless base images for front-cover review comps.

Exact title, subtitle, and author typography belong in the compositor step so the cover language stays editable. The current direction intentionally pulls back from the interior-plate density: the cover should feel like a quiet emblem, not a diagram.

## Variant A: Trust Seal

```text
Create a premium minimalist textless front book cover base, portrait 2:3 composition, no readable text, no letters, no words, no numbers, no logo, no watermark.

Book: Agentified. Theme: superhuman acceleration built on trust.

Cover concept 1: The Trust Seal.

Visual direction: very restrained. Dark navy leather-textured field with antique brass edge tooling, like a serious strategy book. In the lower half, place one large elegant brass-and-enamel circular seal. The seal subtly contains three abstract movements: signal particles entering, alignment rails centering, momentum gears compounding. Around the seal, include only three small symbols: receipt, approval gate, rollback arc. No side panels. No busy machinery. No diagram labels. Keep the upper half mostly empty and calm.

Typography support: include a blank engraved dark enamel title cartouche in the upper third, integrated into the cover with brass trim, but no text. Include a smaller blank brass author cartouche near the bottom, no text.

Style: antique brass, dark navy, muted teal glow, ivory highlights, very small red risk accent. Sophisticated, quiet, iconic, dimensional, print-ready. Avoid: robot face, full dashboard, dense diagram, many icons, flowchart, flat UI, purple gradient, beige background, pseudo-text.
```

## Variant B: Receipt Gate

```text
Create a premium minimalist textless front book cover base, portrait 2:3 composition, no readable text, no letters, no words, no numbers, no logo, no watermark.

Book: Agentified. Theme: trust, receipts, authority, and governed agentic work.

Cover concept 2: The Receipt Gate.

Visual direction: very restrained. Dark navy leather-textured field with antique brass edge tooling. In the lower half, place one sealed ivory receipt envelope under a simple brass approval arch. A soft teal proof light rises from the envelope. Include only a few supporting symbols: a small source seal, a human approval lever, a tiny cost dial, and a rollback arc. Do not create side columns or a dashboard. Keep the upper half mostly open and calm.

Typography support: include a blank engraved dark enamel title cartouche in the upper third, integrated into the cover with brass trim, but no text. Include a smaller blank brass author cartouche near the bottom, no text.

Style: antique brass, dark navy, muted teal glow, ivory parchment, very small red risk accent. Sophisticated, quiet, iconic, dimensional, print-ready. Avoid: robot face, full machine corridor, dense diagram, many icons, flowchart, flat UI, purple gradient, beige background, pseudo-text.
```

## Variant C: Operating Key

```text
Create a premium minimalist textless front book cover base, portrait 2:3 composition, no readable text, no letters, no words, no numbers, no logo, no watermark.

Book: Agentified. Theme: agentic operating systems built on owned memory and governed proof.

Cover concept 3: The Operating Key.

Visual direction: very restrained. Dark navy leather-textured field with antique brass edge tooling. In the lower half, place one elegant brass key or vertical emblem that combines a small archive/vault shape, a memory node, a control seal, and a proof capsule. Use one clean teal routing line and one tiny red containment accent. Make it symbolic and quiet, not a full machine or diagram. Keep the upper half mostly open and calm.

Typography support: include a blank engraved dark enamel title cartouche in the upper third, integrated into the cover with brass trim, but no text. Include a smaller blank brass author cartouche near the bottom, no text.

Style: antique brass, dark navy, muted teal glow, ivory highlights, minimal red accent. Premium nonfiction book cover, clean, iconic, dimensional, print-ready, systems-minded. Avoid: robot face, full dashboard, dense operating stack, many icons, flowchart, flat UI, purple gradient, beige background, pseudo-text.
```

## Output contract

Save selected bases as:

```text
/Users/vambahsillah/Projects/Portfolio/agentified/source-assets/cover-bases/agentified-cover-a-sam-trust-engine-base.png
/Users/vambahsillah/Projects/Portfolio/agentified/source-assets/cover-bases/agentified-cover-b-receipt-gate-base.png
/Users/vambahsillah/Projects/Portfolio/agentified/source-assets/cover-bases/agentified-cover-c-portfolio-os-base.png
```

Then run:

```bash
cd /Users/vambahsillah/Projects/Portfolio/agentified
node scripts/composite-agentified-cover-variants.mjs
```
