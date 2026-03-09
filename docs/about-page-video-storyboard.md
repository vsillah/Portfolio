# About-page video storyboard — AmaduTown (multi-scene)

This document is a **multi-clip storyboard** for the AmaduTown about-page video. Each scene has a **start image prompt**, **end image prompt**, and **video (motion) prompt** so you can generate short clips with tools like ElevenLabs or Luma (start frame → end frame + motion), then stitch them into one narrative.

**Design tokens:** All image prompts use the AmaduTown palette and typography — Imperial Navy `#121E31`, Radiant Gold `#D4AF37`, Silicon Slate `#2C3E50`, Platinum White `#EAECEE`, Gold Light `#F5D060`, Bronze `#8B6914`; Orbitron (headings), Cormorant (premium), Inter (body); soft gold glow, thin gold borders, backdrop blur, rounded panels. See `tailwind.config.ts` and `docs/portfolio-modules-inventory.md` for reference.

---

## Website screenshots and video clips

Use real site captures as **B-roll**, as **reference for AI image prompts** (so generated frames feel consistent with the product), or as **picture-in-picture / cutaways** when stitching. Capture at a consistent resolution (e.g. 1920×1080) and, for video, 3–10 s of stable footage per clip.

**Suggested location:** `design-files/about-page-video/` (screenshots as PNG, clips as WebM). Do not import from this folder in production code — use only for the edit and for prompt reference.

**Capture with Playwright:** From the repo root, with the dev server running (`npm run dev`), run:
- `npm run storyboard:assets:schematics` — generates the schematic SVGs into `design-files/about-page-video/`.
- `npm run storyboard:assets:capture` — captures screenshots (PNG) for each route listed below. Add `--videos` to also record a short WebM clip per route: `npx tsx scripts/capture-storyboard-assets.ts --videos`.
- `npm run storyboard:assets` — runs schematics then capture.

| Purpose | Route or action | What to capture |
| ------- | ----------------- | ---------------- |
| One place / hero | `/` (home) | Hero section or full above-the-fold; nav showing Store, Services, etc. |
| Store | `/store` | Store grid or product cards. |
| Services | `/services` | Services list or a single service card. |
| Tools | `/tools/audit` or `/resources` | Audit tool landing or resources grid (lead magnets, tools). |
| Automation / admin | `/admin` (logged in) | Dashboard cards (Pipeline, Sales, Chat Eval, Module Sync). |
| Modules | `/admin/module-sync` | Module Sync table: modules, spun-off repo URLs, diff/push. |
| Eval | `/admin/chat-eval` | Chat Eval hub or queue/annotation view. |
| CTA / about | `/#about` or `/#contact` | About or contact block; or footer with CTA. |

**Video clips (optional):** Short screen recordings of scrolling the homepage, opening the store, or opening Module Sync and expanding a row. Keep motion smooth and slow (3–5 s) so they can be used as B-roll under the script.

---

## Schematics

Create **diagrammatic assets** that match the storyboard (hub, sections, modules, detach, CTA). Use them as **reference for start/end image prompts**, or **export as images/SVG and overlay them** in the edit (e.g. after an AI-generated clip, cut to the schematic for a beat). Same palette: Imperial Navy background, Radiant Gold borders, Silicon Slate panels, Platinum White / Gold Light labels.

**Suggested location:** `design-files/about-page-video/` (e.g. `schematic-hub.svg`, `schematic-modules.svg`, `schematic-detach.svg`, `schematic-cta.svg`). Generate all seven SVGs with: `npm run storyboard:assets:schematics`. Or create by hand in Figma/Excalidraw.

| Schematic | Content | Use in storyboard |
| --------- | ------- | ------------------ |
| **Hub (one place)** | Single central node, navy + gold border, soft glow. Optional "AmaduTown" wordmark. | Scene 1 reference or overlay. |
| **Hub with sections** | Same hub divided into 3–4 zones: Services, Store, Tools, Automation. | Scene 2 reference or overlay. |
| **Hub + modules** | Hub with 5 labeled cards: Chatbot, Lead Gen, Eval, Diagnostic, n8n. | Scene 3 reference or overlay. |
| **Modules detached** | Five cards slightly outside the hub, thin gold connection lines. | Scene 4 reference or overlay. |
| **Modules + availability** | Same as detached, plus small "Whitelabel · Download · Spin off" tagline or tags. | Scene 5 reference or overlay. |
| **CTA card** | Single card: "Build with us" / "Explore AmaduTown" in Orbitron/Cormorant; gold border. | Scene 6 reference or end card. |

**Spin-off flow (optional):** One diagram showing "Portfolio repo → Module Sync → Spin-off repo" with arrows and labels. Use as a single cutaway when the script says "spin off into your stack."

---

## Script and duration

| Scene | Script line / beat | Duration |
|-------|--------------------|----------|
| 1 | AmaduTown is one place — portfolio, store, and product in one. | 3–4 s |
| 2 | Inside that place: services, tools, and automation live together. | 4–5 s |
| 3 | The building blocks are real modules: chatbot, lead gen, eval, diagnostic, n8n workflows. | 4–5 s |
| 4 | Those modules can detach — each one standalone, ready to run on its own. | 4–5 s |
| 5 | They're available for others: whitelabel, download, spin off into your stack. | 4–5 s |
| 6 | Build with what's proven. Explore AmaduTown. (CTA) | 3–5 s |

---

## Scene 1 — One place

**Script:** AmaduTown is one place — portfolio, store, and product in one.

**Start image prompt:**  
A single central hub on a deep Imperial Navy (#121E31) background. The hub is a rounded-2xl panel in Silicon Slate (#2C3E50) with a thin Radiant Gold (#D4AF37) border and a soft gold glow (0 0 20px rgba(212,175,55,0.3)). The word "AmaduTown" appears in Orbitron, Platinum White (#EAECEE), with a subtle Cormorant tagline in Gold Light (#F5D060). No other elements; clean, premium, diagrammatic. Slight backdrop blur at the edges.

**End image prompt:**  
Same single hub as start: one central AmaduTown panel on Imperial Navy background, Silicon Slate panel, Radiant Gold border, soft gold glow, Orbitron "AmaduTown" in Platinum White, Cormorant accent in Gold Light. The glow is slightly brighter (gold-glow-lg). Composition unchanged so the clip can loop or hold; focus on a subtle increase in luminosity.

**Video prompt:**  
Camera holds or very slowly pushes in. The hub's gold border and glow gently pulse once (brighten then return). No fast motion; calm, premium feel.

---

## Scene 2 — Inside: services, tools, automation

**Script:** Inside that place: services, tools, and automation live together.

**Start image prompt:**  
The same single AmaduTown hub from Scene 1: one central rounded-2xl panel on Imperial Navy (#121E31), Silicon Slate (#2C3E50), Radiant Gold (#D4AF37) border and soft gold glow, "AmaduTown" in Orbitron, Platinum White (#EAECEE). No visible internal structure yet.

**End image prompt:**  
The hub is now "open" or expanded: the same central panel remains, but three or four distinct sections are visible inside or around it — e.g. "Services", "Store", "Tools", "Automation" — as smaller rounded panels or zones in Silicon Slate with thin gold borders and Platinum White labels (Orbitron or Inter). All on Imperial Navy; gold glow wraps the whole composition. Diagrammatic, not literal UI.

**Video prompt:**  
The hub stays in frame; from inside or around it, the four sections (services, store, tools, automation) fade in or gently unfold one after another. Gold borders appear as each section becomes visible. Camera is static or very slow push-in.

---

## Scene 3 — Building blocks: modules

**Script:** The building blocks are real modules: chatbot, lead gen, eval, diagnostic, n8n workflows.

**Start image prompt:**  
The opened hub from Scene 2: central AmaduTown with four visible sections (Services, Store, Tools, Automation) on Imperial Navy, Silicon Slate panels, Radiant Gold borders, Platinum White text, soft gold glow. Clean diagrammatic style.

**End image prompt:**  
Same layout, but the "building blocks" are now explicit: five distinct module cards are visible and labeled — "Chatbot", "Lead Gen", "Eval", "Diagnostic", "n8n" — in Silicon Slate rounded panels with Radiant Gold borders and Platinum White (Orbitron/Inter) labels. They sit inside or immediately around the hub. Imperial Navy background, gold glow, Bronze (#8B6914) or Gold Light (#F5D060) for small accents or icons. Premium, abstract.

**Video prompt:**  
The five module cards highlight or appear one by one (e.g. short fade-in or border brighten in sequence: Chatbot → Lead Gen → Eval → Diagnostic → n8n). Camera static. Gold borders briefly brighten on each card as it "activates."

---

## Scene 4 — Detach: standalone modules

**Script:** Those modules can detach — each one standalone, ready to run on its own.

**Start image prompt:**  
The hub with five labeled module cards (Chatbot, Lead Gen, Eval, Diagnostic, n8n) grouped inside or around one central area. Imperial Navy background, Silicon Slate cards, Radiant Gold borders, Platinum White labels, soft gold glow. Same style as end of Scene 3.

**End image prompt:**  
The five modules have moved outward: they float slightly away from the center, each still a rounded-2xl Silicon Slate card with Radiant Gold border and label. Thin gold lines or faint connection strokes can link them to the central hub (or the hub is smaller/background). Sense of "detached but traceable." Imperial Navy background, gold glow now around each card as well as the center. Diagrammatic, clean.

**Video prompt:**  
The five module cards drift outward from the center in a smooth, slow motion. Gold connection lines stretch or fade as the cards separate. Gold borders on the cards brighten slightly as they settle in their new positions. Camera static or very slow pull back to show the new arrangement.

---

## Scene 5 — Available for others

**Script:** They're available for others: whitelabel, download, spin off into your stack.

**Start image prompt:**  
The detached layout from Scene 4: five module cards (Chatbot, Lead Gen, Eval, Diagnostic, n8n) floating around a smaller central hub on Imperial Navy, Silicon Slate panels, Radiant Gold borders, Platinum White labels, soft gold glow. No extra labels yet.

**End image prompt:**  
Same arrangement of five detached modules, but each card now has a small tag or the composition has a single tagline: e.g. "Available for you", "Whitelabel", "Download", or "Spin off into your stack" in Cormorant or Inter, Gold Light or Platinum White, with a light "available" glow (gold-glow-sm) around the cards or a subtle badge. Imperial Navy background, Radiant Gold accents. Premium, inviting.

**Video prompt:**  
Tags or the tagline fade in gently over the detached modules. A soft "available" glow spreads slightly across the cards. No camera move; focus on the text/glow appearance.

---

## Scene 6 — CTA

**Script:** Build with what's proven. Explore AmaduTown. (CTA)

**Start image prompt:**  
The five modules with "Available for you" (or equivalent) tagline from Scene 5, on Imperial Navy, Silicon Slate cards, Radiant Gold borders, gold glow. Full diagrammatic layout visible.

**End image prompt:**  
Focus shifts to a single CTA card or the AmaduTown logo: either a central panel with "Build with what's proven" and "Explore AmaduTown" in Orbitron/Cormorant, Platinum White and Gold Light, on Silicon Slate with strong Radiant Gold border and gold-glow-lg, or the AmaduTown wordmark (Orbitron) with a Cormorant subtitle. Imperial Navy background. Rest of the modules can be softly out of focus or reduced in prominence.

**Video prompt:**  
Gentle zoom or focus pull toward the CTA card or AmaduTown logo. The rest of the composition softens or dims slightly so the call-to-action is the clear endpoint. Calm, confident motion.

---

## Stitching

Generate each clip with your tool (ElevenLabs, Luma, Runway, etc.) using the **start image** and **end image** prompts plus the **video prompt** for that scene. Export clips in order (Scene 1 through 6). Stitch them in sequence in an editor (e.g. DaVinci Resolve, CapCut, Premiere) with **0.3–0.5 s crossfades** between clips so the storyboard flows smoothly. Optionally add a title card at the start or an end card with the AmaduTown logo and CTA for social or about-page use. You can **intercut** the AI-generated scenes with **website screenshots/video clips** (B-roll) and **schematic diagrams** from the sections above — e.g. show the real Module Sync table when the script mentions "spin off," or overlay a schematic hub for a beat before transitioning to the next scene.
