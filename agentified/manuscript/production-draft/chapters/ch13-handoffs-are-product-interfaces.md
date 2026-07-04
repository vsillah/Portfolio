## Chapter 13: Handoffs Are Product Interfaces

The research agent finished before dawn. By the time Sam opened the laptop, the drafting agent had already consumed the research and produced a clean two page brief on a competitor's pricing model. The brief read well. The sentences were tight. The recommendations were specific.

Sam scrolled to the source trail and found a messy chain of links. One was broken. Others pointed at summaries of summaries. One pointed at an internal page that had been renamed enough times to lose its original meaning. The pricing numbers in the brief were plausible. They were not traceable.

Sam closed the laptop and made coffee.

Yesterday Sam had spent the afternoon drawing the org chart. Every agent had a role. Every role had a human owner. On paper the system was clean. This morning, one clean node had handed off to another clean node and produced a brief nobody could defend.

The instinct, the old instinct from Part III of "Accelerated," Momentum, was to add another tool. A verifier. A citation checker. A source ranker. Anything to close the gap between "looks right" and "is right." Sam had watched other teams reach for that instinct. They added agents. They ended up with longer chains that failed in new places. [A1]

The gap was not a missing agent. The gap was an undefined interface.

The research agent had done its job. The drafting agent had done its job. What failed was the space between them, the moment where notes became input. Nothing in the system said what a note had to contain, what counted as a source, or what should happen when a note arrived without one. The two agents were working. The handoff was not.

Sam had spent the last week adding capability. Today Sam would stop adding agents and start writing down the handoffs already in motion.

## The upgrade

In the Move Fast to Discover section of the "Accelerated" course kit, the operating principle was to ship the crappy dashboard, the ugly onboarding email, or the read-only version of the feature. Learn from contact with reality. [A2]

That principle still holds for surfaces a human touches. It bends when the surface faces another agent. The receiver has no taste, no shame, and no way to ask a follow up question in a hallway. The receiver takes what it is given and acts.

The upgrade is small. Ship the smallest useful contract.

A schema tells you the shape of the data. A contract tells you what the receiver is allowed to assume, what the sender is required to provide, and what happens when the two do not match. A schema is a promise about fields. A contract is a promise about behavior.

Every place in an agentic system where work moves from one actor to another is a product surface. The producer ships. The consumer buys. Neither can renegotiate in the middle. The interface is the product.

## Interface quality determines system quality

Sam had a test for this. Draw the system as a graph. Nodes are agents and humans. Edges are handoffs. Then ask: if the whole thing had to be rebuilt next quarter, what would be worth keeping?

The answer is never the nodes. Agents are cheap. Prompts are cheap. Models keep getting cheaper. The thing worth keeping is the edges, the contracts that survived contact with a hundred real cases.

There is a practical consequence. When quality drops in an agentic system, the reflex is to swap the agent. Better prompt, better model, better tool. Sometimes that is right. More often the failure is at an edge, and swapping a node moves the failure somewhere else without fixing it.

The interface between the research agent and the drafting agent was doing all the work of trust in that pipeline. Nobody had written it down.

## The Handoff Contract Card

Sam opened a fresh document and wrote six fields.

**Producer.** Which actor is sending. Name, version if it matters. Not "the research pipeline." A specific agent or human role.

**Consumer.** Which actor is receiving. Same rule.

**Payload.** What is inside the envelope. Not "notes." The exact fields, the exact types, the exact source requirements. If a citation is required, say so. If a confidence score is required, say so. If a link must resolve, say so.

**Preconditions.** What must be true before the handoff is legal. The producer must have finished. The source validator must have run. The topic must sit inside an approved research scope. Preconditions stop bad handoffs from starting.

**Rejection path.** What happens when the payload arrives and the consumer cannot use it. Silent failure is the enemy. A rejection path names the destination. The payload goes back to the producer with a reason code, or to a human queue, or to a blocker table with a status. Every rejection has a place to land.

**Owner.** A human name. Not a team. Not "the platform." One person who can approve a change to this contract and who wakes up when it breaks in production.

Six fields. Half a page. That is the contract card.

Sam wrote the first one for the research to drafting handoff. Producer: research agent v3. Consumer: draft agent v2. Payload: a JSON object with claim, source URL, retrieval timestamp, and confidence. Precondition: source URL must return a 200 and pass the source validator. Rejection path: any payload with a failed source is written to `agent_handoffs.rejected` with reason `source_invalid`, and the research agent is retriggered on that claim. Owner: Sam.

The card took a few minutes. The failure mode that had shipped the uncited pricing brief this morning became structurally impossible under the new contract. Not because of a better model. Because of a smaller, clearer interface.

## Where the human still stands

The contract shapes human review.

The agent can prepare, validate, retry, and route. The agent can reject its own bad output and write the rejection to a table with a reason. What the agent cannot do is decide that a weak source is acceptable this once, or that a client-facing claim can go out without a citation, or that a broken contract should be waived because a deadline is close.

Those calls belong to the owner. The Handoff Contract Card exists so the owner sees them. Rejections are visible. Waivers are logged. A change to the contract itself requires a human signature, not a silent redeploy.

An agentic system without a named owner on every edge is a system where nobody knows who is responsible when the edge breaks. The card fixes that before the incident.

## What Portfolio actually stores

Behind the operating surface, the work is a data model.

The `agent_handoffs` table records every handoff attempted, with producer, consumer, payload hash, precondition results, and outcome. Work items sit downstream: a handoff that passes creates a work item; a handoff that fails writes to blockers. Validation summaries live next to the handoff, so a reviewer opening a work item can see the source validator's verdict without hunting for it.

Visibility earns its keep only when it changes what the team can trace. Every rejection has a location. Every acceptance has a receipt. Every contract has a change history. When the drafting agent produces a brief with weak sources next quarter, the trace does not stop at the brief. It reaches the handoff that let the sources through, the contract in force at the time, and the owner who approved it.

That is what a governed system looks like from the inside. Not fewer agents. Better edges.

## Exercise

Pick one handoff in a system you own. Agent to agent, agent to human, or human to agent. Do not pick the hardest one. Pick a real one.

Draft a Handoff Contract Card. Six fields. Producer, consumer, payload, preconditions, rejection path, owner. Keep the whole thing under a page.

Then look at the payload field and ask: does the producer actually output what you wrote? Look at the rejection path and ask: does that destination exist? Look at the owner and ask: does that person know they are the owner?

If any of those answers is no, you have written a wish, not a contract. Fix the wish or fix the system, but do not ship the card until they match.

## The risk

Contract theater is the failure mode to watch. Schemas checked into a repo, decorated with validation libraries, referenced in slide decks, and enforced by nobody at runtime. A contract that is never consulted during rejection is not a contract. It is documentation in a serious font.

The way to tell the difference is to break the contract on purpose in staging and watch what happens. If the receiver accepts the malformed payload, the contract is theater. If the payload lands in a rejection queue with a reason and an owner, the contract is doing work.

Interface quality is measurable by what happens when the schema is violated.

## Closing question

Which handoff in your system only works because the same person understands both sides?

That is the interface to write down first. It carries invisible weight. It will fail the week that person is on vacation. Turn it into a contract before it turns into an incident.

Ship the smallest useful contract. Then the next one. The system worth trusting is the one whose edges are written down.
