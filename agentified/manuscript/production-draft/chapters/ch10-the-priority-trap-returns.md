## Chapter 10: The Priority Trap Returns

Sam opened Agent Inbox on Tuesday morning and felt something familiar under the ribs. Not panic. Recognition.

The board had more active items than the team could honestly defend. Sam counted twice. Some had no listed owner. Some were labeled `pilot` with dates from several planning cycles back. Others were tagged `awaiting approval` with no approver in the routing field. A few agents that had been retired in a governance export were still posting drafts into a shared queue through a scheduled trigger nobody had killed.

The rest looked healthy at first glance. Sam clicked into a marketing summary agent with a green run history. It had been drafting daily competitive briefings for months. Sam scrolled the audit trail. The last human read was far enough back to settle the question. The agent was writing to nobody, on schedule, with receipts, with memory, with a trace record clean enough to survive an audit.

Sam sat back.

This was the priority trap. The old one, in a new coat.

The old version looked like a Jira board bloated with tickets nobody would pick up, urgent labels that meant nothing, a roadmap that was really a graveyard with better lighting. The lesson had been simple. Urgency is loud, value is quieter. Teams chased the loud thing and starved the quiet one.

The new version was worse in one specific way. Agent output looked finished. A stalled human ticket at least admitted it was stalled. A stalled agent kept producing. It kept writing summaries. It kept preparing packets. It kept generating recommendations. Every artifact carried the same polish as the ones actually being used. From ten feet away, a dead agent and a load-bearing agent looked identical.

Sam had spent months building the trust layer. Approval gates. Memory rules. Trace records. Agent Inbox as the single surface for prepared work. All of it was working. And it was quietly hiding a portfolio problem.

Sam wrote one line on a sticky note and put it on the monitor. `The receipts are not the point. The work is the point.`

Then Sam did the harder thing. Sam retired three agents before adding any new ones to the queue.

The first was the competitive briefing agent. Memory archived. The scheduled trigger deleted, not paused. A paused trigger is a resurrection story waiting for a Friday afternoon.

The second was a client sentiment scorer a partner team had built during a workshop and never wired into any decision. It scored. Nobody read the scores. Nobody had ever approved a threshold. It was writing into a spreadsheet no dashboard queried. Retired.

The third was harder. It was a research digest agent Sam had personally sponsored. It was well-built. Clean memory schema. Tidy routing. Sam had told two directors it was a proof point. It had produced one useful insight in six months, and that insight had come from a human reading the raw source, not the digest. Retired. Sam wrote the sunset note in the governance export and moved on.

The board got smaller in one sitting. Nothing broke. A few Slack messages came in later that week asking where the briefings had gone. Sam answered honestly. Nobody had been reading them. The replies were quiet and telling: fair.

That is the tell. When you retire something and the only reaction is `fair`, it was theater.

Sam wrote the principle in the operating notes that afternoon. Agent packets can make low-value work look polished. Polish is not proof. Traffic is not proof. A clean trace record on work nobody uses is a receipt for waste.

The discipline that follows is agent portfolio management. Not agent building. Not agent governance. Portfolio. The same discipline a good product leader applies to features and squads has to be applied to agents, and it has to be applied on a recurring cadence, because agents are cheaper to spin up than features and rot faster than roadmaps.

The tool Sam started running the following month was the Quarterly Cull. Three tests, applied to every agent and automation in the portfolio, every quarter, without exception.

Test one. Proof delivered. Point to a decision, an artifact, a customer outcome, a revenue movement, a resolved ticket, or a documented time saving this agent produced in the last quarter. Not the last year. Not at launch. Last quarter. If the answer is a shrug, a maybe, or a story about potential, the agent fails the test.

Test two. Permission current. Every agent operates under a permission set. Memory access. Tool access. Data access. Audience. Approval routing. Permissions granted six months ago under one org structure or one compliance posture may no longer be defensible. Ask the question plainly. If we were granting this permission today, from scratch, with what we know now, would we grant it. If not, the agent gets narrowed or retired. Renewed permission is never automatic.

Test three. Would we build it again. This is the founder question in miniature. If this agent did not exist and someone proposed it in Agent Inbox tomorrow as a new work item, would it clear the bar. Would it get an owner. Would it get an approver. Would it earn budget for its memory footprint and its evaluation cost. If the honest answer is no, the agent is living on inertia, and inertia is the priority trap wearing a hoodie.

An agent has to pass all three tests to stay in the portfolio. Two out of three is not a passing grade. Two out of three is how you end up with a fleet of well-governed, well-permissioned agents producing polished nothing.

Retirement itself is a human decision. The Quarterly Cull prepares the packet. The agent portfolio can flag items that fail proof, surface owners and approvers, and draft the sunset note. It cannot pull the trigger. An owner has to sign. The permission revocation, the memory archive, the trigger deletion, the entry in the governance export, all of it goes through the same approval discipline as any consequential change. Retirement is consequential. Treat it that way.

In the Portfolio operating pattern this shows up in a few places. Agent Inbox is where prepared work lives, and the work queue makes stale items visible when they age past their expected review window. Mobile App Foundry scoring pushes every proposed work item through a `value`, `cost`, `risk`, `owner`, `approver` rubric before it earns a slot in the fleet, which keeps intake tight. Proposed work items sit in a candidate state until an owner and an approver sign, so nothing enters the running portfolio without a human who has agreed to be accountable. The Quarterly Cull closes the loop at the other end by clearing out what intake let through and reality did not vindicate.

Try the exercise. Do not delegate it to an agent. Open a document. List every agent, automation, scheduled job, memory-backed workflow, and prepared packet in your operating stack. Include the ones you personally sponsored. Include the ones you are quietly proud of. Beside each one write three characters. `P` if there is proof delivered this quarter. `A` if there is a current owner and approver. `B` if you would build it again today. Any item without all three characters gets a sunset date within the next two weeks. Not paused. Sunset. Written down. Communicated. Executed.

You will notice something while doing this. The urge to defend. The story that starts forming about why a particular agent deserves another quarter. That urge is the priority trap talking. Every quarter you defend an item on story instead of proof, you teach your operating system that story is enough. The next quarter it will be harder to cull anything, because story compounds.

Name the specific risk before closing. Sunset by neglect. It is tempting to let unused agents drift into disuse rather than formally retire them. This is dangerous. A neglected agent still holds permissions. It still touches memory. It still has a tool footprint. It still exists in the trace surface. It can still be triggered by a schedule, a webhook, or a teammate who does not know it is dormant. Neglect is not retirement. Retirement is an action. Revoke the permissions. Archive the memory. Delete the triggers. Write the sunset note into the governance export. If the agent needs to come back, it should come back through intake, with a fresh owner and a fresh approval, the same way a new one would.

The organizations that will do well in the agent decade are not the ones with the largest fleets. They are the ones with the cleanest fleets. Every running agent has a person willing to say, in public, I own this, it is delivering, and I would build it again.

Sam closed Agent Inbox that Tuesday with a smaller board and a lighter feeling in the chest. Not because less work was being done. Because the work being done was work someone had chosen, on purpose, this quarter.

Read the sticky note as if a board is asking tomorrow. Which agent would you cut before defending the whole portfolio.

If you cannot answer, you do not have a portfolio. You have a backlog with better packaging.
