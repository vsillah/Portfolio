## Chapter 9: The Permission Slip

The agent had drafted seven customer replies overnight and stopped.

Sam saw them in the Agent Inbox before the coffee finished brewing. Seven drafts, each tagged with a customer name, a case number, and a small yellow banner: *Prepared. Awaiting approval.* Three of the replies were better than what the support team would have written at seven in the morning. One had caught a billing error the customer had not mentioned but had clearly experienced. Another corrected a misunderstanding about the refund window without sounding like policy. The agent had done its job, and then it had stopped.

Sam pulled the trace on the case that mattered most, the partial refund reply. The agent had reached the point of preparing the send action and had paused. The reason field read: *Action requires human approval. Category: outbound customer communication involving financial adjustment.* No send. No draft published. A waiting card, patient as a librarian.

"Who wrote that rule?" Sam asked at standup.

Rae looked up from her laptop. Priya paused mid-sip. Marcus, who ran support operations, tilted his head like the question had been asked in a language he almost knew.

"The rule that stopped it," Sam said. "Financial-adjustment replies need human approval. Who wrote it? Where does it live?"

Rae opened her mouth. Closed it. Opened her project notes. "I think we agreed on that in the demo review last month. Marcus said any refund language should be reviewed."

"I said that in a meeting," Marcus said. "I didn't write it down."

"It's in the agent's system prompt," Priya offered. "I put it there when I set up the send tool. Something like, do not send replies involving refunds or credits without human approval."

Sam nodded slowly. "So the rule exists in a system prompt one of us wrote, based on a verbal agreement in a meeting last month, enforced by a runtime we have not audited, and understood by nobody in this room the same way."

Nobody argued.

The next artifact the team owed itself was not a better agent. It was a written permission slip.

---

The Move Fast to Discover section of the "Accelerated" course kit had taught Sam to move fast with better filters. Filters caught the wrong ideas before they consumed a quarter. That worked when the thing being filtered was a set of proposed experiments, each waiting for a human to press go. The default was inaction. The filter was a decision aid. [A2]

Agents flip that default. An agent will do the next reasonable action unless something stops it. Its resting state is motion. The operating rule has to upgrade with the same clarity the runtime demands.

Move fast inside written boundaries.

Not vague boundaries. Not culturally understood boundaries. Written ones. Boundaries a new engineer can read on the first day. Boundaries a lawyer can read without translation. Boundaries a runtime can enforce because they are specific enough to enforce.

A permission slip is what makes those boundaries real.

---

Sam sketched the shape on the whiteboard while the team watched.

**Permission Slip**

- **Scope**: what this agent is allowed to touch.
- **Ceiling**: the largest single action it can prepare without escalating.
- **Reversibility**: whether its actions can be undone, and by whom.
- **Escalation**: who approves what, and how the ask reaches them.
- **Expiry**: when this permission slip stops being valid on its own.

Five fields. Small enough to fit on an index card. Specific enough to enforce.

Rae wrote the first one out for the support agent.

> *Scope*: Draft replies to inbound customer support emails in the categories shipping, product usage, and account access.
> *Ceiling*: Prepare a reply of up to three hundred words with links only to help.company.com.
> *Reversibility*: Drafts are not sent. Only preparation is allowed. All preparations are logged in Open Brain with the customer thread ID.
> *Escalation*: Any reply mentioning refunds, credits, legal terms, or account termination goes to Marcus's queue. Any reply to a customer flagged as enterprise goes to the account manager for that customer.
> *Expiry*: This permission slip expires at the start of each quarter and requires a signed renewal from Marcus and Sam.

She read it back and looked up. "That was quick to write."

"That is the point," Sam said. "Small enough to write. Big enough to defend."

---

A permission slip is not a policy document. Policy documents are written to be filed. A permission slip is written to be enforced. The runtime has to know the rule. The approver has to know the rule. The agent has to know the rule. The auditor has to be able to see all three agreeing.

This is what least privilege looks like as a product feature.

In infrastructure, least privilege is a security discipline. A service gets the smallest set of credentials it needs to do its job. In an agentic operating system, least privilege is a product decision. An agent gets the smallest set of actions it needs to do its job, and the boundary is visible to the humans who will answer for it.

Portfolio makes this concrete. Every agent registered in the runtime has a capability inventory: a machine-readable list of tools, data sources, and actions the agent may use. When an agent tries to invoke something outside its inventory, the runtime refuses. The refusal generates an entry in the Agent Inbox as a permission-pending item, waiting for a human to grant, deny, or update the slip.

The Agent Inbox becomes the ledger where these pending items live. Not lost in Slack. Not buried in a meeting note. Sitting in a queue with a customer ID, a case ID, and a proposed action, waiting for a name and a timestamp.

Approval-required actions are declared up front, not discovered at the moment they are needed. Outbound customer communication involving money. External sends to any address not on the internal domain. Any write to a shared knowledge base. Any promotion of a memory record from draft to canonical. Any spend above a stated ceiling. Any action affecting a customer flagged as sensitive.

Each category has a name. Each name lives in the runtime policy. Each name maps to an approver. Each approver knows what it means to be the approver for that category, because the permission slip said so in writing.

---

Try this.

Pick one agent you are running or planning to run this quarter. Write its permission slip using the five fields above. Do not skip any of them. When you finish, hand the slip to someone outside your team, ideally someone in legal, security, or operations, and ask them one question: from this document, can you tell me what this agent is allowed to do?

If they cannot, the slip is not done.

Rewrite it until they can.

---

The risk this chapter is written against is the one Sam almost walked into. A verbal approval in a meeting. A rule that lives in a system prompt one engineer wrote. A boundary understood in three different ways by three people who all thought they agreed. When something goes wrong, and something will, the question in the review room will not be whether there was a rule. It will be where the rule was written, and who signed it.

Verbal approval that never becomes durable policy is the softest form of governance failure. It looks like alignment. It behaves like fog.

The permission slip is the artifact that turns the fog into a fence.

Define what an agent may do before you expand what it can do. Write it down. Sign it. Set an expiry. Route the escalations. Log the pending items in the Agent Inbox. Publish the capability inventory. Let the runtime enforce the boundary, and let the humans defend it.

What is the smallest agent action you would not want to defend in review?

Write the permission slip that keeps you from ever having to.
