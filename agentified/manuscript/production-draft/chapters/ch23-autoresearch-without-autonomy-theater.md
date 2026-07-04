## Chapter 23: AutoResearch Without Autonomy Theater

Sam opened Mission Control before coffee. Twelve AutoResearch proposals waited in the overnight queue. None had run.

He waited for the small drop of adrenaline that used to arrive when experiments launched themselves. It did not come. What arrived instead was quieter and more useful. He read the first proposal. A ranking tweak on the onboarding recommendations. Predicted lift, low single digits. Predicted risk to activation, low. Suggested audience, new mobile signups in a small set of regions. He read the second. A pricing page copy change. Predicted signal, weak. Suggested holdout, standard. He read the third. A model swap on the summary agent inside the Agent Inbox. Predicted quality shift, unclear. Suggested pause on send until human review.

Twelve proposals. Zero executions. The `not_run` column was full.

Six months ago that queue would have looked like failure. On this morning it looked like the system finally telling the truth about what it did and did not yet know. Sam wrote a short note to himself. Bring the queue to Monday review. Do not bring results. Bring proposals.

He thought about the version of himself that used to run experiments by the dozen and celebrate the count. Most of that motion had been noise wearing the costume of learning. Some had been underpowered. Some had contradicted each other, and no one had noticed until a quarterly review tried to reconcile the story. A few had shipped for reasons that, on inspection, had less to do with lift and more to do with whoever spoke last in the room. He had called that speed. He had a better word for it now. Turnover.

The operating principle he had carried out of the Move Fast to Discover section of the "Accelerated" course kit was simple. Move faster than your uncertainty. That principle had gotten teams unstuck. It had also, in some rooms, gotten teams addicted to running. On this Monday, in front of leadership, he wanted to state the upgrade out loud. [A2]

Action can move faster than learning. That was the trap.

He opened the review with the queue on the screen. No slide deck. No conclusions. Just twelve rows and a column called `not_run`.

Priya from operations leaned forward first. "What are we approving?"

"Nothing yet," Sam said. "I want us to look at what the agents wanted to do and did not do. I want to see the shape of our prior noise."

He walked them through three cards. The ranking tweak. The pricing copy. The model swap. For each one, he read the proposal aloud, then the reason the agent had chosen `not_run`. Insufficient power for the audience size. Overlaps a live test on the same surface. Missing an eval refresh that would let a reviewer trust the quality shift. The reasons were plain and cheap to write. That was the point.

Rafael from finance asked the question Sam had been waiting for. "So this queue is the work?"

"The queue is the work," Sam said. "The runs are the receipts."

He put the ladder on the screen next. He had been sitting with the shape of it for a month. Five states, in order, so that nothing could quietly skip a rung.

- `propose`. The agent writes a full research card. Hypothesis, audience, metric, guardrail, predicted signal, cost, rollback path. No card, no candidate.
- `not_run`. The card sits, unexecuted, with a reason. Missing power. Missing guardrail. Overlaps a live test. Conflicts with a memory rule. Requires an approval the agent does not have.
- `gate`. A named human reviewer, or a policy the organization has already ratified, checks the card against the current portfolio of active experiments and the current state of the product.
- `trace`. Whatever happens next, the card and its decision are written to Open Brain with a link back to Mission Control. Approvals, rejections, and quiet expirations are all first-class events.
- `approve` or `discard`. If approved, the experiment runs with the rollback path prewired. If discarded, the reason is captured in the trace so the next agent that considers the same idea inherits the answer.

The important word on the screen was `not_run`. It was a real state. Not a failure state. Not a holding pen. A recorded decision with a reason attached. If a team could not tell you why something had not run, the team did not have a research process. It had a launch process wearing a lab coat.

Model Ops AutoResearch had been the first place Sam trusted the pattern. When the summarization agent inside the Agent Inbox proposed a model swap, the card carried a predicted quality shift, a metric gate on human edit distance, and a rollback path that flipped a single flag in the routing config. The first `not_run` summary told him, in one paragraph, why the swap had been held. The eval set was stale. Refresh the eval set, and the card would return for review. That was the loop. Propose, hold, explain, refresh, revisit. Nothing about it was fast in the old sense. All of it was fast in the new sense. Each turn cut a piece of uncertainty that would otherwise have leaked into a live experiment and shown up later as an unexplained dip in a dashboard.

The metric gates were the second piece Sam kept pointing at. Every AutoResearch card carried a metric gate before it could reach `approve`. A guardrail metric with a threshold. A primary metric with an expected direction. A holdout definition with a size. If the agent could not fill those fields, the card stayed in `not_run` and the reason field named the missing piece. It was small governance, and it did most of the work.

The rollback paths were the third piece. A card without a rollback path did not reach `gate`. Sam had watched too many teams run experiments they could not cleanly reverse. An experiment you cannot reverse is a launch with extra steps. The rollback field on the card, one line pointing at a flag, a config, or a queue drain, was the difference between a research program and a slow-motion deploy.

Priya asked the question that mattered next. "Who approves?"

"Whoever owns the surface," Sam said. "Publishing changes go to the editor of the surface. Pricing goes to finance. Anything touching a client claim goes to the account owner. A gate needs a named human whose approval writes to the trace."

The room settled around that. A named human. Not a queue. Not a thread. A person whose name appeared in the record next to the decision, with a timestamp the agent could not edit.

Try this in your own operation this week. Pick a single workflow where an agent is drafting or recommending action today. Insert a `not_run` state between the agent's idea and the agent's action. Give the state one required field. A one-sentence reason and a link to the memory rule, the metric, or the missing approval that would let the card move forward. Do not build a portal. Do not staff a committee. Make the state exist, and route the cards to whoever owns the surface.

Watch what happens for a week. You will see the shape of your prior noise. You will see how many of the ideas your team was executing under the label of experimentation were closer to reflex. You will see the `not_run` reasons cluster into two or three root causes that are cheaper to fix than to keep working around.

The risk to avoid, the one that ate the last generation of experimentation programs, is calling planning evidence. A queue of proposals can look productive while teaching the team very little. A `not_run` reason records why the work held. A ladder gives the team honesty about the distance between an idea and a validated one, plus a governed path from one to the other. The agent proposes. The gate decides. The trace remembers. The rollback protects. Only after all of that does a number on a dashboard mean anything.

Sam closed the review with the question he wanted the team to sit with until next week.

If your agents only proposed for a week, and nothing ran, what would you learn about the experiments you had been running?

A proposal is a hypothesis with a rollback path. Evidence starts after the gate.
