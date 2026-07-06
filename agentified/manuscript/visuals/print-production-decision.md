# Agentified print figure decision

Status: open print-production gate

## Decision

Agentified needs two visual lanes.

The digital workbook can use web-friendly diagrams, interactive rendering, and lighter PNG assets. The physical book cannot depend on that. A reader holding the book needs fixed illustrations that print cleanly inside the interior file.

## Recommendation

Keep the review lanes, but separate concept scaffolds from final art.

- Digital and website workbook: use color PNG/SVG assets and, later, interactive web components where useful.
- Physical color interior: use fixed publication-plate exports once the figures are redesigned.
- Physical black-and-white interior: use dedicated monochrome proofs built from the final plates, with line weight, pattern, shape, and labels instead of color.

Do not treat grayscale conversion as the final black-and-white solution. A converted color figure may remain readable, but it can still rely on color distinctions the reader will not see. The monochrome lane should be designed for black-and-white from the start.

## Current asset lanes

- Editorial and web review PNG/SVG:
  - `/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/visuals/rendered/`
- Physical color print masters:
  - `/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/visuals/rendered/print/color-600dpi/`
- Physical grayscale conversion proofs:
  - `/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/visuals/rendered/print/grayscale-600dpi/`
  - `/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/visuals/rendered/print/grayscale-preview-png/`
- Physical monochrome print masters:
  - `/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/visuals/rendered/print/monochrome/`

## Print gate

Before final book production, decide:

1. Color interior or black-and-white interior.
2. Final trim size and live image width.
3. Whether figures should be full-page, half-page, or inline.
4. Whether a designer will redraw the figures in a page-layout tool.
5. Whether the digital workbook should use the same static art or rebuild the diagrams as interactive components.

## Current recommendation

Use the existing color print masters only for early author review and placement testing.

For the final physical book, move the key figures into the publication-plate lane described in:

- `/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/visuals/illustration-production-restart.md`
- `/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/visuals/briefs/figure-3-amina-inside-sam-publication-plate.md`

Keep the monochrome masters as a reminder of the black-and-white requirement, not as final art.

Review these 6x9 proof PDFs at actual size before deciding which lane becomes the final book interior:

- Color proof: `/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/visuals/rendered/print/proofs/agentified-print-figure-proof-6x9.pdf`
- Monochrome proof: `/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/visuals/rendered/print/monochrome/proofs/agentified-monochrome-figure-proof-6x9.pdf`
