# Accelerated teaching-overlay standard

Contract: `accelerated-editorial-teaching-plate-v1`

Use the L04 editorial teaching plate as the workshop-wide text treatment for Accelerated L01-L16.

## Required treatment

- Show one short teaching point at a time.
- Give every discrete point its own thin gold border and gold accent rule.
- Use a temporary deep AmaduTown-blue field with warm cream Avenir Next Demi Bold text.
- Reveal, hold, replace, and clear the plate with the narration. Do not reserve a permanent text area.
- Keep each point to 64 characters or fewer, including spaces. Break a phrase across lines only when the meaning stays intact.
- Bind every plate to an exact canonical narration cue and record desktop and portrait placement separately.
- Keep captions optional. The plate and caption must remain readable together without covering faces, controls, or the instructional center of the illustration.
- Use one source illustration layer per frame on mobile. Do not repeat, mirror, blur, or stack the image to fill portrait space.

## Exclusions

- No bullets or bullet-like rows inside a plate.
- No unbordered text floating over a busy illustration.
- No full narration sentences copied onto the frame.
- No permanent side panel, lower-third band, or reserved caption gutter.
- No glossy cards, heavy shadows, thick presenter frames, or stacked rounded boxes.
- No point may remain on screen after its spoken beat unless a source-defined worksheet hold requires it.

## Review gate

Before a lesson reaches contextual Human QA:

1. Its overlay plan must name this contract.
2. `python3 scripts/qa/audit-accelerated-overlay-style.py --strict` must pass for every review-ready lesson.
3. Encoded desktop and 390x844 frames must be checked with captions off and on and native controls visible.
4. A whole-lesson contextual MP4 must show that the plates support the illustration instead of becoming the presentation.

The shared renderer lives in `scripts/qa/accelerated_overlay_style.py`. Lesson builders should call `render_teaching_plate` rather than recreating the plate style.
