# Owning the Block correction brief

You are correcting an existing Claude-authored interactive dashboard, not redesigning it from scratch.

## Files

- `owning-the-block.original.html` is the immutable source reference.
- Edit only `owning-the-block.corrected.html`.
- Return a complete, self-contained HTML artifact.

## Objective

Preserve the dashboard's research, relationships, citations, visual direction, wording, interaction model, accessibility semantics, labels, node identities, connector meanings, and responsive behavior while making its visual metaphor feel like a layered Boston city block that works in genuine Light, Dark, and System modes.

## Required correction

1. Add a cohesive true Light mode for the complete authored dashboard, not merely the surrounding site shell. Light mode must cover the canvas, diagram plates, controls, text, labels, cards, selected states, focus states, connectors, narration, and explanatory sections. Preserve the current dark treatment as the Dark mode.
2. Respond to `document.documentElement.dataset.theme` values `light` and `dark`. System selection is resolved by the surrounding Portfolio shell and passed through as one of those values.
3. Rework the generic building silhouettes so the block reads as Boston through a restrained mix of rowhouse rooflines, older masonry towers, and modern blocks. Do not assign any labeled project to a real Boston landmark or add unsupported claims. Preserve each building's label, identity, ownership/status color, data relationship, connector endpoint, hit target, and interaction.
4. Extend the city-stack metaphor below the street with recognizable infrastructure:
   - a visible plumbing network with pipes, elbows or joints, and limited branching;
   - a visually distinct sewer main or conduit that cannot be mistaken for the research/data connectors;
   - visible manhole/access covers at the street plus vertical access shafts connecting to the underground utility layer.
5. Keep all city-context graphics non-interactive and behind every research node, connector, label, and focus target. Utility graphics must never terminate at data nodes or imply new data relationships.
6. Keep the composition restrained. The utilities and skyline should extend the metaphor without overwhelming the research diagram.

## Fidelity and safety constraints

- Do not change research meaning, text, citations, node data, relationship data, connector endpoints, ordering, interaction behavior, keyboard operation, or accessible names.
- Do not delete or simplify dashboard content to make the visual correction easier.
- Do not add new claims, fictional metrics, new entities, landmark associations, explanatory labels, or decorative people.
- Do not flatten the interactive dashboard into a raster image.
- Preserve the existing self-contained interaction model and source structure wherever practical.
- Ensure Light and Dark modes have readable WCAG-conscious contrast, visible keyboard focus, distinct selected states, and no connector bleed through labels.
- Avoid white flashes, mismatched dark islands in Light mode, pale-on-pale text, clipped labels, horizontal page overflow, or utility graphics that look like data connectors.
- At 390x844, preserve the existing intentional horizontally scrollable diagram behavior while keeping headings, controls, narration, and labels legible.

## Self-review before completion

Inspect the edited artifact at desktop and 390x844 in both Light and Dark. Exercise at least one original building interaction and one end-to-end build control in each theme. Confirm that:

- the Boston context is recognizable but not literal or misleading;
- plumbing, sewer, covers, and access shafts are visually obvious;
- the utility layer is clearly background context;
- all original labels, nodes, relationships, connectors, citations, controls, and interactions remain present;
- no labels overlap or clip;
- no data connector endpoints changed;
- the source remains a complete standalone HTML file.

Do not edit any other file. When finished, summarize the exact visual changes and fidelity checks, but treat `owning-the-block.corrected.html` as the authoritative deliverable.
