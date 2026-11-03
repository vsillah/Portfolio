# Production architecture and source register

This is an outline checkpoint. Script writing, visual boards, capture, avatar generation, rendering, and release are later phases with separate review. The current package makes no provider calls and contains no new media.

## Production records for each lesson

Keep one lesson folder keyed by `L01`–`L16`. These are the required fields for the next production phases; a missing field blocks render readiness.

| Record | Required fields | Review gate |
| --- | --- | --- |
| Spoken script | lesson ID; exact EPUB chapter/section and claim IDs; learner promise; opening scene; spoken beats with estimated word count and time; exercise instruction; closing action; pronunciation notes; on-screen text; source and privacy flags | Editorial read aloud; book fidelity; a humanizer pass that removes formulaic signposting and unsupported certainty; target 115–145 spoken words/minute. |
| Visual/storyboard | beat ID and timestamp; frame sketch; source art path and rights/approval status; narration; captions; screen-demo state; crop/safe area; transition; alternate text or audio description; motion reduction | Every visual teaches a named book concept or uses an approved SAM asset. No decorative “AI brain” or generic funnel replaces source art. |
| Asset manifest | immutable source path/hash; capture date; public/synthetic/approved classification; permissions; redaction method; reviewer; output hash | A screenshot or clip cannot move into a lesson until its source and redaction are logged. |
| Lesson release packet | source/script/storyboard revisions; avatar source files; final video; SRT/VTT; transcript; stills; privacy review; duration/frame-rate checks; QA decision | Captain review of the final MP4 and captions, then client-facing Human QA with exact revision evidence. |

**HeyGen segment boundaries:** Reserve avatar for the opening human scene, a chapter pivot that needs direct address, the worksheet handoff, and the close. Keep diagrams, book examples, and demos in native graphics or screen capture so learners can read them. A segment has its own ID, approved script span, expected duration, pronunciation list, audio ownership, and in/out timestamps. The proposed first pass is 2–4 short avatar segments per lesson, roughly 20–60 seconds each; lesson length does not imply an uninterrupted talking head. No avatar, voice, or provider configuration is selected here.

**B-roll and screen demos:** Prefer the approved SAM infographic and three workshop plates, book cover, and synthetic decision-file examples. Public AmaduTown pages can support a limited “where this lives” cue after an exact route and revision are captured. Admin dashboards, n8n workflows, diagnostics, agent traces, and client material need a synthetic fixture or a reviewed crop/redaction plus approval for their use. Book-named ClientQ, SudoPoll, StratQuest, VisionScope, MarketCraft, and Persuasive GPT remain labeled book cases unless a separate verified live asset exists.

**Accessibility:** Captions must be manually checked against the final mix, name the speaker and meaningful non-speech audio, and preserve technical terms and tool-case names. Supply a searchable transcript and a text version of every decision-file worksheet. Narration must explain information conveyed by color or motion; graphics need readable contrast, safe margins, and enough hold time to read. Avoid rapid flashes, offer reduced-motion alternatives for instructional animation, and verify both 16:9 and narrow/mobile crops before sign-off.

**Native composite fallback:** The generated presenter MP4 is the visual source of truth. If a programmatic render makes it jitter, freeze, skip frames, or compete with narration, render the base composition with a reserved window, then composite the native MP4 at exact coordinates and timestamps with FFmpeg. Mix source audio only in that window and duck or remove competing narration. Save the command/script and source hashes; compare cropped source and final windows, frame rate, duration, frame counts, and audio sync. Review the actual final MP4. This follows the Portfolio native-avatar composite rule and is a future production requirement, not work performed in this phase.

## Signals / Alignment / Momentum map

The book's three printed parts are **Systems** (Chapters 1–4), **Align** (5–16), and **Momentum** (17–26). The SAM infographic names the workshop acts **Signals**, **Alignment**, and **Momentum**. Those act labels help navigation while chapter numbers, arguments, and source order stay visible.

| SAM act and source visual | Book concepts in sequence | Learner artifacts | Course position |
| --- | --- | --- | --- |
| Signals; full infographic Signals panel and approved Signals plate | Data safety; priority trap; case structuring; answer-driven discovery; small tests; dynamic personas; feedback to signal | Data boundary, priority decision, evidence-gap card, living persona, feedback ledger | L01–L05; crosses the book's Systems/Align part boundary after Ch4. |
| Alignment; infographic Alignment panel and approved Alignment plate | Roadmap tradeoffs; PRD comprehension; learning roadmap; push to pull; metrics; ten-part learning plan; decision theater and influence | Roadmap/PRD trace, learning roadmap, ten-part plan, decision theater map, pitch brief | L06–L10; book Ch8–16. |
| Momentum; infographic Momentum panel and approved Momentum plate | Changed operating rhythm; insight-to-system loop; jobs; synthetic signals and their limits; strategic shifts; concept testing; persuasion; scale governance; learning memory; next move | Loop map, jobs card, simulation caveat, alternatives/concept test, pitch cards, scale checklist, one-week commitment | L11–L16; book Ch17–26. |

The existing six-segment talk supplies pacing cues, not the chapter map. The older eight-module production packet supplies possible media treatments, not evidence that every described system or outcome is live.

## Source/provenance register

| ID | Source and location | Status/use | Boundary |
| --- | --- | --- | --- |
| B1 | Canonical EPUB: `/Users/vambahsillah/Projects/Portfolio/accelerated_ebook_leadmagnet.epub` | Primary authority for chapter order, titles, cases, and arguments. EPUB TOC and spine parsed with EbookLib; 206 bold-styled internal section labels indexed in `epub-section-index.md`. | Book cases are teaching examples, not automatically current product claims. |
| K1 | Existing course kit: `/Users/vambahsillah/Documents/Codex/2026-04-30/i-need-you-to-help-me/accelerated-course-kit/` (`facilitator-guide/run-of-show.md`, `deck/slide-outline.md`, `excalidraw/diagram-briefs.md`, `source-register/sources.md`) | Interpretation: 60-minute six-segment talk, 24 slides, ten diagram briefs, and older source choices. | Use for facilitation and tactical graphics; verify claims against B1 or separate proof. |
| K2 | `docs/accelerated-course-modules/` | Existing eight-module production drafts and asset conventions. | Some chapter groupings and “new moat” material extend beyond the book. Do not inherit unsupported claims or imply approval of provider calls. |
| A1 | `public/showcases/service-prototypes/accelerated-sam-infographic.png`; source copy `agentified/source-assets/accelerated/accelerated-sam-infographic.png` | Existing Accelerated SAM visual. The panels name Signals, Alignment, Momentum and book-named cases. | Use existing art as a visual source; check text legibility and exact version in the storyboard. |
| A2 | `public/showcases/service-prototypes/v2/sam-signals-plate.webp`, `sam-alignment-plate.webp`, `sam-momentum-plate.webp` | Merged Portfolio workshop plates. Visually inspected for the funnel, outcome stack, and learning loop. | Decorative plates need adjacent text labels and narration; they are not evidence of product outcomes. |
| A3 | `public/accelerated_cover_ebook.webp`; `app/service-prototypes/[slug]/page.tsx`; `docs/qa/service-prototypes/README.md` | Public/repository proof of cover and preview surface, not proof of a finished course. | Capture exact rendered route and revision before using in video. |
| D1 | AmaduTown Drive original: `/Users/vambahsillah/Library/CloudStorage/GoogleDrive-vsillah@gmail.com/My Drive/2. AmaduTown Advisory Solutions/Artifacts /Promotional /Accelerated Building Smarter Products with AI/Final/Accelerated_infographic.png`, plus book and promotional deck in that folder | Company-material search found the infographic, EPUB copy, and deck. The original, A1, and the Agentified source copy have the same SHA-256: `13ef37fb39a228c79253538174cd9b3d77f6c7e630e9929dfa99e6cfa97f45c6`. | Preserve this original path; no Drive export or upload in this phase. |
| P1 | `docs/value-evidence-pipeline-setup.md`, `docs/portfolio-modules-inventory.md`, `scripts/capture-storyboard-assets.ts` | Repository implementation/capture references for possible sanitized demonstrations. | Source code alone does not prove a live workflow, customer value, or release status. |
| V1 | Personality corpus under `/Users/vambahsillah/Documents/Codex/2026-04-30/i-have-quite-a-bit-of/personality-corpus/` and humanizer at `/Users/vambahsillah/.hermes/hermes-agent/skills/creative/humanizer/SKILL.md` | Voice and editorial constraints only. | Private-derived material is never quoted in course copy or put into public proof. |
| X1 | Public industry links listed in K1 and the existing `source-register.md` | Optional later script research. None is needed for the current chapter-faithful outline. | Recheck current primary sources before any date-sensitive industry statement. |
| U1 | Claims that named book tools are shipped/live; internal admin outcomes; customer results; performance metrics; provider/avatar rights | Unsupported by this package. | Block on a verified, approved source and capture packet. Use synthetic examples until then. |

## Editorial decision log

1. **Chapter coverage versus the 60-minute talk:** The six-segment/24-slide kit is an introductory live talk. A 161-minute, 16-lesson course preserves the 26-chapter argument and leaves practice outside recorded runtime.
2. **Eight prior module packets:** Preserve them as draft media ideas. Their Chapters 17–25 compression is expanded into L11–L15; the industry “new moat,” local models, and agent-across-systems claims are optional later material, not a replacement for the book's named cases.
3. **SAM overlay versus book parts:** The infographic's Signals/Alignment/Momentum labels are useful course navigation. Keep “Systems/Align/Momentum” as the literal EPUB part labels and show the cross-boundary placement of Chapters 5–7.
4. **Book cases versus Portfolio demos:** The book's named tools teach a method. The current source set does not establish that those exact products are live or that their example outcomes occurred in Portfolio. Use synthetic worksheets until proof is verified.
5. **Safety before practice:** The data-safety note is part of L01 and governs every later exercise. No exercise requires private company or customer input.
6. **Visual continuity:** Reuse the SAM infographic and three merged plates as chapter openers, adding accessible labels and book-specific tactical overlays. Do not generate a competing master framework.

## Next checkpoints

1. Script L01–L04 from the exact EPUB sections, with a word-count and voice review; then repeat by module.
2. Storyboard each approved script using A1/A2, synthetic worksheets, and a shot-level source manifest.
3. After capture/privacy review, approve avatar script segments and provider settings separately; only then produce media and inspect the final native composite.
