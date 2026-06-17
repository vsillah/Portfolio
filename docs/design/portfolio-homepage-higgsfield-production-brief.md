# Portfolio Homepage Hero: Higgsfield Production Brief

## Objective

Create a cinematic homepage hero video/still system for AmaduTown that builds on the current storefront pipeline concept assets:

- Desktop still reference: `/public/prototypes/portfolio-pipeline-hero/amadutown-storefront-pipeline-hero-approved-20260617.png`
- Mobile still reference: `/public/prototypes/portfolio-pipeline-hero/amadutown-storefront-pipeline-hero-mobile-approved-20260617.png`
- Earlier Canva reference: `/public/prototypes/portfolio-pipeline-hero/canva-hero-pipeline-candidate-02.png`
- Prototype route: `/prototypes/portfolio-pipeline-hero`
- Working idea: a small local business storefront opens into many separated operating rooms, then a polished gold pipeline connects the rooms into one coordinated operating system.

The output should feel like a top-tier web design firm created a premium hero system, not an explainer video.

## Approved Direction

The approved visual direction is the storefront pipeline asset pair. The final production pass should improve resolution, polish, and motion while preserving the core composition: a recognizable neighborhood storefront, many separated business departments, and a physical gold pipeline connecting the business into one operating system.

The signature wow moment should be a controlled 3D scroll/video energy event: a glowing gold-white orb forms in the main pipeline, blooms outward like a refined energy explosion, then travels through the pipe network and illuminates every connector, valve, elbow joint, and room entry point. The effect should feel premium, physical, and infrastructural, not like generic sci-fi particles.

## Higgsfield Workflow Recommendation

Use image-to-video from the storefront pipeline reference image first. Higgsfield's own guide says image-to-video gives more control because the model inherits the composition, lighting, and subject identity from the reference image.

Recommended production path:

1. Upload the desktop storefront pipeline image as the primary reference.
2. Upload the portrait mobile image as the mobile composition reference.
3. Use Cinema Studio if available for camera/lens control and consistent scene treatment.
4. Keep the first pass to one clean scroll-driven 3D camera move.
5. Change one variable per retry: camera move, department count/spacing, orb bloom intensity, pipeline connector illumination, or room activation timing.
6. Keep the operating-floor schematic full-width behind the website copy. The copy will be native HTML over the image, not a blank reserved zone.

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

- Desktop hero loop: 8-10 seconds, 16:9, no audio, production target 3840 x 2160 or higher.
- Desktop still poster frame: same composition, no visible motion blur, production target 3840px+ width.
- Mobile hero loop/still: 9:16, production target 2160 x 3840 or higher.
- Mobile still must be a dedicated portrait composition, not a hard crop from the desktop image.
- Static fallback exports: WebP/AVIF plus source PNG/TIFF masters.
- Optional scroll-driven cut: 12-16 seconds with the same camera path slowed for on-page scroll scrubbing.

## Required Composition

Full frame:

- The first/foreground portion of the scene should include a transparent local storefront facade with a signature striped awning, glass display windows, and a street-facing threshold.
- The storefront should feel integrated into the exploded operating floor, as if the viewer can see through the front of a neighborhood business into the rooms behind it.
- The storefront cue should make the business feel local and approachable, not like a corporate office tower.
- Exploded isometric business operating floor is centered and spans the full hero width.
- Show enough separated departments to articulate dysfunction: ideally 7 distinct business functions, not only 3-4 rooms.
- Rooms separated with visible gaps while still aligned to one invisible building grid.
- The scene should extend behind the eventual website text overlay. Do not reserve an empty left panel.
- The left/center-left area may be darker and lower contrast for legibility, but it should still contain the schematic environment, floor grid, room edges, pipework, or connected infrastructure.
- No single room or pipe segment should dominate so much that the business looks like only a few departments.
- No object should create a hard visual collision with the H1 placement.
- The awning should be recognizable as a small-business storefront detail, but it should not contain readable text or a logo.
- Mobile composition should preserve dark negative space in the upper portion for native website copy, with the storefront and connected rooms visible in the lower portion without zooming into a low-resolution desktop crop.
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
- Connector points should visibly catch and amplify the orb's glow as the energy passes through them.
- The glow should move inside and along the pipe, with reflections on metal and glass, not as a flat overlay line.

## Motion Direction

The hero should feel like a system becoming operational.

Timeline:

- 0.0-1.5s: Hold on many separated business rooms. Gold pipe is present but dim. Camera begins a slow 3D scroll/dolly through the operating floor.
- 1.5-3.0s: A concentrated gold-white energy orb forms inside the main pipeline near the storefront threshold.
- 3.0-4.5s: The orb blooms outward in a controlled, elegant energy explosion, briefly illuminating the storefront glass and nearby pipe connectors.
- 4.5-7.5s: The orb travels through the main pipe. Every connector, elbow joint, valve, and branch point lights up as it passes.
- 7.5-10.0s: Branch pipes carry the glow into each department. Rooms gain subtle internal warmth and the system settles into a coordinated operating glow.

Camera:

- Slow scroll-driven 3D dolly-in with slight parallax, or a subtle orbit around the operating floor.
- Keep text-overlay legibility stable while the schematic remains visible across the full frame.
- No dramatic spin, crash zoom, handheld shake, or rapid travel.

Lighting:

- Dark navy architectural floor.
- Warm gold reflections on the pipeline.
- Subtle blue-gray room light.
- The energy orb should cast believable gold-white light on pipe connectors, storefront glass, room edges, and polished floor reflections.
- No rainbow color bursts. The gold orb and connector illumination are the signature moments.

## Primary Higgsfield Prompt

Use the uploaded reference image as the composition and style anchor.

```
Create an 8-10 second cinematic website hero loop from the reference image.

The scene is a premium isometric exploded small local business operating floor on a dark navy architectural background. The first/foreground portion includes a transparent storefront facade with a recognizable striped awning, glass display windows, and a street-facing threshold, like the viewer can see through a neighborhood shop into the operating rooms behind it. The operating-floor schematic must be centered and span the full width of the hero behind the eventual website text overlay. Do not create a blank left-side panel. Show enough separated departments to communicate operational dysfunction: client intake, scheduling, communications, operations, billing, reporting, and knowledge base should read as distinct spaces, not just 3-4 rooms. The left and center-left area can be darker and quieter for readability, but it should still show the storefront transparency, schematic environment, floor grid, room edges, pipework, or connected infrastructure. Separated business rooms align to one invisible building grid. The rooms imply each function without any readable labels or text.

A polished gold plumbing pipeline is the hero object. It has real thickness, elbow joints, couplers, valves, branch lines, and warm metallic reflections. The pipeline represents AmaduTown as the infrastructure connecting the business. The connector points are important: every elbow joint, valve, coupler, and room entry point should be visually able to catch light from the activation.

Motion: create a scroll-driven 3D cinematic video. Begin with many rooms separated and the pipeline dim. A concentrated glowing gold-white energy orb forms inside the main pipeline near the storefront threshold. The orb blooms outward in a controlled, elegant energy explosion, briefly illuminating the storefront glass, pipe metal, and nearby connectors. Then the orb travels through the main pipe and branches into the rooms. As it passes, each connector, elbow joint, valve, coupler, and room entry point lights up with a premium gold glow. Each room softly activates as the pipeline reaches it. The system settles into a coordinated operating glow. Use a slow cinematic dolly-in with very subtle parallax, suitable for a scroll-scrubbed website hero. Keep the centered schematic visible across the full frame, with enough darker contrast where native website copy will sit. Do not generate any text.

Style: luxury SaaS strategy firm, premium editorial 3D/isometric render, dark navy and charcoal, glass architecture, refined materials, warm gold highlights, precise and spacious composition.

Avoid: words, labels, fake UI text, logos, watermarks, corporate office tower, mall storefront, cartoon style, flat infographic style, random neon particles, clutter, people as the focal point, dramatic camera spin, fast zoom, shaky camera, rainbow color effects, destructive explosion, fire, smoke, debris, broken pipes, sparks that feel dangerous, sci-fi portal effect.
```

## Negative Prompt

```
readable text, labels, fake interface words, logos, watermarks, corporate tower, shopping mall, people as focal point, cartoon, flat vector, infographic, low-poly, blocky cubes, cluttered dashboard, random icons, rainbow glow, purple neon, camera shake, fast rotation, excessive particles, stock office photo, overexposed gold, unreadable miniature details, destructive blast, fire, smoke, debris, broken glass, broken pipes, dangerous sparks, sci-fi portal
```

## Shot Variants To Generate

1. **Hero Loop A: Pipeline Activation**
   - Stable dolly-in.
   - Gold-white orb forms, blooms, and travels through pipeline.
   - Pipe connectors illuminate as the orb reaches them.
   - Schematic spans the full width behind native copy.
   - At least 7 distinct business departments remain visible.

2. **Hero Loop B: Business Assembly**
   - Rooms start slightly more separated.
   - The orb bloom activates the pipeline, and the pipeline visually pulls rooms into alignment.
   - Use only if it does not make the layout feel gimmicky.

3. **Hero Loop C: Quiet Premium**
   - Almost static.
   - Only the orb, pipe reflections, connector glow, and room warmth animate.
   - Best fallback if motion harms text legibility.

## Acceptance Criteria

The output is usable only if:

- The schematic fills the full hero width and can sit behind native text.
- A transparent small-business storefront with a striped awning is visible at the beginning/foreground of the room sequence.
- At least 7 distinct operating departments are visible enough to communicate fragmentation.
- The overlay area has enough contrast for white/off-white text after a light code-side gradient.
- No generated text appears anywhere in the image.
- The gold pipe feels like real infrastructure, not a decorative line.
- The glowing orb reads as controlled operational energy, not fire or destruction.
- Pipeline connectors, elbow joints, valves, and room entry points visibly illuminate as the orb passes.
- The business rooms remain visibly separate and organized.
- Room activation is subtle and premium.
- The clip can loop without a noticeable jump.
- A still frame from the clip is stronger than the Canva concept image.

## Current References

- Higgsfield AI Video page: notes current multi-model workspace, reference image support, camera/motion controls, and Cinema Studio positioning.
- Higgsfield Cinema Studio page: notes reusable Elements, camera/lens controls, genre-based motion, and AI co-director workflow.
- Higgsfield 2026 beginner guide: recommends starting from a prompt or image, choosing one clear camera move, and changing one variable per retry.
