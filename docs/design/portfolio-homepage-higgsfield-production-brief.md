# Portfolio Homepage Hero: Higgsfield Production Brief

## Objective

Create a cinematic homepage hero video/still system for AmaduTown that builds on the current Canva concept asset:

- Static reference: `/public/prototypes/portfolio-pipeline-hero/canva-hero-pipeline-candidate-02.png`
- Prototype route: `/prototypes/portfolio-pipeline-hero`
- Working idea: a client business appears as separated operating rooms, then a polished gold pipeline connects the rooms into one coordinated operating system.

The output should feel like a top-tier web design firm created a premium hero system, not an explainer video.

## Higgsfield Workflow Recommendation

Use image-to-video from the Canva reference image first. Higgsfield's own guide says image-to-video gives more control because the model inherits the composition, lighting, and subject identity from the reference image.

Recommended production path:

1. Upload the Canva hero image as the primary reference.
2. Use Cinema Studio if available for camera/lens control and consistent scene treatment.
3. Keep the first pass to one clean camera move.
4. Change one variable per retry: camera move, pipeline glow behavior, or room activation timing.
5. Keep the operating-floor schematic full-width behind the website copy. The copy will be native HTML over the image, not a blank reserved zone.

## Model Direction

Primary recommendation:

- **Veo 3.1 or Kling 3.0** for the hero loop because the target is cinematic realism, lighting, and controlled motion.

Alternate:

- **Seedance 2.0** if commercial prompt adherence and brand consistency beat cinematic movement in testing.

Avoid:

- Fast social-video presets.
- Character or talking-avatar modes.
- Anything that adds fake people, readable labels, logos, or UI text.

## Output Targets

- Desktop hero loop: 8-10 seconds, 16:9, no audio.
- Still poster frame: same composition, no visible motion blur.
- Mobile crop candidate: 9:16 or 4:5, with the gold pipeline and 2-3 room sections still readable.
- Optional production still: 2400px+ width for static fallback.

## Required Composition

Full frame:

- Exploded isometric business operating floor spans the full hero width.
- Rooms separated with visible gaps while still aligned to one invisible building grid.
- The scene should extend behind the eventual website text overlay. Do not reserve an empty left panel.
- The left/center-left area may be darker and lower contrast for legibility, but it should still contain the schematic environment, floor grid, room edges, pipework, or connected infrastructure.
- No objects should create a hard visual collision with the H1 placement.
- Distinct room functions suggested visually:
  - client intake / CRM
  - scheduling
  - communications
  - operations
  - billing
  - reporting
  - knowledge base / playbook library

Gold pipeline:

- Polished metallic pipe, not a neon line.
- Thick enough to be the hero object.
- Includes elbow joints, couplers, valves, branch lines, and reflected highlights.
- Clearly enters or touches every business room.
- Represents AmaduTown as the infrastructure moving data, decisions, handoffs, and follow-up.

## Motion Direction

The hero should feel like a system becoming operational.

Timeline:

- 0.0-1.5s: Hold on the separated business rooms. Gold pipe is present but dim.
- 1.5-4.5s: A warm gold pulse travels through the main pipe from lower foreground toward the upper room cluster.
- 4.5-7.0s: Branch pipes light up as the pulse reaches each room. Rooms gain subtle internal warmth.
- 7.0-10.0s: System settles into a quiet coordinated glow. Camera holds steady enough for homepage text to stay readable.

Camera:

- Slow dolly-in with slight parallax, or subtle orbit around the operating floor.
- Keep text-overlay legibility stable while the schematic remains visible across the full frame.
- No dramatic spin, crash zoom, handheld shake, or rapid travel.

Lighting:

- Dark navy architectural floor.
- Warm gold reflections on the pipeline.
- Subtle blue-gray room light.
- No rainbow color bursts. The gold activation is the signature moment.

## Primary Higgsfield Prompt

Use the uploaded reference image as the composition and style anchor.

```
Create an 8-10 second cinematic website hero loop from the reference image.

The scene is a premium isometric exploded business operating floor on a dark navy architectural background. The operating-floor schematic must span the full width of the hero behind the eventual website text overlay. Do not create a blank left-side panel. The left and center-left area can be darker and quieter for readability, but it should still show the schematic environment, floor grid, room edges, pipework, or connected infrastructure. Separated business rooms align to one invisible building grid. The rooms imply client intake, scheduling, communications, operations, billing, reporting, and knowledge base without any readable labels or text.

A polished gold plumbing pipeline is the hero object. It has real thickness, elbow joints, couplers, valves, branch lines, and warm metallic reflections. The pipeline represents AmaduTown as the infrastructure connecting the business.

Motion: begin with the rooms separated and the pipeline dim. A warm gold pulse travels through the main pipe, then branches into each room. Each room softly activates as the pipeline reaches it. The system settles into a coordinated glow. Use a slow cinematic dolly-in with very subtle parallax. Keep the schematic visible across the full frame, with enough darker contrast where native website copy will sit. Do not generate any text.

Style: luxury SaaS strategy firm, premium editorial 3D/isometric render, dark navy and charcoal, glass architecture, refined materials, warm gold highlights, precise and spacious composition.

Avoid: words, labels, fake UI text, logos, watermarks, cartoon style, flat infographic style, random neon particles, clutter, people as the focal point, dramatic camera spin, fast zoom, shaky camera, rainbow color effects.
```

## Negative Prompt

```
readable text, labels, fake interface words, logos, watermarks, people as focal point, cartoon, flat vector, infographic, low-poly, blocky cubes, cluttered dashboard, random icons, rainbow glow, purple neon, camera shake, fast rotation, excessive particles, stock office photo, overexposed gold, unreadable miniature details
```

## Shot Variants To Generate

1. **Hero Loop A: Pipeline Activation**
   - Stable dolly-in.
   - Gold pulse travels through pipeline.
   - Schematic spans the full width behind native copy.

2. **Hero Loop B: Business Assembly**
   - Rooms start slightly more separated.
   - Pipeline visually pulls them into alignment.
   - Use only if it does not make the layout feel gimmicky.

3. **Hero Loop C: Quiet Premium**
   - Almost static.
   - Only pipe reflections and room glow animate.
   - Best fallback if motion harms text legibility.

## Acceptance Criteria

The output is usable only if:

- The schematic fills the full hero width and can sit behind native text.
- The overlay area has enough contrast for white/off-white text after a light code-side gradient.
- No generated text appears anywhere in the image.
- The gold pipe feels like real infrastructure, not a decorative line.
- The business rooms remain visibly separate and organized.
- Room activation is subtle and premium.
- The clip can loop without a noticeable jump.
- A still frame from the clip is stronger than the Canva concept image.

## Current References

- Higgsfield AI Video page: notes current multi-model workspace, reference image support, camera/motion controls, and Cinema Studio positioning.
- Higgsfield Cinema Studio page: notes reusable Elements, camera/lens controls, genre-based motion, and AI co-director workflow.
- Higgsfield 2026 beginner guide: recommends starting from a prompt or image, choosing one clear camera move, and changing one variable per retry.
