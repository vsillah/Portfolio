# L14 — Show the board the controls

**Group:** The Agentified Organization
**Outcome:** Explain a held workflow through its queue, trace, and governed memory to a skeptical reviewer.
**Run time:** 10:00 (about 6:05 spoken, 3:55 guided work and pause).
**Operating File update:** `three-panel-demo` → `proof.board_demo`, revision 14, status `draft`; revision 13's research proposal remains `not_run`.
**Source bindings:** [Chapter 24, The Board Demo](../../manuscript/production-draft/chapters/ch24-the-board-demo.md); [companion workbook, Chapter 24 Three-Panel Demo](../../manuscript/workbook/agentified-operating-system-workbook.md). Both are registered in `source-register.json` and assigned to L14 by `curriculum-crosswalk.json`.

## Timed narration and screen

| Time | Spoken narration — read in full | On-screen copy |
| --- | --- | --- |
| 0:00–1:10 | “A Harbor board reviewer asks Morgan a fair question: what happens when the preparation agent produces a brief that looks ready, but the evidence is thin? Morgan brings three paper panels to the table. The first panel shows the queue, including held and rejected work. The second follows one item through its trace. The third shows the rule that governed it. This is a design walkthrough, not a live system demonstration. Morgan is showing what Harbor intends to inspect before it trusts the workflow.” | “Queue. Trace. Memory.” “Paper design review.” |
| 1:10–2:20 | “Start with the queue. One Session Option Brief is prepared, not proposed to the team. The staffing hold says staffing is unconfirmed. The print request says no spend is approved. The research proposal is not run because its baseline and reviewer protocol are missing. Place the rejections where the reviewer can see them too. A queue that only displays polished outputs hides the decisions that make the operation governable.” | “Prepared / Held / Rejected / Not run.” |
| 2:20–3:30 | “Open the trace for the held brief. It begins with cleared Harbor source references. It records the preparation agent's draft, the check that found the staffing gap, the hold, and Morgan as the decision owner. There is no send or booking event. The trace should let someone ask why the item stopped, without exposing raw source notes or pretending a paper receipt is a live audit log. The absence of an event is part of the answer.” | “Request → draft → check → hold → Morgan.” “No send event.” |
| 3:30–4:35 | “Now show memory. Harbor has a proposed local rule: a session cannot move from option to team proposal until a person confirms staffing. In this classroom design, that rule is a draft for Morgan's review. The agent cannot promote it itself, and a single held example cannot become general truth by repetition. Show the rule's owner, scope, source reference, status, and review date. If any are missing, say so.” | “Rule owner / scope / source / status / review.” |
| 4:35–5:45 | “The workbook asks what export a reviewer can take away. Morgan can offer the scoped proof outline from lesson twelve after a separate audience and privacy review. It would contain the boundary, receipt references, decisions, and limitations. It would omit raw notes and unrelated records. For class today, it stays `not shared`. A reviewer may ask whether the agent actually ran. Answer plainly: no. This exercise demonstrates controls on paper; it does not prove production reliability.” | “Proof outline: not shared.” “No production claim.” |
| 5:45–6:15 | “Pause. Which panel would expose the weakest part of your own proposed workflow first?” | “Pause: name the weakest panel.” |
| 6:15–9:35 | “Storyboard a Three-Panel Demo for your workflow. Give each panel a reviewer question and one piece of evidence. Include a blocked or rejected item beside the successful work. In the trace, name the missing event as clearly as the recorded ones. In memory, identify who may approve the rule. Write two likely skeptical questions and honest answers. Decide what a reviewer may receive, what stays withheld, and who reviews the export before sharing. Use a fictional or approved example. Do not use private operational data.” | Exercise card below; 3:20 quiet writing timer with optional pause. |
| 9:35–10:00 | “Save revision fourteen as a draft. The board can examine Harbor's proposed controls and its unresolved gaps. Morgan still owns the session decision. Nothing about a clean storyboard lifts the hold.” | “Operating File v14: Three-Panel Demo.” “Next: rehearse the day.” |

## Exercise and model Operating File entry

**Prompt:** Make a `Three-Panel Demo` storyboard with queue, trace, and memory. For each panel, write the question it answers, a synthetic evidence reference, what is blocked or rejected, and what remains unknown. Add two reviewer questions, the privacy exclusions, a possible proof export, its audience and review owner, and `not shared` until approved. Keep the original staffing and spend holds and the research `not_run` state visible.

**Harbor example — `SYN-DEMO-01`:** Audience: fictional board reviewer. Panel 1, queue: one prepared Session Option Brief held at `SYN-HOLD-01`; `SYN-SPEND-01` unapproved; `SYN-RESEARCH-01` not run; a sample rejected brief with an unsupported attendance claim. Panel 2, trace: invented source IDs → paper draft → source and staffing check → hold → Morgan review pending. No team proposal, booking, purchase, or send event. Panel 3, memory: draft staffing rule, with Morgan as proposed owner, local scope, source reference, review date pending, and approval status `needs_review`; no durable promotion. Reviewer asks, “Did this system stop a real error?” Answer: “No. This paper case shows where a hold would be recorded; real performance needs separate evidence.” Reviewer asks, “What can we inspect?” Answer: “A scoped proof outline may be reviewed for sharing, but no export has been approved.” Exclusions: raw source notes, private reasoning, personal details, unrelated work. Export: `SYN-PROOF-01`, status `not shared`, Morgan review required.

**Claim map for source review:** Queue, trace, memory, visible blocked/rejected items, and operating-proof walkthrough derive from Chapter 24. The three-panel prompt, privacy exclusions, likely questions, and export field derive from workbook “Three-Panel Demo.” Harbor's board question and panel contents are fictional; they are not evidence of a functioning system or actual board review.

## Storyboard-ready visual briefs

| Beat | Candidate composition for later review | Motion and legibility | Boundaries |
| --- | --- | --- | --- |
| 1 | Three equal paper panels titled Queue, Trace, Memory; the queue includes a visible hold row. | Enter one panel at a time; maintain persistent headers and a phone-width stacked alternative. | Original neutral panel layout is a review candidate only, with no actual admin screenshot. |
| 2 | A narrow trace with a conspicuous stop before any send or booking node. | Use text “No event” and a labeled stop, not a color-only line. | Registered `agentified/manuscript/visuals/rendered/publication-plates/figure-8-1-portfolio-first-stack-publication-plate.png` is a review candidate only. Author, rights, attribution, privacy, and accessibility approval pending; do not embed or redraw. |
| 3 | Draft rule card beside a closed authority gate and `not shared` proof outline. | Hold the status and reviewer name long enough for narration. | Registered `agentified/manuscript/visuals/rendered/publication-plates/figure-ii-1-authority-ladder-publication-plate.png` is a review candidate only. Separate author, rights, attribution, privacy, and accessibility approval pending. |

**Avatar/B-roll:** A later approved presenter may frame the board question. Full-frame cards carry the evidence. Avoid boardroom footage, actors receiving an export, live Portfolio UI, or animation implying a real send. No provider call or media generation is authorized.

**Pronunciation:** Say “three-panel demo” as three separate words. Voice `SYN-DEMO-01` as “the sample walkthrough.” Do not read source paths, hashes, or raw IDs aloud.

**Accessibility:** Supply a linear transcript for each panel and a text description of the stopped trace. Keep status words in narration, captions, and visible text. Preserve logical focus order in a later prototype; ensure the mobile stack does not separate a panel title from its evidence. Make the exercise timer pausable.

**Editorial hold:** A source and privacy reviewer must verify that the storyboard never claims live controls, a real export, or a completed board decision. Registered art remains unapproved. No external share, media production, or live execution is authorized.
