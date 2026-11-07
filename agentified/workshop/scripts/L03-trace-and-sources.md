# L03 — Trace the work and grade the sources

**Group:** The Harness
**Outcome:** Specify operator-readable trace fields and safe source tiers for the same workflow.
**Run time:** 10:00 (about 6:00 spoken, 4:00 guided work and pause).
**Operating File update:** `trace-and-source-policy` → `sources` and `receipt.trace`, revision 3, status `draft`.
**Source bindings:** [Chapter 4, The Trace Harness](../../manuscript/production-draft/chapters/ch04-the-trace-harness.md); [Chapter 5, Data Safety Becomes Source Safety](../../manuscript/production-draft/chapters/ch05-data-safety-becomes-source-safety.md); [companion workbook, Chapter 4 Trace Harness and Chapter 5 Source Safety Ladder](../../manuscript/workbook/agentified-operating-system-workbook.md). All paths are registered in `source-register.json` and assigned to L03 by `curriculum-crosswalk.json`. No source contents are exported into this script.

## Timed narration and screen

| Time | Spoken narration — read in full | On-screen copy |
| --- | --- | --- |
| 0:00–1:10 | “Morgan sees a line in the Harbor Session Option Brief: ‘The room can hold twenty people.’ Morgan asks where the number came from. A raw machine log might answer eventually, after someone searches through hundreds of entries. Morgan needs a shorter trail: the source that carried the number, the date it was checked, what the agent concluded, and the condition that would have stopped the draft. A trace should serve the person accountable for the work.” | “Claim: room capacity = 20.” “Can Morgan defend it?” |
| 1:10–2:20 | “For our paper design, the trace has five questions. What did the agent prepare? What did it read? What would have stopped it? Where is the artifact? Who reviews it? Answer in plain language. ‘Prepared a draft comparison.’ ‘Read the room-capacity note.’ ‘Would hold if the note expired or conflicted with another source.’ ‘Saved the draft brief.’ ‘Morgan reviews.’ We can keep technical diagnostics elsewhere. The operator's view needs the load-bearing facts first.” | “Prepared • Read • Stop rule • Artifact • Reviewer.” |
| 2:20–3:30 | “Now inspect the source. A real document can still be old. A correct citation can still support a wrong current claim. Before the agent uses a source, record who created it, when it was observed, when it expires, what it may be used for, and where it may travel. In the Harbor case, the three course records help us practice a source contract. They are not evidence of actual attendance, room capacity, or staff availability.” | “Citation + freshness + permitted use.” “Course records only.” |
| 3:30–4:55 | “The source ladder gives us four useful tiers: public safe, client safe, internal operations, and private. Public safe means cleared for the specific external use. Client safe stays inside that client's context. Internal operations can inform an internal draft but needs a reviewed rewrite before an external claim. Private material needs explicit access authority and stays out of this workshop exercise. A summary inherits the strictest tier of its sources. A missing tier means hold. A public link by itself does not prove that a document is current, accurate, or cleared for reuse.” | “public_safe / client_safe / internal_ops / private.” “Unknown tier → hold.” |
| 4:55–5:55 | “Classify the three Harbor notes as classroom-only, with no publication permission. The capacity note has a course date and expires before the next planning cycle. The attendance note is an aggregate count, not a list of people. The facilitator note says only ‘available for review,’ not ‘confirmed to teach.’ That wording changes the recommendation. The brief may say ‘availability unconfirmed.’ It may not say the session is staffed. This is source safety doing practical work: it stops a small mismatch from becoming a confident plan.” | “Availability unconfirmed → no staffing claim.” |
| 5:55–6:15 | “Pause. In your own workflow type, which single source would be most dangerous to trust after it goes stale?” | “Pause: choose one source type.” |
| 6:15–9:35 | “Draw the path from source reference to draft to Morgan's review gate. Fill the five trace answers for one course run. Then classify each source: tier, owner, observed date, expiry, read use, quote use, memory use, and publish use. If a source has no attribution or is too old for the decision, mark the brief blocked. Use a fictional or approved example. Do not use private operational data. We are designing the gate, not operating it.” | Exercise card below; 3:20 quiet writing timer with optional pause. |
| 9:35–10:00 | “Save the trace and source policy in your Operating File. The stop condition is a missing source tier, freshness check, artifact reference, or reviewer. Next we will decide what a human correction is allowed to teach the system.” | “Operating File v3: trace + sources.” “Stop: unknown source or reviewer.” |

## Exercise and model Operating File entry

**Prompt:** Draw `source ID → draft artifact ID → human reviewer`. Answer the five Trace Harness questions. For three invented source types, record tier, attribution, observed date, expiry, permitted read/quote/memory/publish use, and what happens if the source is missing or stale. Keep actual operational data out.

**Harbor example:** `SYN-ROOM-01` is an invented room note, owned by classroom facilitator, observed on the exercise date, expiring before the next fictional planning cycle. `SYN-ATTEND-01` is an invented aggregate demand note; no participant identities. `SYN-FAC-01` is an invented availability note whose status is **unconfirmed**. All are classroom-only and may be read for this paper exercise; no external quote, shared memory, or publication. The trace says: prepared `SYN-BRIEF-01`; read those IDs; held any staffing claim because `SYN-FAC-01` is unconfirmed; artifact `SYN-BRIEF-01`; reviewer Morgan. The source policy carries the strictest applicable use restriction into any derived brief. No public-safe promotion is implied.

**Claim map for source review:** The five operator trace questions derive from Chapter 4 and the workbook's “Trace Harness.” The four tier names, source-use permissions, and inherited restriction derive from Chapter 5 and “Source Safety Ladder.” The freshness and staffing examples are fictional applications of those rules. No tier shown here changes access to a real document.

## Storyboard-ready visual briefs

| Beat | Candidate composition for later review | Motion and legibility | Boundaries |
| --- | --- | --- | --- |
| 1 | A large fictional claim card with an attached source ID and expiry row. | Magnify the expiry before showing the hold state; no scrolling log wall. | No real document or product UI. |
| 2 | Five-row operator trace, each row labeled with its question. | Reveal rows in reading order; hold complete trace for review. | Use only synthetic IDs. |
| 3 | Four-tier ladder with one “unknown” source parked outside it. | Read every tier aloud; use labels and placement as well as color. | Registered first-receipt plate is only a candidate: `agentified/manuscript/visuals/rendered/publication-plates/figure-1-1-first-receipt-publication-plate.png`. Attribution, rights, and author review remain pending; do not embed or adapt it. |

**Avatar/B-roll:** Presenter may introduce Morgan's question; trace and ladder should occupy the full frame during explanation. Avoid footage of actual files, clients, children, participants, or a production dashboard. No provider call or media generation is authorized.

**Pronunciation:** Read `public_safe`, `client_safe`, and `internal_ops` as “public safe,” “client safe,” and “internal operations.” “Trace Harness” means the short explanation an owner can defend, not a code log. Source IDs can be called “sample room note” in speech while the exact IDs remain visible and in transcript.

**Accessibility:** Put the tier names in text, never color alone. Provide a text alternative for the source path and ladder. Keep the five-row trace on screen long enough for a slow reader; avoid motion behind it. Captions must include the distinction between “available for review” and “confirmed to teach.” Make the exercise timer pausable and verify mobile text scale after production.

**Editorial hold:** Source reviewer checks tier definitions and the inherited restriction. Privacy reviewer confirms no operational trace or private corpus text appears. The classroom classifications grant no real source access.
