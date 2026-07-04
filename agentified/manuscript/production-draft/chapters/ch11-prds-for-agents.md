## Chapter 11: PRDs For Agents

On Monday morning, the agent shipped exactly what the PRD asked for.

Sam read the output twice. Once on his phone at the counter. Once on the laptop in the office. It was a customer summary email for a mid-cycle account review. The subject line was clean. The tone was measured. The facts inside were technically defensible. Usage numbers, adoption trends, three recommended next steps.

It was also, in every practical sense, wrong.

The account was not up for review. The customer had asked for something different two weeks earlier, and the CRM held that request in plain view. The recommendations pointed at features the customer had already declined. The tone was warm to someone who had raised a billing dispute. Nothing in the email was a lie. Everything about it was misaligned.

Sam killed the send from the Agent Inbox and sat with the failure.

The PRD had been human-shaped. Written for a person. Meant to be interpreted by a person. Guarded by the reader's judgment. It said things like "understand the account context" and "recommend appropriate next steps" and "match the customer's current relationship." A human account manager would have read that, walked to the CRM, spoken to the rep who owned the relationship, checked the billing thread, and produced something reasonable. The agent did not walk anywhere. It read the PRD, took it literally, and delivered what a literal reading demanded.

The failure was not the agent. The failure was the contract.

*

Chapter 9 of "Accelerated," "From Doc to Dev - Writing PRDs that don't Drift," taught teams that requirements written on Monday do not survive contact with reality by Friday. The fix was small and portable. Keep the outcome fixed. Let the execution flex. Revisit when the world moved. [A1]

That lesson holds when the executor is a human product manager who can ask a question in Slack when confused.

When the executor is an agent, the same drift becomes silent and expensive. The agent does not raise a hand. It does not walk to the CRM unless the CRM is inside its scope. It does not ask the billing team unless someone told it to. Confusion, for an agent, does not look like a question. It looks like confident output that misses the point.

PRDs that did not drift for humans have to become contracts that do not drift for machines.

*

The upgrade is structure.

An agent needs what a new engineer needs on their first day, only written down without ambiguity. What are we trying to accomplish. What is inside the fence, and what is outside. What data can I trust. How will I know I am done. What do I do when I am stuck. Who owns the outcome. What happens if I get it wrong.

Sam pulled up the failed PRD and started again.

The rewrite took forty minutes. When it was done, the document did not look like a PRD in the old shape. It looked like a packet.

**Outcome.** One sentence. A customer relationship email that reflects the account's current posture and lands within a specific tone band. Not a summary. Not a check-in. A response.

**Scope fences.** What the agent may touch. CRM notes, billing status, the last thirty days of support threads, the account plan. What the agent may not touch. Marketing lists, engineering backlogs, executive briefings, any account outside the assigned segment.

**Input manifest.** The exact sources the agent should read before drafting. Not "the CRM," but the specific views, the specific fields, the specific timestamps that count as current. If a source is missing, the agent stops rather than guesses.

**Acceptance tests.** Three of them, written as checks the agent must run against its own draft. Does the email reference the customer's most recent request? Does the tone match the account's current risk band? Are the recommendations consistent with previously declined features? These are conditions the agent evaluates and reports on before it hands the draft to a human.

**Escalation.** What triggers a stop. A billing dispute in the last fourteen days. A support thread flagged red. A missing CRM record. Any of these, and the agent does not draft. It routes the work to a person with a note explaining what it saw.

**Owner.** A named account manager. Not a role. Not a team inbox. A person who signs off on the send, and whose name goes on the trace record if something breaks.

**Reversal.** What undo looks like. For an email, the reversal is a follow-up correction from the same owner within two hours, with a template already drafted. For a data write, it would be a rollback path. Reversal is planned before the send, not scrambled after.

Seven fields. Roughly a page. Enough for the agent to act with confidence. Enough for a human to catch a bad output before it reached a customer.

*

Sam ran the new packet through the same agent an hour later. The draft came back with a different shape. It referenced the recent request. It softened around the billing thread. It skipped the declined feature. Underneath the draft, in a validation summary the agent produced automatically, three lines reported which acceptance tests had passed and which had not.

One test failed. The tone band the packet asked for and the tone band the account risk score suggested were slightly out of alignment. The agent flagged it. Held the send. Routed the draft to the account owner with a short explanation.

The owner approved with a small edit. The email went out. The trace record showed every source consulted, every check run, and every hand the draft passed through before it left the building.

The agent had drafted. The human had approved. The PRD had become a contract. The contract had produced a trace. The trace had produced trust.

*

Inside Portfolio, this shape has a name. The team calls it an agentic PRD pack. Content agents run against them. UI seeding agents run against them. Work-item fields in Mission Control map to the seven pieces so any packet, in any queue, can be read by a human or a machine without translation. Validation summaries attach to every completed item, so approval becomes a review of evidence rather than a review of vibes.

The shape holds beyond content and UI. An agent that reconciles invoices needs a packet. An agent that drafts sales replies needs a packet. An agent that summarizes engineering incidents needs a packet. The seven fields do not change. The specifics do.

What changes is the writer's discipline. Writing an agentic packet forces the author to know what they actually want, what data actually exists, and what failure actually looks like. Most legacy PRDs fail this test on their first line.

*

Try this. Pick one PRD, brief, or ticket you wrote in the last month. Rewrite it in under four hundred words, using the seven fields. Outcome. Scope fences. Input manifest. Acceptance tests. Escalation. Owner. Reversal.

If you struggle with acceptance tests, that is a signal. It means the original document was leaning on the reader's judgment to define done. A human could have carried that weight. An agent cannot.

If you struggle with reversal, that is a bigger signal. It means the original document did not consider what happens when the work is wrong. A human would shrug and clean up. An agent will produce ten of the wrong thing before anyone notices.

Write the packet. Feel where your old PRDs were leaning on you. Notice how much of the specification you kept in your head, unwritten, because you assumed you would be in the room.

*

If the PRD requires you in the room, is it a spec, or is it a dependency?

The old PRD was a starting point for a conversation. The new one has to be a contract for work that will happen whether you are watching or not. Not because the agent is trusted to act alone. Because the packet, the tests, the escalation path, the named owner, and the reversal are trusted to catch what the agent misses. The human still approves the send. The contract makes that approval fast.

Write it that way, and the work becomes portable.

Write it any other way, and you are the bottleneck the packet was supposed to remove.
