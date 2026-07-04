## Chapter 6: From Feedback To Memory

Priya caught it first, on a Tuesday.

The agent that drafted follow-up emails for the design partner program had addressed a hospital administrator as "Dr." She was not a doctor. Priya corrected the draft, added a note in the review tray that said, "Ana is Director of Operations, not clinical staff. Do not use Dr. for her." She approved the revision. The email went out. She moved on.

Wednesday morning, the same agent produced a new draft for the same recipient. It opened with "Dear Dr. Ana."

Priya walked over to Sam's desk holding her laptop like it had personally offended her.

"I told it yesterday," she said. "I typed the correction into the review tray. I used her actual title. And here it is doing it again."

Sam looked at the screen, then at the review tray history. The correction was there, timestamped, in Priya's own words. The agent had generated its Wednesday draft without ever seeing it.

"It didn't ignore you," Sam said. "It never learned from you."

Priya waited.

"The correction lived in the review tray. The agent lives in a different part of the system. Nothing carried your note from one to the other."

"So I have to correct it every single time?"

"Not unless we build the bridge," Sam said. And then, quieter, mostly to himself, "And we have to build it carefully."

He closed his laptop and sent a note to the team pushing the week's roadmap items. The source ladder from the day before had solved one half of the problem. Agents could no longer quote anything they wanted. But nothing in the system yet decided what they were allowed to remember. That was the next gate.

### The trap under the surface

In Chapter 7 of "Accelerated," "Discovery - From Feedback to Signal," the discipline was to turn feedback into signal. A support ticket became a tagged pattern. A churn interview became a coded theme. A sales objection became a category. That work carried an organization from reacting to individual complaints to reading currents. [A1]

Signal was a fine stopping place when humans did the work.

Agents change the shape of the problem. An agent that reads a correction and files it under "signal" has done nothing useful, because the next agent, one minute later, will not read that file. Signal that is not carried forward is signal that was never received. And signal that is carried forward without care becomes something worse than forgetting. It becomes a rumor the system tells itself.

Sam had watched two companies fall into this trap. In both cases, someone had wired a language model to remember whatever it saw. Whatever a teammate typed into chat became a fact. Whatever a customer said in an angry email became a truth. Whatever a junior analyst hypothesized in a Slack thread became doctrine. Within a few weeks the agents were confidently repeating claims that were half-true, misattributed, or invented by a bad day.

The problem was not that memory was bad. The problem was that memory had no gate.

### Signal becomes source. Source becomes memory.

Sam wrote the upgraded principle on the wall next to the one from last year.

Old: Feedback becomes signal.

New: Signal becomes source. Source becomes memory.

Feedback is what a human said. Signal is what the pattern means. Source is a durable record of a claim tied to who made it and when. Memory is a promoted, owned, revocable fact that agents may act on.

Between source and memory sits a gate. Nothing an agent proposes crosses that gate on its own.

The gate is the part organizations skip. They read a book about agents, wire up a vector store, call it memory, and soon wonder why the agents contradict themselves and quote people who never spoke.

A durable memory needs five things:

1. Provenance. Where the claim came from. Which teammate, which customer, which document, which moment.
2. Proposal. Someone or something proposed that this fact be promoted. The proposal is a distinct step. Nothing becomes memory by accident.
3. Approval. A human with the right authority approved the promotion. The approver is named. The approval is timestamped. Agents may propose. Only humans approve.
4. Owner. Every memory has a person or role responsible for it. Memory without an owner is memory nobody will correct.
5. Revocation. Every memory can be pulled back. If the fact changes, if the source recants, if the approval was wrong, the memory can be retired and the agents that leaned on it are notified.

Miss any of the five and you do not have memory. You have drift with a database.

### The S-E-P-M Pipeline

Sam sketched the pipeline for Priya on a whiteboard while she drank the coffee she had brought over cold two hours earlier.

`Source -> Event -> Proposal -> Memory`

Source is the raw record. The email Priya sent. The ticket the customer filed. The interview transcript. The correction typed into the review tray. Source is preserved verbatim. It is never edited. It carries the identity of who produced it.

Event is what happened. An agent generated a draft. A teammate corrected it. A customer replied. The event is structured. It has a type, a timestamp, an actor, and a reference to its source.

Proposal is a nomination. The system, or a person, looks at a source and an event and says, "This looks like it should become durable memory." The proposal names the claim, names the source, names the proposer, and enters a queue. It is a candidate fact, nothing more.

Memory is what survives the gate. A named owner approves the proposal. The memory becomes available to agents. It carries its provenance with it, so any agent using the memory can show its receipts. And it can be revoked, which means the memory has an off switch as easy to reach as the on switch.

Priya's correction, run through the pipeline, would have looked like this.

Source: her review-tray note. Ana is Director of Operations, not clinical staff. Do not use Dr.

Event: correction on draft 4471, actor Priya, timestamp Tuesday afternoon.

Proposal: promote "Ana at Willowbrook Health is addressed as Director, not Dr." to durable memory. Proposer: the review agent. Suggested owner: Priya.

Memory: after Priya approves, the fact is available to any agent drafting on the Willowbrook Health account. Any future draft reads the memory and honors it. If Ana later earns a doctorate and asks to be addressed as Dr., Priya revokes the memory and adds a new one, and the agents update on their next run.

The machinery can be plain. The important part is that the agent never decides, on its own, what becomes true.

### Open Brain

Long before I had a clean name for Open Brain, Portfolio had been doing quieter work. It gathered the work I kept producing and the decisions I kept making. Public material had one place. Client-safe summaries had another. Private working notes stayed private. Product ideas, scripts, drafts, operating rules, and lessons from old projects stopped disappearing into scattered folders. The portfolio became a corpus with boundaries.

That boundary mattered when the agentic layer arrived. Agents need context. Context without ownership becomes noise. Portfolio gave Open Brain a starting substrate: enough of my personal and professional fingerprints to help an agent recognize my patterns, with enough structure to keep raw private material away from public outputs. Memory became easier to govern because the work already had shelves. The agent could point to a source, propose a memory, and wait for approval instead of treating every retrieved sentence as truth.

The team called their implementation Open Brain, and by Friday it held four collections and a compiled overlay.

Sources held the raw records. Every correction, transcript, email, ticket, and note. Nothing was deleted. Nothing was rewritten.

Events held the structured happenings. Every draft, every approval, every rejection, every promotion, every revocation. The event log was append-only.

Proposals held the candidate facts. Each proposal named its source, its claim, its proposer, and its suggested owner. Proposals had three fates: approved, rejected, or expired. Expired proposals were archived rather than deleted, so the team could later see which patterns kept coming back and being ignored.

Memories held the promoted facts. Each memory carried a link back to its source, its event, its proposal, its approver, and its owner. Any agent could read the memory and cite it. Any owner could revoke it. When a memory was revoked, every agent that had cited it recently received a note, so recent work could be checked for contamination.

On top of the four collections sat a compiled wiki overlay. The overlay was regenerated nightly. It read the current memories and produced a human-readable reference document for each account, each product line, each internal process. If you wanted to know how the Willowbrook team preferred to be addressed, you did not ask an agent. You read the overlay. And the overlay carried links, all the way back to the sources.

Priya's correction became one line in the Willowbrook overlay. Behind that one line stood a chain: her note, her approval, her ownership, and her ability to change her mind.

### Exercise

Take one piece of feedback from your last week. A correction to a draft. A note from a customer call. A follow-up from a stakeholder.

Walk it through S-E-P-M.

Ask where the source is stored. See if you can still find it a month from now.

Ask what event it produced. Notice whether the event was recorded, or whether it lived and died in someone's inbox.

Ask whether anyone proposed that the underlying claim become durable. If not, ask who would have done it.

Ask that if it had become memory, who would have owned it, and who could revoke it.

Most feedback dies between source and proposal. That is where organizations lose the most learning. Nobody nominated the fact. Nobody had the authority. Nobody had the time. So the same correction gets typed again next week.

Find your gap. Fix the gap before you build another agent.

### The closing question

Priya came back on Thursday with a question that made Sam write it on the wall too.

"If a memory can't be revoked," she said, "is it memory, or is it drift?"

He thought about the two companies whose agents had grown confident on rumor. He thought about the overlays and the audit trails and the owner names in the corners of every card.

Memory that cannot be pulled back is not memory. It is the shape of a mistake, hardening.
