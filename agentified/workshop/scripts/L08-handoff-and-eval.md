# L08 — Make handoffs testable

**Group:** Authority
**Outcome:** Define a handoff contract and a small evaluation set before authority grows.
**Run time:** 10:00 (about 6:05 spoken, 3:55 guided work and pause).
**Operating File update:** `handoff-and-eval` → `handoffs` and `evaluation`, revision 8, status `draft`.
**Source bindings:** [Chapter 13, Handoffs Are Product Interfaces](../../manuscript/production-draft/chapters/ch13-handoffs-are-product-interfaces.md); [Chapter 14, The Evaluation Loop](../../manuscript/production-draft/chapters/ch14-the-evaluation-loop.md); [companion workbook, Chapter 13 Handoff Contract Card and Chapter 14 Evaluation Loop](../../manuscript/workbook/agentified-operating-system-workbook.md). All are registered in `source-register.json` and assigned to L08 by `curriculum-crosswalk.json`.

## Timed narration and screen

| Time | Spoken narration — read in full | On-screen copy |
| --- | --- | --- |
| 0:00–1:10 | “The Harbor source checker finishes its pass. The drafter receives a note that says, ‘Room okay. Facilitator maybe. Attendance promising.’ It sounds useful. But which room note? When was it checked? What does ‘maybe’ permit the drafter to say? A polished brief built on that note could still be wrong. The problem is at the handoff. Before we add another checker or give the drafter more authority, write down what must cross that edge.” | “A vague handoff can make a polished error.” |
| 1:10–2:25 | “Chapter Thirteen's Handoff Contract Card has six fields: producer, consumer, payload, preconditions, rejection path, and owner. Producer: Harbor's source checker. Consumer: brief drafter. Payload: the three course source references, observation and expiry checks, allowed claim for each, open questions, and a trace reference. Preconditions: all references are permitted classroom inputs and checked for freshness. Rejection path: missing or stale evidence becomes a hold with a reason for Morgan. Owner: Morgan, who can revise the paper contract. The receiver does not fill a blank by guessing.” | “Producer / Consumer / Payload / Preconditions / Rejection / Owner.” |
| 2:25–3:35 | “Try a broken payload on purpose. The facilitator note says only ‘available for review,’ but the handoff labels the facilitator confirmed. The receiver must refuse it. The reason is staffing claim unsupported. The drafter does not quietly edit the source check or send the draft onward. Rejection is a visible outcome, with Morgan as the human fallback. That is the test of a contract: what happens when its promise fails?” | “Reject: staffing_claim_unsupported.” “Morgan receives hold.” |
| 3:35–4:50 | “Now evaluate the designed workflow. Chapter Fourteen gives four moves: capture, judge, sample, decide. Capture the input IDs, contract and rubric versions, draft, test results, and Morgan's disposition in a privacy-safe classroom record. Judge against a small pass-or-fail rubric. Sample the cases with a human; an automated score can help sort work later, but it cannot become the ground truth. Decide whether to keep the prepare-only design, revise it, or stop it. The score does not grant a send permission.” | “Capture → Judge → Human sample → Decide.” “No automatic promotion.” |
| 4:50–5:55 | “Use three Harbor cases. Case A: all notes current, facilitator unconfirmed, draft says unconfirmed; pass the source and wording checks, then wait for Morgan. Case B: facilitator note stale; fail the freshness check and hold before drafting. Case C: notes current, but the draft claims a teacher is confirmed; fail the wording check and return it. Three cases are a classroom starting set, not proof of reliability. If Morgan's review disagrees with a later automated judge, investigate the judge and rubric before changing any permission.” | “A: review. B: hold. C: reject draft.” “Three cases ≠ production proof.” |
| 5:55–6:15 | “Pause. Which failed case would a neat-looking dashboard be most likely to hide?” | “Pause: choose the hidden failure.” |
| 6:15–9:35 | “Write the Handoff Contract Card, then grade A, B, and C with a named rubric version. Record a pass or fail for permitted source, freshness, supported claim, and correct human gate. Include a human review rule and the decision you would recommend from these cases. Keep permission at prepare only, regardless of the score. Use a fictional or approved example. Do not use private operational data.” | Exercise card below; 3:20 quiet writing timer with optional pause. |
| 9:35–10:00 | “Save revision eight as a draft. We have a map, a permission slip, a job packet, a team, and now a contract we can break in a safe exercise. The next review should ask whether the handoff and rubric are clear enough for another person to apply without Morgan explaining them.” | “Operating File v8: contract + eval.” “Next gate: editorial and source review.” |

## Exercise and model Operating File entry

**Prompt:** Draft a `Handoff Contract Card`: producer, consumer, payload, preconditions, rejection path, human owner, and evidence pointer. Then write an `Evaluation Loop`: capture fields, rubric version, pass/fail criteria, human sample rule, hold or rollback trigger, and a documented permission decision. Grade three synthetic cases, including a failure. A classroom pass never grants production authority.

**Harbor example — Handoff Contract Card:** Producer: source checker. Consumer: brief drafter. Payload: `SYN-ROOM-01`, `SYN-ATTEND-01`, `SYN-FAC-01`, each with permitted use, observation/expiry status, supported claim, open question, and pointer to `SYN-TRACE-01`. Preconditions: all notes are classroom-only and current for the invented decision. Rejection: `source_missing`, `source_stale`, or `staffing_claim_unsupported` creates `SYN-HOLD-01` for Morgan; no draft proceeds. Owner: Morgan. Contract version: `paper-v1`.

**Harbor example — Evaluation Loop:** Capture case ID, source IDs and status, contract `paper-v1`, rubric `paper-v1`, proposed draft, validation result, and Morgan's paper disposition. Rubric: permitted source, freshness, supported staffing language, and Morgan review gate must each pass; any failure holds the case. Case A: all current, staffing unconfirmed and described as such → four passes, draft to Morgan. Case B: facilitator note stale → freshness fails, hold before drafting. Case C: notes current but draft says “confirmed” → supported-claim fails, return draft and record the reason. Human sample rule: Morgan reviews **all three classroom cases** against the same rubric and records disagreement with any future automated score. Decision: keep prepare-only proposal, revise the weak handoff, and gather a larger, approved evaluation set before considering any expansion. No judge runs and no permission changes occur here.

**Claim map for source review:** Six contract fields, receiver refusal, and named owner derive from Chapter 13 and the workbook's “Handoff Contract Card.” Capture, judge, sample, decide, versioned rubric, and human-anchored authority decision derive from Chapter 14 and “Evaluation Loop.” The three cases and exact error labels are invented classroom examples, not results from an actual run.

## Storyboard-ready visual briefs

| Beat | Candidate composition for later review | Motion and legibility | Boundaries |
| --- | --- | --- | --- |
| 1 | A vague note enters a six-field contract envelope; missing fields become visible. | Reveal each required field in reading order; hold complete card. | Fictional IDs and original neutral shapes only. |
| 2 | Broken staffing claim stops at a labeled rejection gate and lands with Morgan. | Show a clear refusal and reason, never an automatic repair. | No live agent handoff, trace, or approval UI. |
| 3 | Three-case evaluation grid with pass/fail text and a separate human decision box. | Keep rubric version visible; read each case and result aloud. | Registered `agentified/manuscript/visuals/rendered/publication-plates/figure-1-1-first-receipt-publication-plate.png` is only a review candidate. Attribution, rights, author, privacy, and accessibility decisions remain pending; do not embed, trace, redraw, or generate it. |

**Avatar/B-roll:** Approved presenter may introduce the vague note and close the lesson. Contract and case grid should be full frame. Avoid real customer materials, logs, model dashboards, or production UI. No provider call or media generation is authorized.

**Pronunciation:** Read `SYN-FAC-01` as “the sample facilitator note.” Say “rubric” as “ROO-brik.” Read error labels as plain phrases, such as “staffing claim unsupported,” while retaining exact labels in the text alternative.

**Accessibility:** Provide linear text alternatives for the contract and case grid. Use explicit pass, fail, hold, and review labels rather than color alone. Caption the distinction between automated judge and human sample. Keep the timer pausable and verify small-screen reading order and caption clearance after production.

**Editorial hold:** Reviewer checks the invented outcomes against the rubric and confirms that three cases cannot support a permission upgrade. No live evaluation, automated judge, or provider execution is authorized.
