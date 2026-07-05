# Agentified illustration production restart

Status: restart decision

## Decision

The current generated diagrams are not the final art direction for the physical book.

They helped prove the concepts, but they do not meet the standard set by the original "Accelerated" SAM illustration. The final Agentified figures should be treated as publication plates: illustrated, art-directed, print-tested, and laid out with exact typography.

## Why the prior lane failed

The renderer and Paper attempts stayed too close to node diagrams.

The problems are structural:

- The figures explain through labels more than visual metaphor.
- The SAM center reads as a basic shape instead of a taught process.
- A.M.I.N.A. reads as an acronym row, not an operating system living inside SAM.
- Connectors look like diagram plumbing rather than designed movement.
- Export resolution improved sharpness, but it did not improve authorship.

## New production path

Use a hybrid illustration workflow.

1. Build or commission a textless illustrated base in a design-capable tool.
2. Add exact labels, captions, and figure copy in Figma, Canva, Illustrator, or another layout-grade surface.
3. Export fixed assets for the book: PNG/PDF/SVG where possible.
4. Test each figure at final trim size before it enters the manuscript.

AI image generation may be used for visual exploration or textless illustration bases. It should not be trusted to render final labels, acronyms, captions, or small diagram copy.

## Tool recommendation

Primary path:

- Figma or Canva for final composition, exact typography, and export.
- A generated or designer-built illustration base for the visual metaphor.
- Existing SVG/PNG renderer outputs only as source geometry and concept references.

Fallback path:

- A hired illustrator or Claude Design-style art pass creates the plate as a high-resolution image.
- Codex then handles source mapping, figure insertion, print proofing, and manuscript references.

Do not use Paper as the canonical illustration surface for this book. It can rough out ideas, but the current output is not strong enough for the print interior.

## Quality bar from "Accelerated"

The original SAM visual works because it is more than a process chart.

- It has a dark textured field.
- It uses framed panels with enough hierarchy to scan quickly.
- The gold type and linework feel intentional.
- Each act has iconography that teaches without requiring a long caption.
- The movement from raw noise to shared direction to compounding systems is visible before the reader studies the labels.

Agentified should inherit that level of care, but it should feel more governed, operational, and evidence-based.

## Figure production rules

- Use exact text overlays from the manuscript, not AI-generated text inside artwork.
- Keep A.M.I.N.A. consistent: Align, Map, Instrument, Negotiate, Audit.
- Use Amina as the named guide where the manuscript needs the assistant to feel consistent.
- Keep "Accelerated" in quotes when referring to the book.
- Preserve source paths for every reference image and final export.
- Keep private chats, raw manuscript source, secrets, and unapproved inferences out of visual docs.
- Include color and black-and-white review before final book production.

## Acceptance checklist

A figure is not ready for manuscript insertion until it passes these checks:

1. It still communicates at final print size.
2. It works as an image, not a table disguised as a diagram.
3. The reader can understand the main process before reading the caption.
4. Labels are exact, legible, and manually controlled.
5. The relationship to "Accelerated" is visible without copying the original art.
6. The figure can be exported as a fixed print asset.
7. The source map identifies the design file, reference image, and final export path.

## Current restart file

A clean Figma design file was created for the restart:

- `https://www.figma.com/design/dp2wGNg3Lwr06r7WGg9CSy`

The Figma MCP connector hit the Starter plan tool limit before the board could be populated. The file is still available as the clean destination for manual or future connector-based art direction.

