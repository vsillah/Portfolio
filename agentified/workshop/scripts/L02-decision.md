# L02 — Start with the decision

**Group:** The Harness
**Outcome:** Name the human decision the agent prepares and the consequence of a wrong answer.
**Run time:** 8:30 (about 5:15 spoken, 3:15 guided work and pause).
**Operating File update:** `decision-card` → `workflow.decision`, revision 2, status `draft`.
**Source bindings:** [Chapter 3, Start With the Decision](../../manuscript/production-draft/chapters/ch03-start-with-the-decision.md); [companion workbook, Chapter 3 Decision Card](../../manuscript/workbook/agentified-operating-system-workbook.md). Both paths are registered in `source-register.json` and assigned to L02 in `curriculum-crosswalk.json`. Frameworks are paraphrased; the fictional decision is new classroom material.

## Timed narration and screen

| Time | Spoken narration — read in full | On-screen copy |
| --- | --- | --- |
| 0:00–1:05 | “Morgan opens the Session Option Brief. It says the free session is a good idea. The wording sounds settled. Yet the brief has only prepared a comparison. Somebody still has to decide whether the proposal belongs on next month's program agenda. A recommendation can make that decision easier to reach. It cannot quietly become the decision itself.” | “Draft brief received.” “Decision still open.” |
| 1:05–2:10 | “Today we put the decision in the center. Ask one question: ‘Should Morgan propose one free digital-skills session to the program team for next month?’ That is narrower than ‘run a workshop.’ It has a named owner, real alternatives, and a next step that can be held. Morgan can propose the session, request another option, or decline for now. The agent may compare evidence and recommend a path. Morgan owns the call and the explanation.” | “Decision: propose, revise, or hold?” “Owner: Morgan.” |
| 2:10–3:15 | “What if the answer is wrong? A false claim about room capacity could waste a facilitator's preparation. A false attendance signal could make the team spend scarce time on a session nobody asked for. Even in this invented case, the wrong number sends work to people who did not choose it. That is why the card records reversibility. Morgan can withdraw an internal proposal. A public announcement or a paid booking would be harder to unwind, and neither is in scope here.” | “Consequence: staff time and trust.” “Internal proposal: reversible.” |
| 3:15–4:20 | “List the evidence the owner would need: a current room-capacity note, an attendance summary with a clear time window, and facilitator availability for the proposed date. Each item must have a source ID and freshness check. If one is missing, the brief can show the gap. It cannot turn a guess into a fact. The agent's allowed actions are to read those cleared samples, draft alternatives, and place the brief in a review folder. It may not put a date on a calendar, contact participants, or commit money.” | “Evidence: capacity • demand • availability.” “Prepare and recommend only.” |
| 4:20–5:25 | “Now write the stop condition before you write the best-case path. If the capacity note is stale, if the facilitator has not confirmed availability, or if the sources disagree, mark the recommendation ‘hold for Morgan.’ A confidence score can help triage; it cannot replace the named gate. For this classroom card, we use a simple rule: all three required source IDs must be present and current before a recommendation appears. Even then, Morgan decides.” | “Missing, stale, or conflicting evidence → hold.” “Morgan decides.” |
| 5:25–5:45 | “Pause on your own workflow. What choice is a human accountable for after the agent prepares its work?” | “Pause: name the choice.” |
| 5:45–8:05 | “Fill the Decision Card now. Write the choice, the owner, three alternatives, the evidence, the agent's preparation scope, forbidden execution, and the condition that sends the work back to a person. Add the consequence of a wrong answer. If you find that one card contains three separate decisions, split it. A single approval button cannot make three different responsibilities disappear.” | Exercise card below; 2:20 quiet writing timer with optional pause. |
| 8:05–8:30 | “Put the card into your Operating File as a draft. Stop if you cannot name one accountable owner or if the agent can approve its own recommendation. In the next lesson, we will make the evidence path readable to that owner.” | “Operating File v2: decision-card.” “Stop: missing owner or self-approval.” |

## Exercise and model Operating File entry

**Prompt:** In your same workflow type, name a single choice. Fill: owner of record, alternatives, reversibility, required evidence, what the agent prepares, what it cannot execute, review gate, escalation trigger, and consequence of error. Use invented examples and role names. Leave real policies and live approvals outside the exercise.

**Harbor example:** Decision—should Morgan propose one session to the program team? Owner—Morgan. Alternatives—propose the session, request a different date, hold. Reversibility—an internal proposal can be withdrawn; external commitments are excluded. Evidence—`SYN-ROOM-01`, `SYN-ATTEND-01`, `SYN-FAC-01`, each current for the proposed month. Agent—draft and recommend only. Approval—Morgan reviews the brief; team discussion is a later distinct decision. Escalation—any missing, stale, or contradictory source. Fallback—mark `SYN-BRIEF-01` blocked and ask Morgan which missing evidence to obtain. Consequence—unnecessary staff preparation or a misleading proposal. `evidence_refs` point to synthetic IDs; approval stays pending.

**Claim map for source review:** The named decision, owner, reversibility, inputs, allowed actions, and escalation trigger come from Chapter 3. The workbook's “Decision Card” adds required evidence, approval gate, fallback, and rollback fields. The three Harbor alternatives and all consequences are invented for this exercise; they require no real program policy or approval.

## Storyboard-ready visual briefs

| Beat | Candidate composition for later review | Motion and legibility | Boundaries |
| --- | --- | --- | --- |
| 1 | One fictional brief card stops at a visibly closed “Morgan review” gate. | Hold on the closed gate; narration names its owner. | No interface screenshot or actual approval action. |
| 2 | Three option cards: propose, request a different date, hold. | Present in reading order with distinct labels and shapes, not just colors. | No choice is depicted as already selected. |
| 3 | Decision Card with evidence rows and a visible stale-source warning. | Enlarge the warning before showing fallback. | Registered SAM trust-layer plate is only a candidate: `agentified/manuscript/visuals/rendered/publication-plates/figure-0-1-sam-trust-layer-publication-plate.png`. Attribution, rights, and editorial approval remain pending; do not embed or redraw the plate. |

**Avatar/B-roll:** An approved presenter may frame the scenario and the consequence of a wrong call. Keep the Decision Card on screen without a face overlay during the walkthrough. Avoid footage of real community programs or calendar systems. No generated lesson media or provider call is authorized.

**Pronunciation:** “SAM” is said as the name “Sam” if the reviewed source framework is later explained. This lesson does not need the acronym on screen. “Decision Card” uses ordinary words; do not voice the fictional source IDs unless needed for audio-only comprehension.

**Accessibility:** Captions must distinguish recommendation from decision. Read all alternatives aloud. The gate must have a text label and shape cue. Keep the writing timer pausable. Provide a text version of the card and check mobile reading order and caption overlap after production.

**Editorial hold:** Source reviewer checks that the script does not grant the agent final authority. The depicted gate is a design exercise, not a working control or permission to act.
