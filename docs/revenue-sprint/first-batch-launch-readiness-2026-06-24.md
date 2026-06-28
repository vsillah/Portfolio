# Revenue sprint first-batch launch readiness

Prepared: 2026-06-24
Scope: prepare-only first batch. No customer-facing messages were sent.

## Current gate

Do not send the batch without explicit approval. `WF-GDR: Gmail Draft Reply` has now passed the reply-draft approval smoke for a synthetic known lead.

Known workflow state:

| Gate | Status | Evidence |
| --- | --- | --- |
| Customer-facing sender | Pass | `WF-CLG-003` smoke sent from `Vambah Sillah <vambah@amadutown.com>`. |
| Reply tracking | Pass | `WF-CLG-004` execution `18294` marked the controlled outreach row replied and posted alerts. |
| Draft reply and approval alert | Pass | `WF-GDR` execution `18312` stored the app draft, created the Gmail draft, and posted the revenue reply approval alert. See `docs/revenue-sprint/wf-gdr-reply-draft-gate-2026-06-24.md`. |
| No send without approval | Required | No external reply should send unless Vambah says `safe to send`. The passing smoke created drafts and alerts only. |

Decision: Jeanine is now the first approval-ready test send. The remaining contacts stay queued until the Jeanine reply confirms that the reply alert, draft, modification, and approval loop are working from `vambah@amadutown.com`.

## Contact verification

The production CRM was checked by exact name/company match. Recipient addresses are not repeated in this packet; use the CRM row ID or approved admin surface when creating the actual send.

| Candidate | Contact status | Notes |
| --- | --- | --- |
| Jeanine Achin / MentorRI test | Verified in CRM row `13740`; recipient email present; no phone; no do-not-contact flag. | Name spelling reconciled as Jeanine Achin. Use this only as the controlled MentorRI test. |
| Anna Berin | Verified in CRM row `13645`; recipient email present; recipient phone present; no do-not-contact flag. | Use warm prior-context language. Do not write this like cold outreach. |
| Kyle Peterson | Verified in CRM row `13661`; recipient email present; no phone; no do-not-contact flag. | Monomoy Advisors context is present. Treat as warm, not a scraped cold lead. |
| MentorRI-adjacent operations contact | Missing named recipient. | CRM search only confirmed Jeanine as the MentorRI contact. Use Jeanine to identify the right owner or wait for a named contact. |
| Trusted professional-services referral path | Missing named recipient. | Keep as a referral-path slot until Vambah selects the person from contacts. |

Missing launch inputs:

- Approved Vambah phone number source of truth for signatures. Do not use a phone number from memory.
- Named MentorRI-adjacent operations contact, if we want a send separate from Jeanine.
- Named trusted professional-services contact, if we want this to be a real first-batch email rather than a reusable referral-path draft.
- Explicit approval to send the Jeanine test from `vambah@amadutown.com`.

## Batch table

| Send order | Contact | Warmth | Why this contact | Relationship context | Non-creepy personalization | Risk / confidence | Channel |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Jeanine Achin | Very warm test | Safe board-context recipient for testing the reply workflow before using it with outside prospects. | Mentor Rhode Island board context and existing AmaduTown work. | Name the test plainly so she knows this is workflow validation, not a surprise sales pitch. | Low relationship risk; high workflow value. Treat reply as smoke evidence, not demand signal. | Email from `vambah@amadutown.com`. |
| 2 | Anna Berin | Warm | Good fit for a light AI-ops read after prior context. | Prior MentorRI context exists. | Reference the prior conversation/context and ask whether a small operational read would be useful. | Medium: CRM source says event, but memory and prior notes indicate warmer context. Keep it human and specific. | Email from `vambah@amadutown.com`. |
| 3 | Kyle Peterson | Warm lead | Monomoy Advisors context makes this a useful early non-MentorRI test after Jeanine. | Prior Monomoy/warm-lead workflow context exists. | Ask whether he is seeing handoff, follow-up, or AI-workflow pressure with clients or portfolio companies. | Medium: stronger than cold, but still needs a small ask. | Email from `vambah@amadutown.com`; text only after Vambah confirms that channel is appropriate. |
| 4 | MentorRI-adjacent operations owner | Warm referral path | Useful if Jeanine points to the person closest to the workflow pain. | Shared mission and board context. | Ask for the right owner instead of pretending closeness. | Medium-low once named; currently not send-ready. | Forwardable email after named owner is confirmed. |
| 5 | Trusted professional-services contact | Warm referral path | Strong path for informal ACA-style referral asks. | Relationship-first. | Ask who they know who is buried in manual handoffs, not whether they want to buy. | Medium until a real person is selected. | Email or text, depending on relationship and approved contact channel. |

## Drafting rules in force

- First-name salutation.
- Sign with Vambah's name.
- Include AmaduTown Advisory Solutions.
- Include the AmaduTown website link.
- Include Vambah's phone only after an approved source of truth is confirmed.
- Jeanine test-header language is only for Jeanine.
- Anna must read like a warm follow-up.
- Keep the first ask small: a workflow read, a compare-notes conversation, or a referral to the right owner.

Signature block for this batch:

```text
Vambah Sillah
AmaduTown Advisory Solutions
AmaduTown Advisory Solutions helps mission-driven teams turn scattered work into governed AI workflows, reviewable handoffs, and measurable next steps.
https://amadutown.com
[approved phone number needed]
```

For HTML-capable sends, hyperlink the company line to `https://amadutown.com`.

## Draft 1: Jeanine test

Subject: FYI test: AmaduTown reply workflow

```text
Hi Jeanine,

FYI Jeanine, this is a test of the AmaduTown reply workflow before I use it with anyone else.

I'm tightening the process for how AmaduTown handles outreach replies. The goal is simple: when someone responds, the system should flag it, draft a follow-up, and wait for me to approve before anything goes out.

Since Mentor Rhode Island is already familiar ground, I wanted the first real-world test to stay inside a trusted context.

Would you be willing to reply with a sentence or two, even something simple like "got it" or "this makes sense," so I can confirm the reply alert and draft process works?

Thanks,

Vambah Sillah
AmaduTown Advisory Solutions
AmaduTown Advisory Solutions helps mission-driven teams turn scattered work into governed AI workflows, reviewable handoffs, and measurable next steps.
https://amadutown.com
[approved phone number needed]
```

Expected reply handling: treat any reply as workflow proof. Do not treat it as a sales signal.

## Draft 2: Anna Berin

Subject: Following up on the workflow side

```text
Hi Anna,

I was thinking about our prior MentorRI context and the way small teams often carry a lot of operational memory in people's heads, inboxes, and side documents.

That's the kind of problem AmaduTown has been building around: turning scattered work into simple, reviewable AI-supported workflows without adding another complicated system for the team to manage.

If useful, I could take a light look at one workflow where follow-up, intake, reporting, or handoffs are taking more time than they should. No heavy pitch. Just a practical read on whether there is a clear quick win.

Would it be worth comparing notes for 20 minutes?

Thanks,

Vambah Sillah
AmaduTown Advisory Solutions
AmaduTown Advisory Solutions helps mission-driven teams turn scattered work into governed AI workflows, reviewable handoffs, and measurable next steps.
https://amadutown.com
[approved phone number needed]
```

Expected reply handling: if she says yes, draft a short scheduling reply with two windows. If she names a pain point, draft a bounded workflow-read offer.

## Draft 3: Kyle Peterson

Subject: Quick question on messy handoffs

```text
Hi Kyle,

I had you on my list because of the Monomoy Advisors context, and I wanted to ask a small question instead of sending a big pitch.

Are you seeing teams get stuck where the work is not strategic enough to hire around, but still too important to leave in inboxes, spreadsheets, or one person's memory?

That's the lane I'm testing with AmaduTown Advisory Solutions: simple AI-supported workflows for follow-up, intake, reporting, and handoffs where the real value is making the next step obvious.

If that shows up with your clients or portfolio companies, I would be glad to compare notes and see whether there is a useful angle.

Thanks,

Vambah Sillah
AmaduTown Advisory Solutions
AmaduTown Advisory Solutions helps mission-driven teams turn scattered work into governed AI workflows, reviewable handoffs, and measurable next steps.
https://amadutown.com
[approved phone number needed]
```

Expected reply handling: if he names a pressure point, draft a concrete workflow-read follow-up. If he offers an introduction, draft a permissioned intro note.

## Draft 4: MentorRI-adjacent operations owner

Status: not send-ready until the recipient is named.

Subject: Finding the right owner for workflow cleanup

```text
Hi [First name],

Jeanine and I have been connected through Mentor Rhode Island, and I wanted to ask this in the right way.

I'm not sure whether you own this directly, but I'm looking for the person closest to the operational places where follow-up, intake, sponsor communication, reporting, or board prep can get scattered.

AmaduTown Advisory Solutions helps teams turn that kind of work into simple AI-supported workflows with clear review points, so the team gets time back without losing judgment or control.

If this sits with you, I would be glad to compare notes. If it sits with someone else, could you point me to the right person?

Thanks,

Vambah Sillah
AmaduTown Advisory Solutions
AmaduTown Advisory Solutions helps mission-driven teams turn scattered work into governed AI workflows, reviewable handoffs, and measurable next steps.
https://amadutown.com
[approved phone number needed]
```

Expected reply handling: if redirected, draft two forwardable sentences that make the handoff easy.

## Draft 5: trusted professional-services referral path

Status: reusable draft only. Not send-ready until Vambah selects the person and channel.

Subject: Quick referral question

```text
Hi [First name],

Quick question for you.

I'm testing a tighter AmaduTown offer around AI-supported workflow cleanup for teams that are growing, serving clients, or carrying too much work in inboxes and spreadsheets.

The best fit is someone who says, "We know the work matters, but the process is too scattered and follow-up depends on memory."

Is there anyone in your circle who comes to mind for that? I'm not asking for a hard intro right away. Even a name or category of person would help me sharpen the target.

Thanks,

Vambah Sillah
AmaduTown Advisory Solutions
AmaduTown Advisory Solutions helps mission-driven teams turn scattered work into governed AI workflows, reviewable handoffs, and measurable next steps.
https://amadutown.com
[approved phone number needed]
```

Expected reply handling: if they offer a name, draft a permissioned intro request before any outreach.

## Approval language

After `WF-GDR` passes:

```text
Approved: send Jeanine test from vambah@amadutown.com
```

After Jeanine replies and the draft/alert/no-send loop passes:

```text
Approved: send Anna and Kyle from vambah@amadutown.com
```

For placeholders, approval is not enough until missing recipient fields are filled:

```text
Approved: use [name] as the MentorRI-adjacent operations contact
Approved: use [name] as the trusted professional-services referral path contact
```

## Go / no-go

Go for Jeanine only when:

- `WF-GDR` creates the Gmail draft and approval alert on the controlled reply smoke.
- No reply is sent without `safe to send`.
- The Jeanine send uses CRM row `13740`.
- The sender is `vambah@amadutown.com`.
- Vambah approves the missing-phone handling, either by supplying the approved number or by sending without a phone line.

Go for Anna and Kyle only when:

- Jeanine reply-loop smoke passes.
- Vambah approves moving from test to first batch.
- Anna uses CRM row `13645`.
- Kyle uses CRM row `13661`.
- The final draft still uses first-name salutation and the AmaduTown signature.

No-go if:

- `WF-GDR` fails to produce a draft or alert.
- A workflow sends without `safe to send`.
- The sender or draft mailbox is not `vambah@amadutown.com`.
- The draft needs heavy rewriting before approval.
- Any recipient has a new do-not-contact, missing email, or unclear relationship context at send time.

## Roadmap status

Completed in this packet:

- Reconciled the five first-batch candidates.
- Verified Jeanine, Anna, and Kyle in production CRM without embedding private recipient addresses in the packet.
- Marked the two placeholder paths as not send-ready.
- Drafted approval-ready copy for the three named contacts and reusable copy for the two referral paths.
- Preserved the dependency on `WF-GDR` and the `safe to send` approval phrase.

Remaining next:

- Repair `WF-GDR` and confirm rerun proof.
- Decide whether to include a phone line in the signature after an approved source of truth is available.
- Send Jeanine first only after the gate passes.
- Use Jeanine's reply-loop proof to decide whether Anna and Kyle are safe to send next.
