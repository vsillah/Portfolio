# L01 — Give the agent a job and a receipt

**Group:** The Harness
**Outcome:** Define one bounded job and a receipt that makes its work reviewable.
**Run time:** 9:00 (about 5:30 spoken, 3:30 guided work and pause).
**Operating File update:** `workflow-and-job` → `workflow` and `receipt`, revision 1, status `draft`.
**Source bindings:** [Chapter 1, The First Receipt](../../manuscript/production-draft/chapters/ch01-the-first-receipt.md); [Chapter 2, Agents Need Jobs Not Vibes](../../manuscript/production-draft/chapters/ch02-agents-need-jobs-not-vibes.md); [companion workbook, Chapter 1 Agent Work Receipt and Chapter 2 Agent Job Description](../../manuscript/workbook/agentified-operating-system-workbook.md). All three paths are registered in `source-register.json`; chapter 1–2 and both workbook outputs are assigned here by `curriculum-crosswalk.json`. These are paraphrase sources, not permission to reproduce the manuscript or workbook.

## Timed narration and screen

| Time | Spoken narration — read in full | On-screen copy |
| --- | --- | --- |
| 0:00–1:05 | “Friday afternoon. Morgan runs a small community learning program. Someone suggests adding a free digital-skills session next month. There are three notes on the table: a made-up attendance count, a made-up facilitator availability note, and a made-up room-capacity note. An assistant can turn those into a neat recommendation in seconds. But if Morgan asks, ‘Where did this come from?’ a polished paragraph is thin protection. The work needs a trail.” | “A suggestion needs a source.” “Fictional case: Harbor Learning Circle.” |
| 1:05–2:20 | “Our job today is small: design one preparation role and one receipt. The agent does not decide whether the session happens. It prepares a Session Option Brief for Morgan to review. That distinction matters. If we give the system a loose command like ‘run the workshop program,’ we have no useful boundary. What exactly begins its work? What can it read? What must it hand back? Who owns the outcome? These are ordinary management questions. They become more urgent when a tool can produce work while nobody is watching.” | “Job: prepare one Session Option Brief.” “Owner: Morgan, program lead.” |
| 2:20–3:35 | “Write the job in one sentence: ‘When Morgan requests a monthly session review, prepare one brief comparing a proposed free session against the three cleared sample inputs.’ The trigger is Morgan's request. The output is a draft brief. The manager is Morgan. The measure is whether Morgan can check the claim and source for every recommendation without chasing the agent through a log. The forbidden actions are just as plain: no booking, no announcement, no message to participants, no spending. A useful agent job names the work it finishes and the work it leaves alone.” | “Trigger → cleared inputs → draft brief → Morgan.” “No booking • no announcement • no spending.” |
| 3:35–4:50 | “Now attach the receipt. Imagine the brief says the room can hold twenty people. Morgan needs to see which invented note supplied that number, when the brief was prepared, what the agent actually did, and whether anyone approved it. The receipt also records cost or resource use, outcome, and how to pull the draft back. A blank field stays blank and gets an owner. We never fill a gap with a confident guess. The first receipt is a handoff a busy person can understand; the engineering log can remain behind it.” | “Receipt: intent • agent • source • action • artifact • approval • cost • outcome • rollback.” |
| 4:50–5:45 | “In our case, approval is ‘pending Morgan.’ The outcome is ‘draft prepared, no session selected.’ The rollback is ‘withdraw the draft from the review folder and mark it superseded.’ If the source for room capacity is missing, mark the brief blocked. A complete-looking card without a source can move bad information faster than an obviously unfinished one. The receipt makes that gap visible before anyone treats the draft as a decision.” | “Approval: pending.” “Missing source → hold.” |
| 5:45–6:05 | “Take a moment. Picture one workflow in your own work. Keep this exercise on paper or in a local draft. Use invented details. What is the one useful output, and who would have to defend it?” | “Pause: choose one workflow type.” |
| 6:05–8:25 | “Fill the Job and Receipt boxes. Name the trigger, permitted inputs, output, human manager, success check, and three forbidden actions. Then fill the nine receipt fields for one imaginary run. If you cannot name a source, approval state, or rollback, write ‘unknown’ and the person who must resolve it. Do not open a real system to complete this exercise. The point is to see the shape of the work before asking a tool to do it.” | Exercise card below; 2:20 quiet writing timer with optional pause. |
| 8:25–9:00 | “Save those two boxes in your Agentified Operating File as a draft. Your stop condition is simple: if the owner, source, or review gate is missing, the draft stays on paper. Next we will name the decision Morgan actually owns.” | “Operating File v1: workflow + receipt.” “Stop: missing owner, source, or gate.” |

## Exercise and model Operating File entry

**Prompt:** Choose a familiar workflow type. Use invented details. Write the one-sentence agent job; trigger; allowed input references; draft output; human manager; success check; three forbidden actions. Then record the nine receipt fields for an imaginary run. Circle every unknown and assign a human owner. Do not paste a real trace or personal record.

**Harbor example:** `workflow_id: harbor-session-option` (illustrative opaque local ID); job: prepare one Session Option Brief; human outcome: Morgan can choose whether to discuss a session; scope: read sample IDs `SYN-ROOM-01`, `SYN-ATTEND-01`, `SYN-FAC-01` and draft locally; exclusions: booking, messages, spending. Receipt `SYN-RUN-01`: intent—compare one proposal; agent—brief-preparation role; sources—those three IDs; action—drafted comparison; artifact—`SYN-BRIEF-01`; approval—pending Morgan; cost—unmeasured classroom example; outcome—draft only; rollback—mark draft superseded. `updated_at` is a learner-entered local date; `evidence_refs` hold only the synthetic IDs. No field is `approved_for_local_use` yet.

**Claim map for source review:** The receipt fields and readable handoff derive from Chapter 1 and the workbook's “Agent Work Receipt”; the bounded job, manager, trigger, success check, and forbidden actions derive from Chapter 2 and “Agent Job Description.” Harbor, Morgan, the source IDs, and the Session Option Brief are original fictional teaching examples. No claim that this workflow exists in Portfolio is made.

## Storyboard-ready visual briefs

| Beat | Candidate composition for later review | Motion and legibility | Boundaries |
| --- | --- | --- | --- |
| 1 | Overhead illustration of three anonymous sample cards beside a blank brief; no real venue or participant imagery. | Bring cards in one at a time; hold labels long enough to read. | Fictional text only. No screenshots of an actual system. |
| 2 | A simple horizontal path: trigger, cleared inputs, draft, Morgan review. | Trace a single line with a visible numbered step; never rely on color alone. | Original neutral diagram if later approved. |
| 3 | Split card: job description on left, receipt on right. Highlight “pending” and “source missing.” | Minimum large-text view; reveal no more than three lines at once. | Registered first-receipt plate is only a candidate: `agentified/manuscript/visuals/rendered/publication-plates/figure-1-1-first-receipt-publication-plate.png`. Its attribution, rights, and author review remain pending; do not embed or recreate it. |

**Avatar/B-roll:** An approved presenter, if later chosen, may deliver the opening and closing. During field walkthrough, favor full-frame text and diagram so the evidence is readable. No generated participant faces, documentary community footage, book cover, or product footage is needed. No provider call is authorized.

**Pronunciation:** Agentified: “AY-jent-uh-fied.” Harbor Learning Circle and Morgan are fictional. Say “receipt” as the ordinary word, then define it as the plain-language record of work.

**Accessibility:** Burned-in text is not the sole carrier of meaning; captions and a transcript must include each field. Read the path in logical order. Make the writing timer pausable, avoid rapid card movement, use high contrast, and preserve a text equivalent for the diagram. An editor must check actual caption timing and mobile legibility after media exists.

**Editorial hold:** Read aloud to confirm timing. Verify the source and rollback examples remain synthetic. No visual is cleared for lesson production.
