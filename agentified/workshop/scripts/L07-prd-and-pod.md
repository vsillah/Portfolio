# L07 — Specify the work and the team

**Group:** Authority
**Outcome:** Describe requirements, roles, ownership, and failure handoffs.
**Run time:** 10:00 (about 6:00 spoken, 4:00 guided work and pause).
**Operating File update:** `prd-and-pod` → `requirements` and `team`, revision 7, status `draft`.
**Source bindings:** [Chapter 11, PRDs For Agents](../../manuscript/production-draft/chapters/ch11-prds-for-agents.md); [Chapter 12, Swarms Need Org Charts](../../manuscript/production-draft/chapters/ch12-swarms-need-org-charts.md); [companion workbook, Chapter 11 Agentic PRD Packet and Chapter 12 Pod Model](../../manuscript/workbook/agentified-operating-system-workbook.md). All are registered in `source-register.json` and assigned to L07 by `curriculum-crosswalk.json`.

## Timed narration and screen

| Time | Spoken narration — read in full | On-screen copy |
| --- | --- | --- |
| 0:00–1:05 | “Morgan receives a polished Session Option Brief. It compares three notes and says the facilitator is confirmed. That one word is wrong. The source said ‘available for review.’ The preparation role did what an old brief told it to do: ‘Summarize the best session option.’ That sentence left the hardest part in Morgan's head. What counts as ready? Which source is required? When must the work stop? A human colleague might ask. A paper agent design needs those answers written down.” | “Polished draft. Wrong staffing claim.” “What did the requirement omit?” |
| 1:05–2:25 | “Chapter Eleven turns the request into an Agentic PRD Packet. Seven fields carry the load: outcome, scope fences, input manifest, acceptance tests, escalation, owner, and reversal. The outcome is a comparison Morgan can review, not a session announcement. Scope fences keep the role away from participant messages and calendar changes. The input manifest lists the three Harbor note references and their freshness checks. An acceptance test says staffing language must match the facilitator note exactly in meaning. If the note is missing or ambiguous, the escalation is a hold for Morgan.” | “Outcome • Scope • Inputs • Tests • Escalation • Owner • Reversal.” |
| 2:25–3:35 | “Reversal is modest here. Morgan can return a draft for correction or withdraw it from review. There is no external send to reverse. A test result belongs beside the draft as evidence: source IDs checked, staffing wording checked, review gate present. A failed check does not become a footnote under a confident recommendation. It blocks the handoff. This packet remains a proposed design; writing it does not configure an agent.” | “Failed test → hold.” “Draft withdrawal: Morgan.” |
| 3:35–4:45 | “Now give the work an organization. One role checks sources; one role assembles the comparison; Morgan owns the outcome. If both preparation roles produce separate answers without a common handoff, Morgan gets a small swarm and two versions of the truth. Chapter Twelve's Pod Model asks for a charter, lead, specialists, board, standup, and handoff. For this tiny classroom pod, keep the lead as a preparation coordinator, not an approver. The board is a proposed paper status list. The standup is a short proposed summary of ready and blocked work.” | “Small pod: one outcome, clear handoffs.” “Human owner: Morgan.” |
| 4:45–5:55 | “The charter is narrow: prepare one evidence-bound option brief for Morgan. The source checker may flag staleness, not repair a source by inventing a newer date. The drafter may compare, not confirm staffing. The coordinator may route a blocked packet to Morgan, not override the block. The board should show who holds the next move. If nobody owns a failed source check, the org chart is decorative. Write that ownership into the handoff now.” | “Source checker → drafter → coordinator → Morgan.” “Block owner: Morgan.” |
| 5:55–6:15 | “Pause. Who would receive the brief if the facilitator note stays unconfirmed? Name the role and the human.” | “Pause: name the receiver.” |
| 6:15–9:35 | “Draft the seven-field PRD in under a page. Give it two acceptance tests, including the staffing claim, and one explicit failure route. Then sketch the Pod Model: charter, lead, specialists, board, standup, handoff, and human owner. Use role labels and course references. Use a fictional or approved example. Do not use private operational data, configure production agents, or promote the pod's coordinator into final decision authority.” | Exercise card below; 3:20 quiet writing timer with optional pause. |
| 9:35–10:00 | “Save revision seven as a draft. A requirement becomes useful when a new teammate can tell what to prepare and when to stop. A team becomes useful when a blocked packet has one place to land. Next we will test that handoff with three course cases.” | “Operating File v7: PRD + pod.” “Next: handoff and evaluation.” |

## Exercise and model Operating File entry

**Prompt:** Write an `Agentic PRD Packet` with outcome, scope fences, input manifest, acceptance tests, escalation, owner, and reversal. Add a `Pod Model` with charter, lead, specialists, board, standup, handoff, human owner, and a failure path. All roles are paper labels, not production agent configuration.

**Harbor example — PRD:** Outcome: draft one `SYN-BRIEF-01` comparing whether to propose a free digital-skills session. Scope: preparation and routing to Morgan; forbid contact, booking, purchase, publication, source edits, and memory promotion. Inputs: `SYN-ROOM-01`, `SYN-ATTEND-01`, `SYN-FAC-01`, each classroom-only and freshness-checked. Acceptance tests: every factual claim maps to a permitted source; staffing is never called confirmed without a separate confirmation record; trace names Morgan as reviewer. Escalation: missing, stale, or conflicting input produces `SYN-HOLD-01`. Owner: Morgan. Reversal: Morgan returns or withdraws the draft with a reason; no external action occurred.

**Harbor example — Pod Model:** Charter: prepare one comparison for Morgan under the L06 slip. Lead: preparation coordinator, responsible for collecting the packet and recording status, with no approval authority. Specialists: source checker and brief drafter, both prepare-only. Board: proposed rows `intake / source-held / draft-review / Morgan-review`; no live system. Standup: one short status summary for Morgan if this were later approved. Handoff: source checker supplies permitted IDs and check results to drafter; coordinator supplies brief, trace, and test results to Morgan. Morgan owns the outcome and every external decision. If an input fails, coordinator routes the hold to Morgan and no draft proceeds.

**Claim map for source review:** Seven PRD fields and acceptance-test discipline derive from Chapter 11 and the workbook's “Agentic PRD Packet.” Six pod parts and named outcome ownership derive from Chapter 12 and “Pod Model.” Harbor's split into three preparation roles is a classroom design choice, not a claim that such agents are deployed.

## Storyboard-ready visual briefs

| Beat | Candidate composition for later review | Motion and legibility | Boundaries |
| --- | --- | --- | --- |
| 1 | A two-line before/after requirement card: vague request beside seven-field packet. | Reveal missing input and stop rule before showing the complete packet. | No actual customer or staff record. |
| 2 | A small pod chart with source checker, drafter, coordinator, and Morgan; Morgan's decision gate is visually separate. | Follow arrows in reading order; use text labels on every arrow. | Role labels only; no production agent configuration or implied automation. |
| 3 | A blocked `SYN-FAC-01` handoff card landing with Morgan instead of the drafter. | Hold the blocked state and reason long enough to read. | Registered `agentified/manuscript/visuals/rendered/publication-plates/figure-ii-1-authority-ladder-publication-plate.png` is only a review candidate. Attribution, rights, author, privacy, and accessibility decisions remain pending; do not embed, redraw, or generate it. |

**Avatar/B-roll:** Approved presenter may introduce the wrong-word problem. Keep PRD and pod chart full frame during explanation. Avoid real team footage, dashboards, staff documents, or agent configuration. No provider call or media generation is authorized.

**Pronunciation:** Say “PRD” as “P R D,” then “requirements packet.” Say “pod” as the ordinary word. Read synthetic IDs by their plain descriptions in speech; keep exact IDs visible and in transcript.

**Accessibility:** Provide linear text versions of the seven-field packet and pod chart. Distinguish the coordinator from Morgan by label and border style, not color alone. Caption “available for review” and “confirmed” precisely. Make timer pausable, and check diagram reading order and text size at narrow widths after production.

**Editorial hold:** Reviewer checks that the staffing failure remains visible and that an agent lead has no human authority. No live pod, board, standup, or routing is created by this packet.
