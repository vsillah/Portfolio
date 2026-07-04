## Chapter 20: Slack Is The Unblock Lane

The message arrived while Sam was standing in line for coffee.

A soccer game was letting out two blocks over. A kid on a scooter almost clipped Sam's ankle. The phone buzzed twice, then once more. Sam pulled it out expecting a text from a friend.

It was Slack. The message came from `#agent-approvals`.

> Route ready for review. Client: Northshore. Draft type: pricing memo. Confidence: high. Risk: medium. Approve or send back? [Open run]

Below the message sat two buttons and a link. The buttons said `Approve` and `Send Back`. The link said `Open run trace`.

Six months ago Sam would have opened the laptop. Six months ago Sam would have asked the agent to wait. Six months ago the small pressure of a decision living on the wrong screen at the wrong time would have stalled the team for an afternoon out of caution.

Sam tapped `Open run trace`.

The trace loaded fast. It showed the memory the agent had used, the price benchmarks it had pulled, the internal policies it had cross-checked, the earlier draft the client had accepted, and how this new draft differed. It showed the analyst who had already reviewed it, and the reason for the flag: one figure sat near a policy edge, and the client's contract was near renewal.

Sam read for a short stretch. Then Sam tapped `Approve`, dropped the phone back into a pocket, and stepped forward in the coffee line.

That night, Sam sat at the kitchen table with a glass of water and wrote a sentence in the notebook: `The phone is for unblocking the company, not running it.`

### The problem hiding in that moment

For months the team had been asking a version of the same question, sometimes politely and sometimes not. `Can we get a mobile version?` Every time, Sam had said no.

The nervousness was reasonable. Mobile is where humans are most distracted, most likely to swipe by accident, most trusting of the summary they can see, least likely to read a full trace before deciding. Mobile is where fatigue lives. Mobile is where a person taps `Approve` while carrying groceries. Any operating system that puts real authority on that surface is asking for the day it gets abused.

Saying no forever had a cost too. Approvals piled up overnight and after hours, because Sam and the leads and the reviewers were living human lives. Agents did the preparation, then the queue waited on a laptop being reopened. Agents were fast. Humans were the bottleneck. Tolerable when the queue was small. Corrosive as the queue grew.

The team had quietly started routing real work through direct messages to Sam. Screenshots. `Hey, can I just push this one?` The system was leaking. The leak was going into chat because chat was where people already were.

If chat was where the leak was going, then chat was the surface that needed rules. Fighting the surface would not work. Governing it might.

### The upgraded principle

Chapter 7 of "Accelerated," "Discovery - From Feedback to Signal," taught that teams build trust by responding quickly to real evidence. "Agentified" upgrades that principle without breaking it. [A1]

Responsive communication becomes bounded authority windows.

A bounded authority window is a decision the cockpit has pre-shaped to be safe on a small screen. The evidence has been gathered. The trace is linked. The scope of the yes is limited. The scope of the no is understood. The reviewer has already reviewed, or the policy has already been checked, or the confidence gate has already been passed. What is left to a human is the small human piece: is this the right call.

On mobile, Sam is not the analyst. Sam is the person who says ship or hold on a decision that has already been shaped. Anything not shaped that way does not belong on the phone.

### Mobile review without bypass

Mobile should stay a review surface, with the cockpit holding control.

On the phone you should be able to see status, receive a routed decision, open the trace, approve or return inside a scope the cockpit has already defined, escalate to a teammate, and leave a comment the trace picks up.

On the phone, the dangerous actions stay out of reach: promoting memory, changing policy, spending outside a preset limit, publishing externally without a second gate, overriding a safety flag, or taking any action a laptop would have required a longer path for. If the cockpit protects an action with two gates, the phone gets two gates. A smaller screen does not earn a shortcut.

Every approval taken on mobile links back to a trace that lives on the cockpit. There is no mobile-only decision. Every yes on the phone leaves a receipt in the same record system as every yes at the desk. When Sam approved the pricing memo in the coffee line, the trace already held the reviewer, the memory, the sources, and the confidence gates. Sam added a timestamp, an identity, and a one-tap decision. The trace absorbed all of it and moved on.

### The Unblock Ladder

The framework Sam wrote in the notebook that night is the one the team started using the following week. The Unblock Ladder sorts every agent message by how much authority the human in the loop is being asked to spend. Four rungs.

`auto-run`. The agent does the work, records the trace, and posts a short status line. The channel is the record, not the request. No human tap is needed. Reserved for repeated, low-risk, reversible work with strong confidence and clean memory.

`notify`. The agent has done the work, and something in the trace is worth a human glance. Maybe confidence dropped. Maybe a source was new. Maybe the client is sensitive. The message is informational and links to the trace. No approval is asked for, but a human can intervene. This rung protects against silent drift.

`ask`. The agent has prepared the work and reached a gate. A human decision is required before the work moves. The message is short. The link is direct. The scope of the yes is clearly stated. The reviewer name, if any, is shown. This rung is where most bounded authority windows live.

`escalate`. The agent has hit something outside its authority or outside a reviewer's authority. The message names the person or role who has to decide. The scope is explicit. The clock is visible. This rung keeps a phone tap from becoming a substitute for a hard conversation.

Any message that does not fit one of those four rungs is noise. Noise is the enemy of the ladder. Every week, someone owned the ladder audit. Messages tagged `ask` that should have been `auto-run` were downgraded. Messages tagged `auto-run` that should have been `ask` were promoted. Noise triggers were turned off. The ladder was a living thing.

### Portfolio proof

The team's Slack workspace ran on a small set of commands that all pointed back to the cockpit.

`/status` returned a short summary of active runs, blocked runs, and runs waiting on a human.

`/inbox` returned the caller's Agent Inbox: routed decisions currently sitting on their name, with links back to the run detail in Mission Control.

`/route` let a reviewer hand a decision to another reviewer, with a note, without leaving chat.

`/brief` returned the short brief version of a run trace: memory used, confidence, sources, reviewer, and recommended action, in a card small enough to read on the walk from the parking lot to the office.

`/standup` posted the team's morning summary: what agents ran overnight, what escalations were open, what was waiting on approval, and what memory had been promoted.

Every card had one link at the bottom. `Open run trace`. The link opened Mission Control. Mission Control was the record. Slack was the doorway.

Open Brain sat behind all of it. Memory promotions never happened from Slack. They happened in Open Brain, at a desk, with the full context on the screen. Slack could notify, route, and ask. Slack could not promote a memory into the shared brain. That gate stayed on the cockpit, on purpose.

### The reader exercise

Open the channel you use for agent messages. Pick last week. Go message by message, and mark each one as one of three things.

`decision` if you took an action from the message, or if the message required an action from someone.

`FYI` if the message informed a state but no action was taken or required.

`noise` if the message was neither, or a repeat, a stray log, something you scrolled past because you already knew.

Count each pile.

If `noise` is the largest, the channel is a firehose and the ladder is not being enforced. If `FYI` is much larger than `decision`, the channel is tuned for reassurance rather than authority. If `decision` is largest but the traces are thin, the cockpit has not done the heavy lifting yet, and mobile is carrying weight it should not carry.

The healthy shape is a small `decision` pile with rich traces, a moderate `FYI` pile with clear triggers, and a `noise` pile that shrinks every week because the audit is real.

### Closing principle

Chat is warm. Chat is where the team already is. Chat is where humans are most willing to reply. If mobile becomes the surface that feels the most alive, mobile becomes the surface people treat as the operating system. That is the day the leak stops being small.

Slack is the unblock lane. It is where the queue breathes. It is where a human can say ship or hold from a coffee line, a sideline, a hallway, because the cockpit has already done the shaping. The cockpit stays at the desk, where the traces are full, the memory is legible, the gates are visible, and the decisions are slow enough to be honest.

Use the phone to unblock the company. Keep the company itself in the cockpit.

What is the smallest decision you would trust yourself to make from a phone? Start there. Ship only that.
