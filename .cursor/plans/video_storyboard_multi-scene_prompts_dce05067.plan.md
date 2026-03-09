---
name: Video storyboard multi-scene prompts
overview: Create a storyboard document that breaks the AmaduTown “portfolio → product” narrative into 5–6 discrete scenes, each with finetuned start image prompt, end image prompt, and video (motion) prompt for ElevenLabs/Luma-style tools, using consistent AmaduTown design language throughout.
todos: []
isProject: false
---

# Multi-scene video storyboard for AmaduTown

## Goal

Replace the single long video with a **stitched storyboard**: multiple short clips, each with its own start frame, end frame, and motion prompt that align to a clear script. You will get one document to use with ElevenLabs (or Luma, Runway, etc.) to generate each clip, then stitch them in an editor.

## Script (narrative beats)


| Scene | Script line / beat                                                                        |
| ----- | ----------------------------------------------------------------------------------------- |
| 1     | AmaduTown is one place — portfolio, store, and product in one.                            |
| 2     | Inside that place: services, tools, and automation live together.                         |
| 3     | The building blocks are real modules: chatbot, lead gen, eval, diagnostic, n8n workflows. |
| 4     | Those modules can detach — each one standalone, ready to run on its own.                  |
| 5     | They’re available for others: whitelabel, download, spin off into your stack.             |
| 6     | Build with what’s proven. Explore AmaduTown. (CTA)                                        |


## Design language (every prompt)

Use the same visual rules in **all** start/end image prompts so the storyboard feels like one brand:

- **Colors:** Imperial Navy `#121E31` (background), Radiant Gold `#D4AF37` (accents, borders), Silicon Slate `#2C3E50` (panels), Platinum White `#EAECEE` (text), Gold Light `#F5D060` (highlights), Bronze `#8B6914` (secondary).
- **Typography:** Orbitron for headings, Cormorant for premium/display, Inter for body.
- **Effects:** Soft gold glow (`0 0 20px rgba(212,175,55,0.3)`), thin gold borders, subtle backdrop blur, rounded panels (e.g. rounded-2xl).
- **Style:** Clean, premium, diagrammatic (not literal UI). Abstract “hub” and “cards” are fine; avoid photorealistic people unless needed for CTA.

Reference: [tailwind.config.ts](tailwind.config.ts) (colors, fontFamily, boxShadow); [docs/portfolio-modules-inventory.md](docs/portfolio-modules-inventory.md) (module names).

## Deliverable: one storyboard file

Create a single markdown file (e.g. `**docs/about-page-video-storyboard.md`**) containing:

1. **Header** — Short intro: purpose (about-page video, multi-clip storyboard), tool note (ElevenLabs/Luma: start image → end image + video prompt per clip), design tokens reference.
2. **Table** — Scene number, script line, duration suggestion (e.g. 3–5 s per clip).
3. **Per-scene blocks** (for each of the 6 scenes):
  - **Script** (one line).
  - **Start image prompt** — Full paragraph; AmaduTown palette and typography; describes the exact still that begins the clip.
  - **End image prompt** — Full paragraph; same style; describes the still that ends the clip (so the motion goes start → end).
  - **Video prompt** — One or two sentences describing the motion/camera (e.g. “Camera slowly pushes in; hub gently pulses with gold glow”; “Cards drift outward from center, gold borders brighten”).
4. **Stitching note** — Short section: “Generate each clip with the tool, then stitch in order in [DaVinci Resolve / CapCut / Premiere] with 0.3–0.5 s crossfades; add optional title card or end card with AmaduTown logo and CTA.”

## Scene-by-scene prompt focus (summary)

- **Scene 1:** Start and end both show a single “AmaduTown” hub (navy, gold, one central node or logo). Video: subtle zoom or glow pulse.
- **Scene 2:** Start = same hub; end = hub with 3–4 visible “sections” (services, store, tools, automation). Video: hub “opens” or sections fade in.
- **Scene 3:** Start = hub with sections; end = same layout but with 5 distinct “module” cards (Chatbot, Lead Gen, Eval, Diagnostic, n8n) labeled. Video: cards highlight or appear one by one.
- **Scene 4:** Start = modules inside hub; end = modules floating slightly outside the hub, still connected by thin gold lines or clearly “detached”. Video: modules drift out from center.
- **Scene 5:** Start = detached modules; end = same modules with small “Available for you” / “Whitelabel” / “Download” tags or a single tagline. Video: tags fade in or a light “available” glow.
- **Scene 6:** Start = modules + CTA tagline; end = AmaduTown logo or “Build with us” / “Explore” CTA card. Video: gentle zoom to CTA or cut to logo.

## What you will not do (plan only)

- No implementation of video generation or stitching in the repo.
- No changes to `tailwind.config.ts` or app code.
- No new assets (images/videos) — only the storyboard markdown file and prompts.

## File to add


| Path                                  | Content                                                                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `docs/about-page-video-storyboard.md` | Full storyboard: intro, script table, 6 scenes with Start image prompt, End image prompt, Video prompt each, plus stitching note. |


All prompts will be written in full in that file so you can copy-paste into ElevenLabs (or similar) per scene.