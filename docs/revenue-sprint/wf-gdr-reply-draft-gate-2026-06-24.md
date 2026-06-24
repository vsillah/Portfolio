# WF-GDR reply-draft gate verification

Prepared: 2026-06-24
Decision: **No-go for Jeanine send approval**

## Summary

`WF-GDR: Gmail Draft Reply` ran on its 4-hour cadence at `2026-06-24T16:32:46Z` and n8n marked execution `18299` as successful, but the launch gate did not pass.

The workflow did not create a Gmail draft, did not create a Portfolio app draft, and did not post the revenue reply approval alert. It routed the controlled reply through the unknown-sender branch and sent an internal owner forward instead.

No customer-facing lead reply was sent. The workflow did send an internal forward to the owner address in the unknown-sender branch, which means `WF-GDR` is still not acceptable as the approval-gated reply loop for revenue outreach.

## Evidence checked

| Requirement | Result | Evidence |
| --- | --- | --- |
| `WF-GDR` latest run inspected | Pass | n8n execution `18299`, status `success`, started `2026-06-24T16:32:46.875Z`, stopped `2026-06-24T16:32:49.796Z`. |
| Controlled reply detected by Gmail trigger | Pass | `Gmail Trigger` output included message ID `19efa3e290afe789`, thread ID `19ef9d0d9700862a`, subject `Re: [Credential smoke] AmaduTown n8n Gmail sender verification`, to `vambah@amadutown.com`. |
| Sender extracted | Fail | `Extract Sender` output had blank `sender_email`, blank `sender_name`, and `(no subject)` even though the trigger output had uppercase `From` and `Subject` fields. |
| Client context fetched | Fail | `Fetch Client Context` returned `Credential with ID "9Au5oIQCDeIjLXZf" does not exist for type "httpHeaderAuth".` The node is configured with missing credential `App Ingest Secret`. |
| Known-client branch reached | Fail | `Is Known Client?` routed false because the context call returned an error rather than a known lead/client payload. |
| Portfolio app draft created | Fail | `Store Draft in App` did not execute in execution `18299`; production `client_update_drafts` had no rows created after `2026-06-24T16:20:00Z`. |
| Gmail draft created | Fail | `Create Gmail Draft` did not execute in execution `18299`; Gmail draft searches for the controlled smoke terms returned no matching drafts. |
| Revenue approval alert posted | Fail | `Revenue Reply Approval Alert` did not execute in execution `18299`. |
| Unknown-sender alert posted | Pass, but wrong branch | `Slack Unknown Sender` posted to channel `C0AFE8874LR` at timestamp `1782318769.689599`. |
| No customer-facing send | Pass for customer-facing reply | The known-client draft branch did not send. The only Gmail send evidence was `Forward to Owner`, an internal owner-forward path. |

## Root cause

There are two blocking issues.

First, the `Extract Sender` code only checks lowercase Gmail fields:

```text
message.from
message.subject
```

The active Gmail trigger output for execution `18299` used uppercase fields:

```text
From
Subject
To
```

That left `sender_email` blank, which would prevent a reliable context lookup even if credentials were working.

Second, the `Fetch Client Context` and `Store Draft in App` HTTP Request nodes use `httpHeaderAuth` credential ID `9Au5oIQCDeIjLXZf` named `App Ingest Secret`, but n8n reported that the credential does not exist. Because `Fetch Client Context` has `onError=continueRegularOutput`, the workflow did not fail hard. It continued to the unknown-sender branch and looked green at the execution level.

## Smallest safe fix

Do not send Jeanine yet. Patch `WF-GDR` first, then rerun a controlled reply smoke.

Recommended patch:

1. Update `Extract Sender` to read both uppercase and lowercase Gmail fields:
   - `from`, `From`, `headers.from`
   - `subject`, `Subject`, `headers.subject`
   - `to`, `To`, `headers.to`
2. Reattach or replace the missing `App Ingest Secret` credential on:
   - `Fetch Client Context`
   - `Store Draft in App`
3. Change `Fetch Client Context` handling so missing credentials or non-2xx context failures do not silently look successful.
4. Confirm `business_owner_email` routing separately. The current unknown-sender branch fetched the owner address as the personal Gmail mailbox. That is acceptable only for internal escalation, not for customer-facing identity.
5. Rerun a controlled reply smoke and require all known-client nodes to execute:
   - `Fetch Reply Prompt`
   - `Build LLM Input`
   - `Generate Draft Reply`
   - `Parse LLM Response`
   - `Store Draft in App`
   - `Create Gmail Draft`
   - `Revenue Reply Approval Alert`

## Jeanine approval state

Jeanine is **not approval-ready** yet.

The first-batch packet remains valid, but the send gate stays closed until `WF-GDR` proves the exact behavior required for replies:

- known reply matched to context,
- app draft created,
- Gmail draft created,
- owner approval alert posted,
- no customer-facing email sent without `safe to send`.

## Post-patch repair attempt

After approval, the live `WF-GDR` workflow was patched and retested without customer-facing outreach.

Patches applied:

- `Extract Sender` now reads uppercase Gmail trigger fields, lowercase fields, header payloads, and webhook-wrapped smoke payloads.
- The missing `App Ingest Secret` credential dependency was replaced with a variable-backed `Authorization` header on the Portfolio API calls.
- `Fetch Client Context` now fails closed instead of silently routing context errors into the unknown-sender path.
- `Build LLM Input` now accepts lead context returned under the Portfolio `project` object.
- A temporary webhook trigger was added only for controlled smoke testing and then removed.

Post-patch smoke evidence:

| Requirement | Result | Evidence |
| --- | --- | --- |
| Temporary smoke hook removed | Pass | The active workflow structure has no `Temporary Smoke Webhook` node after the test. |
| Sender extraction | Pass | Executions `18305` and `18306` both produced a sender, sender name, subject, message ID, and thread ID before the context lookup. |
| Portfolio API auth path | Pass | `Fetch Client Context` reached the deployed Portfolio endpoint with a hidden authorization header instead of failing on a missing n8n credential. |
| Known-client context lookup | Fail | Executions `18305` and `18306` both failed at `Fetch Client Context` with 404 responses from `https://amadutown.com/api/client-email-context`. |
| Synthetic lead lookup | Fail | A synthetic GDR smoke lead was inserted through the deployed ingest endpoint, but the deployed context endpoint still returned 404 for that same lead after a retry. |
| Gmail draft created | Not reached | The workflow stopped at `Fetch Client Context`; `Create Gmail Draft` did not execute. |
| App draft created | Not reached | The workflow stopped at `Fetch Client Context`; `Store Draft in App` did not execute. |
| Revenue approval alert posted | Not reached | The workflow stopped before the alert node. |
| Customer-facing outreach | Pass | No customer-facing reply was sent during the patch or smoke tests. |

New blocker:

`WF-GDR` is past the original sender-extraction and missing-credential failure, but the deployed Portfolio context lookup cannot resolve the tested contacts. That includes the internal owner mailbox, intended batch contacts, and a newly inserted synthetic smoke lead. This now looks like an app-side production lookup or data-source mismatch, not an n8n sender parsing problem.

Vercel runtime logs were not available through the connected Vercel app because the current authorization does not have access to the project scope, so the next repair step should start from the Portfolio route and production environment mapping.

## Next approval phrase

Completed after the Portfolio-side repair and final controlled smoke rerun.

Final repair notes:

- Deployed the Portfolio `client-email-context` route fix so production resolves current `contact_submissions` columns and treats zero-row project lookups as non-fatal.
- Deployed the direct draft-storage fix so `client_update_drafts` inserts no longer reference the unsupported `source` column.
- Patched `WF-GDR` `Create Gmail Draft` to read the stored app draft response shape from `draft.subject` and `draft.body`.
- Confirmed all temporary smoke webhooks were removed after testing.

Final smoke evidence:

| Requirement | Result | Evidence |
| --- | --- | --- |
| Production context lookup | Pass | `https://amadutown.com/api/client-email-context` returned `found: true` for the synthetic known lead after deployment. |
| App draft created | Pass | Execution `18312` reached `Store Draft in App`; prior execution `18311` proved the insert returns `success: true` and a stored `lead_followup` draft. |
| Gmail draft created | Pass | Execution `18312` reached `Create Gmail Draft` successfully. |
| Revenue approval alert posted | Pass | Execution `18312` posted the approval alert to Slack after Gmail draft creation. |
| Temporary smoke hook removed | Pass | Active workflow structure returned to 15 nodes with no `Temporary Smoke Webhook`. |
| Customer-facing send | Pass | The workflow created approval-held drafts and alert only; no customer-facing reply was sent. |

## Approval state

`WF-GDR` is now approval-loop ready for the Jeanine test. The next external action still requires an explicit send approval.

Use this phrase when ready:

```text
Approved: send Jeanine test from vambah@amadutown.com
```

Do not send Anna, Kyle, or any non-test contact until the Jeanine reply confirms the alert, draft, modification, and `safe to send` loop on a real reply.

## Roadmap status

Completed:

- Verified latest `WF-GDR` live execution.
- Confirmed the workflow took the wrong branch.
- Confirmed Gmail draft and app draft artifacts were absent.
- Confirmed the revenue approval alert did not post.
- Identified the smallest safe repair path.
- Patched the live `WF-GDR` sender extraction and Portfolio API auth path.
- Reran two controlled post-patch smoke executions.
- Confirmed the temporary smoke webhook was removed.

Remaining:

- Send the Jeanine test only after explicit approval.
- Use Jeanine's reply to verify the real reply alert, Gmail draft, app draft, and approval loop.
- After Jeanine passes, prepare Anna and Kyle for approval from `vambah@amadutown.com`.
