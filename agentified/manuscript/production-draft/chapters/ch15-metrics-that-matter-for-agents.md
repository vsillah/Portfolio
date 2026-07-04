## Chapter 15: Metrics That Matter For Agents

The dashboard was beautiful. Sam had to concede that first, before saying anything else.

It filled the wall of the ops room in three neat columns. Runs per hour. Tokens consumed. Average latency. A green line climbing left to right with the confidence of a pitch deck. The design team had picked a soft teal for the background and a warm amber for the counters. It looked like progress.

The evaluation panels from the night before were still open on Sam's laptop. Rubric scores, source coverage, refusal counts. Real quality signal. The wall did not know any of it existed. The wall was still counting motion.

Priya walked in with her coffee, glanced at the room, and asked the question that opened it up.

"What changed for users this week?"

Nobody answered.

The agent had run four thousand times since Monday. It had drafted intake summaries, routed tickets, pre-filled contract fields, and prepared research briefs. The line climbed. The counters ticked. And when Priya asked her question, the room went quiet in the particular way rooms go quiet when everyone realizes they have been watching motion instead of consequence.

Sam looked at the wall for a long moment. Then he opened his notebook and drew a line down the middle of a page. On the left he wrote "agent is busy." On the right he wrote "user got something they needed." He turned the notebook so the team could see.

"This is our scorecard problem," he said. "The left side is easy to measure. The right side is what we are actually here for. Right now the wall only shows the left side."

Ade, who ran client operations, leaned forward. "The wall isn't wrong. It's answering the wrong question."

"Yes," Sam said. "A wall that answers the wrong question well is more dangerous than a wall that answers nothing at all. Because people trust it."

He walked to the whiteboard.

In Chapter 12 of "Accelerated," "The Metrics That Matter," the principle had been to pick the numbers that reflect real value and let everything else fall to the second tier. That principle had served the team well when the work was human. A designer shipped a feature. A support rep closed a ticket. A marketer sent a campaign. You could tie the number to the person and to the outcome without much argument. [A1]

Agents break that chain. An agent can produce a thousand outputs a day without anyone reading them. An agent can route work correctly ninety-nine times and cause a small disaster on the hundredth. An agent can look healthy while quietly drifting from what the business needs.

The principle had to grow up.

Sam wrote the upgrade across the top of the whiteboard.

**Metrics that grant or revoke authority.**

He underlined the last word twice.

"Every number we track for an agent should inform one of two decisions," he said. "Should a human let this agent keep doing what it is doing. Should a human give it more room, or take room back. If a number cannot inform either decision, it belongs in a log, not on a wall."

Priya nodded slowly. "So the dashboard is a permission slip."

"That is what it is."

Sam drew a ladder on the board. Seven rungs, bottom to top.

**Activity.** How often the agent runs. Useful for capacity and cost, dangerous when confused with value.

**Output.** What the agent produces per run. Drafts, routes, summaries, recommendations. Countable, still upstream of meaning.

**Quality.** How good the output is against a rubric. Grader scores, structural checks, source coverage. This is where evaluation starts to bite.

**Behavior.** Whether the agent stays inside its rails. Tool calls used, gates respected, refusals honored, retries handled. Behavior tells you the agent is trustworthy in motion, separately from whether the work was useful.

**Outcome.** What changes for the person on the other side. Time saved, decision made, error prevented, complaint avoided. This is the rung Priya was asking about.

**Learning.** Whether the agent improves over time on the outcomes that matter. A flat learning curve under a rising activity line is a warning, not a milestone.

**Authority.** The scope a human has granted the agent. What it may do without approval, what still needs a review, what remains off limits.

Sam stepped back. "Read it upward. If activity is high but quality is low, we know where to look. If quality is good but outcomes are flat, we have a targeting problem, not a model problem. If outcomes are strong but behavior is drifting, we have a governance problem hiding inside a success story. The rungs above cannot inherit trust from the rungs below."

Ade wrote the ladder into her notes without looking up. "So how do we build this from what we already have?"

Sam pulled up the Portfolio view on his laptop and mirrored it to the second screen.

Cost events were already flowing into the ledger. Every agent run produced a receipt that recorded tokens, tool calls, latency, and dollar cost. That gave the activity rung honest data. Agent Ops status, the panel the on-call team watched, tracked behavior: how often the agent hit its rails, how often it retried, how often a gate refused an action. Evaluation rubrics ran on a sample of outputs each night and produced quality scores against a rubric the team had written and approved. Client journey stage metrics carried the outcome layer, tied to whether the person the agent was helping actually moved forward.

The pieces existed. They were living in separate rooms.

"Our job this quarter," Sam said, "is to line them up against the ladder and put the ladder on the wall."

He sketched the shape next to the ladder. A single column, seven rows, one number per row, each with a small delta showing whether it was trending toward more authority or less. Below the column, three bands. Green: a human may consider granting the agent more scope. Yellow: hold current scope, investigate. Red: revoke scope until the rung recovers.

The bands were recommendations. A named person still had to sign.

"When the wall shows this," he said, "Priya's question stops being awkward. Anyone can walk up and see whether the agent should be allowed to keep doing what it is doing."

Priya smiled. "And if the outcome row is flat, no amount of green on the activity row saves us."

"Right."

Ade tapped her pen against the table. "What do we do with the current wall."

"Cross out every metric that does not lead to a decision. Then look at what is left."

She glanced up. Runs per hour. Tokens consumed. Average latency. Three counters, no consequences.

"We are going to lose our pretty colors."

"We are going to gain a wall we can defend."

The team broke into pairs to redraw the wall against the ladder. Sam took a moment at the window. He thought about the version of himself who would have loved that first dashboard, the version who mistook the rising green line for proof. It was a good instinct, wanting to see motion. It was a dangerous instinct if you let motion be the whole story.

Agents make that mistake easy. They generate activity the way a fountain generates water. If you point a counter at them, the counter climbs. The counter climbing is not the same as the world getting better.

The upgrade from Chapter 12 of "Accelerated," "The Metrics That Matter," was quiet but load-bearing. Metrics that mattered had been a filter against vanity. Metrics that grant or revoke authority were a governance instrument. They told a human when to widen an agent's room and when to narrow it. [A1]

He wrote one more line on the board before he left.

**A metric with no decision behind it is decoration.**

That became the rule they carried forward. Every rung had to name the decision it enabled and the human who would make it. Activity decisions were budget and capacity, owned by the ops lead. Quality decisions were rubric tuning and model choice, owned by the evaluation owner. Behavior decisions were rail changes and gate additions, owned by the platform team. Outcome decisions were expansion or retirement, owned by the product lead. Learning decisions were training data and prompt updates, owned by the agent owner. Authority decisions were the largest, and they always ended the same way: a named human, on the record, granting or revoking scope.

If a number could not name its decision and its decider, it came down.

## The reader's move

Open your current agent dashboard.

Cross out every metric that does not have a decision consequence written next to it. Not a vibes consequence. A real one: an action a named person will take, a scope that will change, a budget that will move, a rail that will tighten.

Look at what is left. That is your honest wall.

Then answer the question Priya asked Sam.

Which three numbers would you use to defend this agent's existence to someone who has never seen it run?

If your three numbers all sit on the activity rung, the agent is operating on borrowed authority.

If your three numbers reach outcome and learning, the agent has earned the room it currently has, and you have the receipts to argue for more.

The wall is a permission slip. A human signs it.
