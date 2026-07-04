## Chapter 16: Human Review Is The Trust Layer

The question came in the last five minutes of the quarterly review, the way important questions usually do. The head of operations for a client had been clicking through the agent trace deck. She stopped, leaned back, and asked when the agent would stop needing them. When could her team take their hands off.

Sam had been asked some version of that question in almost every room for a year. Some people asked it hoping for a yes. Some asked it hoping for a no. This one wanted to know what to tell her board.

Sam closed the laptop halfway so the screen would not be the loudest thing in the room.

"The agent will keep doing more of the work," Sam said. "That is already happening. What will not change is whose name is on the outcome. The signature stays human."

The client looked relieved and irritated at the same time. Relieved because she did not want to answer for something she had not seen. Irritated because she had been told, in other rooms, that the point of all this was to stop being the bottleneck.

Sam had used the bottleneck line too, in the earliest agent projects. It had felt clever at the time. It had also produced the wrong incentive. Teams began hiding review under a stack of dashboards and calling the pile a workflow. When something went wrong, no one could point at the moment a human had said yes. There was no yes. There was only motion.

That was the shift Sam had come to insist on, especially after the scorecards from the prior chapter's work made it obvious that "the agent is accurate enough" was the beginning of a conversation, not the end of one. Accuracy told you whether the work was good. Review told you whose name went on it.

Human review had been treated like friction for too long. In Sam's system, it carried the trust.

### Approval as headline

For a long time, Sam had introduced approval checkpoints the way a waiter apologizes for a slow kitchen. There is a review step here, so it will take a bit longer, sorry about that. Buyers heard the apology and marked review down as a cost. Internal teams heard it and treated review as a queue to clear.

The reframe was small and total. Sam stopped apologizing for review and started leading with it.

In the current pitch deck, the approval route had its own slide near the front, right after the problem statement. It was labeled Signature Path. It showed which humans owned which decisions and what tools they had to review before signing. The demo did not skip past the approval screen. The demo lingered there. Buyers stopped asking how fast the agent was and started asking how the reviewer would know whether the agent was right.

That was a better question. That was one worth answering.

### Authority before side effect

In Chapter 16 of "Accelerated," "Influence Before Impact," one of the load-bearing ideas was to do the research, shape the framing, and earn the room before you spend the room. It was a discipline for humans working with humans. [A1]

Agent work needed the same idea, pushed one layer deeper. The upgraded principle was authority before side effect. Before the system does something that touches the outside world, someone with authority has to have had the chance to see it, question it, and either sign it or stop it.

Side effect is the operative phrase. An agent can read, summarize, draft, tag, rank, and prepare all day without any authority gate, because none of that leaves a mark anyone else has to live with. The moment an agent moves money, sends a message to a customer, changes a shared record, or promotes something into memory that other agents will trust, that is a side effect. Side effects need signatures.

The gate belongs at the edge of the agent's reach.

### Side-effect gates

Sam's operating name for this in the design docs was side-effect gates. Every agent surface had a list of the actions it could take. Each action had a classification. Reversible internal actions were open. External sends, financial moves, memory promotions, and public commitments were gated. The gate was a specific human with a specific view.

A gate without a view was not a gate. It was a rubber stamp waiting to happen. That was the failure mode Sam watched for most closely. A reviewer with no context, no diff, no reasoning trace, and no easy stop button will approve everything, because approving is the path of least resistance. Rubber-stamp review is worse than no review. It launders bad output through a human name and destroys the trust the signature was supposed to create.

So every gate began with a practical question: what does the signer need to see before their name belongs on the outcome.

### Review postures

Once side-effect gates were named, the team needed a shared vocabulary for how a human sat next to an agent action. Sam settled on three review postures and started using them in every design review.

The first posture was pre-action review. The agent prepares the work and holds. Nothing happens outside the walls of the workspace until a human approves. This is the right posture for anything with a public signature: outbound customer messages, published content, invoices, legal filings, memory that other agents will treat as truth. The reviewer sees the draft, the reasoning, and the sources, and either signs or sends it back.

The second posture was bounded action. The agent is allowed to act inside a fenced range without asking, and every action inside the fence is logged. The fence has to be specific: this Slack channel, this label, this dollar amount, this file folder, this list of recipients. Outside the fence, the agent stops and asks. Bounded action is the posture that keeps agents useful without letting them wander. Most day-to-day agent work should live here.

The third posture was post-action audit. The agent acts, logs the action in a format a human can read, and a reviewer looks at a rolling batch on a cadence. This is the posture for high-volume, low-stakes work where pre-action review would kill throughput and bounded action is already in place. The audit is not decoration. It has to change behavior. If the audit finds a mistake, the fence tightens or the agent's authority is pulled.

Every agent Sam shipped now had a posture map. Each action was tagged with one of the three. When the team could not agree which posture an action belonged in, that was the sign the action was not designed yet.

### What the proof looks like

The Portfolio surfaces that carried this most visibly were the approval route in Mission Control, the run detail page where a reviewer could see every decision the agent made before its action, the social content approval flow that held drafts for a named human before anything went to a public account, and the Slack bounded actions where the agent could post in the working channel it had been scoped to but nowhere else without asking.

None of these were flashy. They were the plumbing that let a client leader tell her board, without flinching, that no agent output had reached a customer without a person who could name themselves for it. That sentence mattered more than the dashboard.

Sam had started asking every new engineer the same onboarding question. Pick any action the agent takes. Tell me who signs it and what they see. If they could not answer, the action was not ready to ship.

### An exercise for the reader

Open a document. On the left, list every action your agent can take without review. On the right, next to each one, write the failure sentence. The failure sentence is the one you would have to say out loud if that action went wrong in the worst way you can plausibly imagine.

Read the failure sentences. The ones that make you flinch are the actions that need a gate. Move them into pre-action review or bounded action, and design the view the reviewer will use. The ones you can live with stay open, and you audit them on a cadence you write down.

The exercise is short. It is also the difference between an agent you can defend and an agent you cannot.

### The signature

The client leader who had asked the original question wrote to Sam later. She had run the failure sentence exercise with her team. Several actions moved into pre-action review. A few moved into bounded action with tighter fences. One got pulled entirely, because no one on the team was willing to sign for it and no one wanted to build the view that would let them.

She had used the phrase Signature Path with her board. It had held. The board's concern had been about accountability all along, and once accountability had a diagram, the rest of the conversation became about scope.

Sam closed the note and wrote the principle on the whiteboard, where every visitor to the studio would see it that quarter.

Whose name is on the outcome, and do they have the tools to review?

If you cannot answer both halves of that question for every action your agent takes, you do not have an agent yet. You have a liability with a chat interface. Trust lives with the human who signs, and with the view that lets them sign honestly.
