## Chapter 3: Start With The Decision

Receipts told Sam what an agent had done. They did not tell Sam who had decided it should be done.

That gap was what made Wednesday's demo feel wrong before anyone said a word.

The meeting room smelled like reheated coffee and too much confidence. Four engineers, a product manager, and a designer were three minutes into a live demo of what they were calling the Refund Agent. It read a customer email, checked the order history, weighed the shipping status, cross referenced the return window, and produced a recommendation. Refund in full. Restocking fee waived. Apology template attached.

Sam watched the screen and felt the room tilt.

The product manager, Eli, said the sentence Sam had heard in some form every week for a year. "It handles the whole flow end to end."

"Handles it how," Sam said.

"It reads the ticket, pulls the context, and drafts the resolution. A rep just has to click send."

"Who has already decided?"

The room paused. Someone laughed a little, the way people laugh when a question sounds like it might be a joke. It was not.

"Decided what," Eli said.

"Decided that this customer gets a refund. Decided that the restocking fee gets waived. Decided the tone of the apology. Who owns those calls?"

Eli looked at the engineer to his left. The engineer looked at the designer. The designer looked at the ceiling. The Refund Agent was still on screen, still confident, still waiting for someone to answer for it.

"The rep will still approve it," Eli said.

"Approve what, though. The refund. The waiver. The wording. All three at once with one click?"

Nobody said anything.

Sam did not want to embarrass the team. They had built the pipeline in three weeks. The model was cheap. The prompts were tight. Every piece of the demo was competent work.

The problem was not the agent. The problem was that no one in the room could name the decision they had handed over.

---

In Chapter 4 of "Accelerated," "Answer Driven Discovery," the operating principle Sam had lived by was simple. You did not start with a feature. You started with the question the business needed answered, and the answer changed what you built. That principle had survived rewrites and reorgs and one very ugly quarter. [A1]

Sitting in that meeting, Sam felt the principle stretch. Answer driven discovery still held. But agents did more than answer questions. Agents acted. And acting without a named decision owner was the difference between a helpful teammate and a liability with a login.

The upgrade wrote itself on the whiteboard later that afternoon.

Answer driven discovery becomes decision driven delegation.

You do not delegate a task to an agent. You delegate a decision. And you cannot delegate a decision you have not named.

---

Back at the desk, the fix started small. Before approving any more agent work, the team would fill out something Sam began calling a Decision Card. Six fields. Each one forced a choice the team had been quietly skipping.

**Decision.** The actual call being made. Not the task. The choice. "Should this customer receive a refund" is a decision. "Draft a refund email" is a task. A task has no owner. A decision does.

**Owner of record.** Whose name goes next to the outcome when it lands well or lands badly. Not the team. A person or a role. If the answer is "the agent," the card is not done.

**Reversibility.** Can this be undone in five minutes. In an hour. Not at all. Reversibility sets the tolerance for autonomy. A reversible decision can move faster with lighter review. An irreversible one demands a gate.

**Inputs.** What evidence the agent must consult before acting. Order history. Prior tickets. Policy documents. Memory records. Not context stuffing. The reading list the decision owner would have used.

**Allowed actions.** What the agent may do without asking. Draft. Propose. Route. Tag. Summarize. Prepare a rollback. And what the agent may never do without a human. Send. Refund. Publish. Charge. Waive.

**Escalation trigger.** When the agent stops and hands the call back. Low confidence. Missing evidence. Policy edge case. Repeat customer. Any signal that the decision no longer fits the scope the owner delegated.

Sam pinned the card to the top of the Refund Agent ticket and asked the team to fill it in before the next standup.

They tried. The first draft was rough. The decision was written as "handle refund tickets." Sam sent it back. The second draft named three decisions inside what everyone had been calling one workflow. Whether to refund at all. Whether to waive the restocking fee. What tone to strike with the customer.

Three decisions meant three owners of record, three reversibility ratings, three sets of allowed actions. The single Refund Agent quietly became either three narrower agents with different scopes, or one agent with three explicit gates. The team chose the second. The demo they gave a week later looked less impressive to a casual visitor. It was measurably safer to run.

---

Inside Portfolio, Shaka had been running a version of this discipline for months. The delegation policy for any agent named the task type, the risk class, the required evidence, the fallback path, and the confidence threshold below which the agent had to stop. It read like a job description written for something that did not have feelings but did have consequences.

For a refund style workflow, the Shaka policy would never let the agent send a customer facing message on its own. The agent could assemble the evidence, propose a resolution, note its confidence, and route the packet to a human queue with the receipts attached. The reviewer saw the reasoning, the sources, and the fallback the agent had prepared in case the primary recommendation was rejected. The reviewer clicked. The action happened. The trace was recorded. If the outcome went sideways, the rollback was already drafted.

That structure was what made the delegation real. It was a decision handoff with named boundaries, not a suggestion engine dressed up in agent branding.

A suggestion engine gives you an answer and leaves you to figure out what to do with it. A delegated decision gives you a bounded action taken on your behalf, with a receipt you can defend. Confusing the two is how teams end up with agents that draft everything, send nothing, and produce a mountain of work no one asked for. Or worse, agents that send things they should not, because no one wrote down who owned the call.

---

Try this on one idea from your own roadmap. Pick an agent you are planning to build or one already running. Open a blank page. Fill in the six fields.

Decision. Owner of record. Reversibility. Inputs. Allowed actions. Escalation trigger.

If you cannot name the decision without describing a task, the scope is not ready. If you cannot name the owner without pointing at a team, the accountability is not ready. If you cannot name what the agent may never do, the guardrails are not ready.

Most agent ideas do not survive the first field. That is the point. The Decision Card is a filter, not a form. It stops the agents that should not exist and sharpens the ones that should.

---

The Refund Agent shipped in the end. Not as one thing. As a decision handoff with a card taped to the front, a reviewer at the gate, a rollback in the pocket, and a trace in the record. The team stopped calling it end to end. They started calling it in scope.

Sam noticed the shift in the room the next time an agent proposal came up. Someone new pitched a summarization agent for weekly business reviews. Before Sam could ask, the product manager stopped them and said, "What is the decision, and who owns it."

That was the moment Sam knew the principle had taken.

A task can be automated by anyone. A decision has to be handed over on purpose.
