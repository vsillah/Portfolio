# Prompt: SAM with the trust layer textless illustration base

Use this prompt to create the textless art base for Figure 0.1, SAM with the trust layer.

The base image should not include final labels. Exact text belongs in the overlay/composition step.

## Prompt

```text
Create a high-polish editorial business-book illustration plate, landscape 16:10 composition, no readable text anywhere, no letters, no words, no numbers.

Visual concept: an advanced product learning system built from three large connected panels, inspired by premium nonfiction strategy infographics and vintage engraved product diagrams. Dark textured navy background with subtle paper grain, warm metallic gold linework, ivory parchment surfaces, muted teal proof accents, restrained red only as tiny risk accents.

Left panel suggests raw signals being filtered into clarity: funnel, scattered inputs, source streams, small abstract documents and signal dots.

Center panel suggests alignment: compass, shared roadmap layers, authority badge, decision path, converging arrows.

Right panel suggests momentum: circular compounding engine, flywheel, eval loop, proof seal, learning system.

Across the top or middle of all three panels, add a visible trust rail as five blank linked medallions or plates integrated into the machinery, representing source, receipt, gate, eval, proof, but with absolutely no text.

Style should match a finished premium business book plate: dimensional gold, engraved detail, coherent hierarchy, elegant mechanical/process metaphor, print-ready. Leave clean blank label areas for exact typography overlays.

No cartoon look, no flat UI, no flowchart boxes, no Mermaid diagram look, no Paper or Figma node look. Absolutely no text or pseudo-text in the image.
```

## Output contract

Save the selected base image as:

```text
/Users/vambahsillah/Projects/Portfolio/agentified/source-assets/illustration-bases/figure-0-1-sam-trust-layer-base.png
```

Then run:

```bash
cd /Users/vambahsillah/Projects/Portfolio/agentified
node scripts/composite-sam-trust-layer-publication-plate.mjs
```

