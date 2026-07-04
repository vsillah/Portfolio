## Chapter 2: Agents Need Jobs Not Vibes

Receipts told Sam what an agent had done. They did not answer a harder question. A teammate cornered Sam in the kitchen on a Tuesday, two coffees in, and asked it out loud.

"What does the scheduling agent actually own?"

Sam started to answer. The scheduling agent could read the shared calendar, draft invites, suggest times across three time zones, and route conflicts to a human. It could pull attendee availability from the connected accounts. It could flag double-bookings before they hardened. It could send confirmations once approved.

The teammate waited through all of that and asked the question again.

"Right. But what does it own?"

Sam set the coffee down.

The list Sam had recited was a list of capabilities. The teammate was asking about accountability. Those are different things, and Sam knew it before the second sip.

The scheduling agent could do a dozen things. Nobody in the company could name the one job it was hired for. Nobody could name its manager. Nobody could say, with a straight face, what would count as the agent doing its job well this quarter and what would count as it failing.

It had tools. It did not have a role.

Sam walked back to the desk and opened the internal doc that described the scheduling agent. It read like a product spec. Features, integrations, model choice, guardrails, prompt structure. It did not read like a job description. If a new hire had walked in with that document as their offer letter, they would have quit before lunch.

That was the pattern. The team had been onboarding agents the way you onboard software. Software does not need a manager. Employees do. Agents sit somewhere between the two, and the team had defaulted to the easier framing.

In Chapter 19 of "Accelerated," "To Jobs from Noise (ClientQ)," Sam had spent a long chapter on the idea that users hire products to make progress in their lives. You do not design for features. You design for the job the user is trying to finish. That framing had reshaped discovery, briefs, and how a launch got measured. [A1]

The upgrade was staring at Sam from the kitchen conversation.

Jobs-to-be-Done did not stop at users. It applied to agents now. Every agent in the stack was being hired by the organization to make some kind of progress. If the organization could not describe that progress in plain language, the agent was not really employed. It was loitering with credentials.

Sam opened a fresh doc and wrote a heading at the top: Agent JD.

Underneath it, seven fields.

**Job.** One sentence. What outcome this agent is accountable for producing. Not the tools it uses. Not the model it runs on. The outcome. "Keep the founder's external meeting calendar accurate, conflict-free, and confirmed one business day in advance." That is a job. "Uses a large model and connects to a calendar API" is not.

**Trigger.** What starts this agent's work. A new meeting request. A calendar change from an external party. A weekly review cycle. An agent without a trigger is a demo waiting for someone to click Run.

**Allowed inputs.** Which sources this agent may read from. The founder's calendar, yes. The private strategy doc, no. The team channel, public rooms only. Scope is where trust either gets earned or quietly leaks.

**Allowed outputs.** What this agent may produce, and where those outputs may land. Draft invites into the Agent Inbox for review. Never a sent message without human approval. Never a hold on an external attendee's calendar without a human gate. Outputs decide blast radius.

**Manager.** The human who is on the hook when this agent underperforms or misbehaves. Not a team. A person. Without a manager, there is no one to raise issues with, no one to authorize a scope change, no one to fire it. Every unmanaged agent is a slow-moving incident.

**Success metric.** How the manager decides, at the end of a review period, whether this agent is doing its job. Meetings confirmed on time. Conflicts caught before they became reschedules. Founder time protected against low-signal invites. Pick something you would put in a real performance review. If the metric is "it feels helpful," the agent will drift.

**Must never.** The forbidden actions. Never send an external message without a human approval. Never hold time on a partner's calendar. Never touch the founder's personal calendar. Teams skip this field most often. It is the one that saves the company.

Sam printed the template and pinned it above the monitor, then did the harder thing and started filling it in for every agent already running in the stack.

The scheduling agent got a JD. So did the content drafting agent, the customer follow-up agent, the release-notes agent, the incident triage agent, and the two research agents the growth team had spun up last month without telling anyone.

Three of them failed the exercise on the first field. Sam could not write a single-sentence job for them. They had been built because the tools were interesting. They had been kept because nobody wanted to argue about deleting them. They were doing a job nobody had hired them for.

Two of them shared the same manager, which was Sam. Which meant Sam was managing seven agents and had never scheduled a single review. The manager field surfaced a leadership gap the tooling had been hiding.

One of them, the release-notes agent, had no "must never" list. Weeks earlier it had drafted a customer-facing changelog that referenced the internal name of an unshipped feature. A human had caught it before publish. The catch had felt like luck. On paper, with a JD in place, the first line of "must never" would have been obvious: never reference features whose ship status is not confirmed in the release ledger.

The JD converts vibes into structure. It replaces "the agent is helpful" with "the agent is accountable for this specific progress, reporting to this specific person, within these specific bounds."

The Portfolio codebase already had the bones of this discipline. In `lib/agent-organization.ts`, agents were registered as named pods, each with a status field: active, partial, or planned. Active meant the pod had a live job, a manager, and approval gates wired in. Partial meant the job was defined but the guardrails were still under construction. Planned meant the role existed only on paper, and the runtime would refuse to issue credentials until the manager signed off.

Mission Control read from that file. Agents without a full JD did not appear as available for work. The Agent Inbox refused to accept drafts from a pod that had no manager. Approval gates were bound to the "must never" list, not to a vibe about what felt risky.

That was the point. The JD was not a document you wrote to feel organized. It was the contract that told the operating system which agents were employed and which ones were still interviewing.

Try it now.

Pick the agent you use most. Open a blank page. Write its one-sentence job. Name its trigger. List its allowed inputs and outputs. Name its manager. Write the metric you would use in its next review. Write three things it must never do.

If you cannot name its manager, the role is not ready. Take away its credentials until you can. An agent without a manager is not an employee. It is a liability with a login.

If you can name all seven fields cleanly, put the JD in the repo next to the code that runs it. Version it. Review it every quarter, the same way you would review a human's role. Agents drift. Jobs drift. The document is what keeps them honest.

Which of your agents is doing a job nobody hired it for?

Find that one first. Either write the JD, or turn it off. Both are fine. What is not fine is letting it keep running on the strength of a good demo.

An agent with tools and no job is a hobby. An agent with a job, a manager, a metric, and a list of things it must never do is a hire.

Hire on purpose.
