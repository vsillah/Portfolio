# Prompt: The first receipt textless illustration base

Use this prompt to create the textless art base for Figure 1.1, The first receipt.

The base image should not include final labels. Exact text belongs in the overlay/composition step.

## Prompt

```text
Create a high-polish editorial business-book illustration plate, landscape 16:10 composition, no readable text anywhere, no letters, no words, no numbers.

Visual concept: the first receipt in a governed agentic workflow. A sophisticated mechanical/process scene where an agent action on the left produces a visible evidence envelope in the center, then passes through a human approval gate, then becomes an outcome on the right.

Dark textured navy background with subtle paper grain, warm metallic gold linework, ivory parchment surfaces, muted teal proof accents, small restrained red risk accents only if useful.

Left zone: abstract agent run machine, drafting/recommendation apparatus, small blank artifact sheets moving out.

Center zone: large ornate receipt envelope or evidence capsule with nine blank compartments inside, suggesting intent, agent, source, action, artifact, approval, cost, outcome, rollback, but no text.

Right zone: human gate with approve/hold/reject mechanism, then a rollback/ship/revise outcome dial.

Use icon-led teaching: receipt seal, trace line, source funnel, artifact card, approval lever, cost coin, rollback arrow, outcome stamp.

Style should match a finished premium nonfiction strategy book plate: dimensional brass/gold, engraved detail, coherent hierarchy, elegant mechanical/process metaphor, print-ready. Leave clean blank label areas for exact typography overlays.

No cartoon look, no flat UI, no flowchart boxes, no Mermaid diagram look, no Paper or Figma node look. Absolutely no text or pseudo-text in the image.
```

## Output contract

Save the selected base image as:

```text
/Users/vambahsillah/Projects/Portfolio/agentified/source-assets/illustration-bases/figure-1-1-first-receipt-base.png
```

Then run:

```bash
cd /Users/vambahsillah/Projects/Portfolio/agentified
node scripts/composite-first-receipt-publication-plate.mjs
```

