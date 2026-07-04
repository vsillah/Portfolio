## Chapter 14: The Evaluation Loop

The question came from the head of operations in a Slack thread that had been quiet all week.

"Is the agent getting better?"

Sam looked at the dashboard. Runs per day, up. Cost per run, down. Human overrides, roughly flat. Reviewer notes in the Agent Inbox had shifted from "wrong" to "close." Something felt like progress. Sam started typing a reply and stopped.

Every metric on the screen was a proxy. Usage was not quality. Cost was not quality. Overrides were quality of a kind, but only the overrides reviewers had bothered to file. The rest was a feeling. Weeks of watching outputs and calibrating a private sense of yeah, that is better than last month. A feeling was a thing Sam could not send to the head of operations. A feeling was not evidence.

Sam closed the draft reply and opened a new document.

The next permission request was already sitting in the queue. The drafting agent wanted authority to send certain low-risk emails without a reviewer sign-off. The pod lead had asked for it a week ago. The evidence attached was three anecdotes and a throughput chart. If a board member had asked Sam what proof supported that expansion, Sam would have said the same thing to the head of operations. Something felt like progress.

Something felt like progress was not how you promoted a person. It could not be how you promoted an agent.

Sam typed one line at the top of the document. Rubric first, permission second.

### Where the old principle stops working

The prior week's chapter of the operating map had solved the handoff problem. Every agent knew who it worked for, who its outputs went to, and where a human had to sign the last mile. Authority had a shape. What it did not have was a way to grow.

In Chapter 13 of "Accelerated," "The Learning Plan Framework," the promotion mechanism for a feature was explicit. Ship the small version, name what you would learn, name the metric that would tell you the answer, and commit in advance to what you would do at each threshold. Green meant expand. Yellow meant iterate. Red meant kill. The plan protected the team from confirmation bias, because the plan was written before the results came in. [A1]

Agents need the same mechanism, held to a stricter standard.

For a human feature, the learning plan lived beside the roadmap and got consulted in review. For an agent, the learning plan becomes the promotion gate. No gate pass, no new permission. Not more runs. Not a bigger budget. Not access to a new data source. Not authority to send without a reviewer. The gate is the contract between the agent and the operating system that governs it.

Agents do not get raises for tenure. They get raises for evidence.

### Evaluation before expanded permission

Sam wrote six words across the top of the whiteboard. Every permission upgrade is a promotion.

A promotion in a human company requires a review. Not a spreadsheet of activity. A review with samples of work, a rubric that says what good looks like, judges that include the person's manager and someone outside the reporting line, and a decision that gets written down. If any of those pieces are missing, the promotion is a favor.

Agent promotions had been favors. The pod lead thought the agent had earned it. Reviewers felt like overrides were dropping. Sam felt good about the trend. Nobody had written a rubric. Nobody had sampled. Nobody had produced evidence that would survive a hostile question from the head of operations.

Evaluation had to come first. Every time.

### The Evaluation Loop

Sam sketched four boxes in a row on the whiteboard. Capture. Judge. Sample. Decide.

**Capture.** Every run becomes a record, not a log line. The prompt the agent received, the sources it consulted, the draft it produced, the validation summary it attached, the human action that followed, the cost, the latency, the model version, the rubric version in force at the time. A run that is not captured with that shape cannot be evaluated later. It is exhaust, not evidence.

**Judge.** Every captured run gets scored against the current rubric. The rubric is short and named. Criterion, definition, pass or fail, weight. An LLM judge can score the volume, cheaply, at every run. That is where most teams stop, and it is where the trouble starts. A judge is a model. A model has taste it did not earn. Scoring at volume produces a number that looks like signal and is often the judge agreeing with the drafter because both were trained on the same internet.

**Sample.** A fraction of the judged runs, drawn on a rule, gets read by a human. Not the easy ones. Not the ones the LLM judge already flagged. A stratified sample across categories, including the boring middle, where drift lives. The human grades the sample against the same rubric. The comparison between human scores and LLM judge scores is its own signal. When they agree, the judge is calibrated. When they diverge, the judge is broken, and the number the dashboard has been reporting for a month is a lie.

**Decide.** At a set cadence, the loop produces a decision. Expand permission. Hold permission. Reduce permission. Kill the agent version and roll back to the previous one. The decision is written down, dated, and attached to the rubric version it was made against. When someone asks in six months why the agent has the authority it has, the answer is on the record.

Four boxes. That is the loop.

### What Portfolio enforces

Inside the operating system, this becomes a route.

Every run passes through a `run-evaluate` step before it clears. The LLM judge scores the run against the rubric version tagged in the agent's charter. The score, the rubric version, and the judge version are stored beside the trace. Budget checks run at the same step, so a promotion that would raise cost per run gets flagged against the pod's spend envelope before it lands.

The source validator sits earlier in the chain, at the intake edge, so a run cannot be judged good if its inputs were bad. A pristine draft built from a broken citation does not pass. The judge cannot rescue a run that arrived contaminated.

Rubrics are versioned like code. Every change is a commit. Every commit has an author and a reason. When a reviewer challenges a score, the exact rubric that produced it can be pulled up. When the head of operations asks whether the agent is better, the answer is a comparison of scores against a stable rubric across a stable sample, and the version history is there in case anyone wants to argue.

Drift assessment needs an original signal. Portfolio gave me that baseline. The agentic system could compare new outputs against the corpus that already carried my voice, my operating choices, my privacy boundaries, and my public commitments. If an agent started sounding generic, flattening the moral argument, skipping source discipline, or pushing private material toward public surfaces, the drift was visible. A polished answer was only the surface check. The harder question was whether the answer still belonged inside the operating system I had built.

The agent scores. The rubric judges. The human decides which permissions the score has bought. That last step is not delegable.

### The risk

The failure mode has a name in Sam's notes. Judge worship.

An LLM judge is convenient. It is fast. It is cheap. It is available when no human is awake. It can score a large volume of runs while a human sleeps. All of that is true, and none of it is a substitute for a human reading a real sample with the rubric in hand.

Judge worship is what happens when a team lets the LLM judge become the ground truth. The dashboard turns green. The samples stop. The rubric ossifies. The agent drifts in a direction the judge is blind to, because the judge shares blind spots with the drafter. Weeks later, a customer complaint or a regulator's letter surfaces a class of failure the dashboard has been quietly missing the whole time.

The rule that goes on the wall is short. LLM judges scale. Human sampling anchors. Neither one alone is the loop.

### Exercise

Pick one agent you own. Pull a small sample of its recent outputs, real ones if you can, safely selected samples if you cannot. Do not read them yet.

First, write the rubric. Four to six criteria. Each one with a definition a stranger could apply. Each one with a pass or fail rule, not a five point scale. Weight the criteria if some matter more than others.

Then grade the outputs by hand, against the rubric you wrote. Note where the rubric felt wrong, where a criterion was ambiguous, where you found yourself inventing a new criterion mid grade.

Rewrite the rubric. That is the one you version and put in front of the LLM judge next week.

If the exercise takes an afternoon, that is right. If it feels like too much work to do before granting a permission upgrade, that is the correct feeling. Promotions should be expensive to justify. That is the point.

### The closing principle

If the head of operations pings tomorrow and asks whether the agent got better, what would you show?

A graph of runs is activity. A graph of cost is efficiency. Your own confidence is a feeling.

The answer that holds up is a rubric, a sample, scores against a stable version, and a decision on record. The rest is theater, and theater will not survive a room full of skeptics.

Agents do not earn authority by working hard. They earn it by producing evidence a human can defend.

Rubric first. Permission second.
