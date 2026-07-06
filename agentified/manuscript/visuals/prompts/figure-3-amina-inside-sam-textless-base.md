# Prompt: A.M.I.N.A. inside SAM textless illustration base

Use this prompt to create the textless art base for the flagship A.M.I.N.A. inside SAM publication plate.

The base image should not include final labels. Exact text belongs in the overlay/composition step.

## Prompt

```text
Create a high-polish editorial book illustration plate, portrait 4:5 composition, no readable text anywhere, no letters, no words, no numbers. Visual concept: a sophisticated trust engine inside a product-learning loop, inspired by vintage product strategy infographics and premium nonfiction book illustrations. Dark textured navy background with subtle paper grain, warm metallic gold linework, ivory panels, muted teal proof accents.

Center: a large circular SAM-like engine divided into three distinct zones suggesting signals, alignment, and momentum without labels. Inside the lower half of the circle, five interlocking governance mechanisms arranged as a curved internal mechanism, not floating pills: an intent boundary, authority map, receipt instrument, human approval gate, and audit/evaluation loop.

Beneath the engine: three blank receipt cards connected by elegant curved gold paths, representing ask, act, attest, with no text.

Use icon-led teaching: source funnel, compass or authority badge, receipt card, gate or checkpoint, evaluation loop, proof seal.

Style should match the quality of a finished business book plate: dimensional gold accents, coherent hierarchy, engraved details, rich but readable, print-ready, no cartoon look, no flat UI, no flowchart boxes, no Mermaid diagram look, no Paper or Figma node look.

Leave clean blank label areas where exact typography can be overlaid later.

Absolutely no text or pseudo-text in the image.
```

## Negative prompt

```text
No text, no letters, no numbers, no pseudo-text, no watermarks, no fake captions, no UI screenshot, no flowchart, no simple circles with labels, no flat node diagram, no generic corporate illustration.
```

## Output contract

Save the selected base image as:

```text
/Users/vambahsillah/Projects/Portfolio/agentified/source-assets/illustration-bases/figure-3-amina-inside-sam-base.png
```

Then run:

```bash
cd /Users/vambahsillah/Projects/Portfolio/agentified
node scripts/composite-amina-sam-publication-plate.mjs
```
