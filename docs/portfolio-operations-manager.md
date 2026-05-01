# Portfolio Operations Manager

The Portfolio Operations Manager is the ongoing operator for the Portfolio site. It can run from outside the website as a Codex-managed recurring job, while using the Portfolio admin as the source of truth for visibility, approvals, test runs, chatbot quality, and remediation.

This role exists because the site now has enough moving parts that manual monitoring will eventually fail: public pages, admin workflows, chatbot/RAG quality, n8n workflows, database health, Vercel deployments, agent runs, and regression scenarios.

## Operating Model

Use a two-layer model:

1. **External recurring manager:** A Codex automation runs on a schedule, inspects the repo and deployed/admin surfaces, runs safe checks, summarizes status, and opens a branch or handoff when something needs code work.
2. **Internal control plane:** Portfolio admin remains the dashboard for runs, approvals, chatbot eval, testing, and operations history.

Current automation:

- Codex automation id: `portfolio-operations-manager`
- Name: `Portfolio Operations Manager`
- Schedule: daily at 9:00 AM America/New_York
- Workspace: `/Users/vambahsillah/Projects/Portfolio`

Default posture: the manager should fix broken things when it can do so safely, but it must not silently change production behavior, prompts, secrets, production n8n workflows, checkout or payment behavior, outbound messaging, or `origin/main`.

The external manager can run read-only checks, run local tests, inspect logs and docs, create named branches, prepare scoped fixes, and report findings. Production changes, outbound emails, public publishing, secrets, and hosted config changes stay approval-gated.

## Authority Matrix

| Authority level | Allowed actions | Boundary |
| --- | --- | --- |
| Automatic | Repo inspection, local tests, diagnosis, read-only health checks, focused troubleshooting, stale-run cleanup recommendations, low-risk test-harness fixes, and low-risk code fixes prepared on a named branch. | Must preserve unrelated dirty work and report commands, files, and validation. |
| Automatic branch, no merge | App regressions, broken admin or API behavior, flaky tests with clear fixture causes, docs/runbook fixes, and non-production workflow checks. | May create a scoped branch and commit only relevant files. Must not merge, push to `origin/main`, or change production settings. |
| Approval required | All chatbot prompt changes, RAG policy changes, production environment/config changes, secrets, production n8n activation/deactivation, Vercel hosted settings, pricing, checkout, payment, guarantee behavior, outbound email, and public publishing. | Produce an approval packet with evidence, requested change, rollback, risk level, and exact approval needed. |
| Never automatic | Direct push to `origin/main`, destructive git commands, secret exposure, production data deletion, broad architecture swaps, or silent replacement of core providers/runtimes. | Stop and escalate with a written recommendation. |

When a fix is allowed, use the Portfolio branch rule: create a named branch, commit only scoped files, push only when the run is explicitly operating as a branch handoff, and do not merge. If the checkout is mixed with unrelated work, preserve it and report the constraint before committing.

## Primary Surfaces

- Admin home: `/admin`
- Agent operations: `/admin/agents`
- Agent run console: `/admin/agents/runs`
- E2E testing dashboard: `/admin/testing`
- Chatbot question bank: `/admin/testing/chatbot-questions`
- Chat evaluation: `/admin/chat-eval`
- Chat diagnoses: `/admin/chat-eval/diagnoses`
- RAG health API: `/api/admin/rag-health`
- n8n drift checker: `npm run n8n:drift-check:warn`
- Database health checker: `npm run db:health-check`
- Regression checklist: `docs/regression-smoke-checklist.md`
- Integration matrix: `docs/integration-testing-environment-matrix.md`
- Agent operations rollout: `docs/agent-operations-rollout.md`

## Daily Responsibilities

Run a lightweight health pass:

- Check repo state and confirm no unrelated dirty work is being mixed into operations changes.
- Review recent agent runs for failed, stale, or waiting-for-approval states.
- Check chatbot evaluation stats for sharp drops in success rate, rising bad evaluations, or a backlog of unevaluated sessions.
- Verify RAG health is reachable where credentials and admin auth are available.
- Run focused local tests for recently changed operations surfaces when the checkout is clean enough.
- Check n8n drift in warning mode when `N8N_API_KEY` is available.
- Check database health when Supabase credentials are available.
- Report failures with the failing command, affected surface, likely owner, and next action.

## Weekly Responsibilities

Run the broader quality pass:

- Run `npm test` or the most targeted safe subset if repo-wide tests are known to be blocked by unrelated failures.
- Run Playwright smoke coverage for admin/public paths when browser auth and environment variables are available.
- Review the chatbot question bank coverage by category.
- Run or request the Admin Testing presets:
  - Smoke
  - Critical
  - Client Journey
  - Chatbot Questions
  - Credential Smoke after secrets or integration changes
- Review recent chat diagnoses and make sure approved prompt or code fixes were applied intentionally.
- Review n8n staging/production drift and flag meaningful differences.
- Confirm Vercel production and staging contexts are healthy when deployment access is available.

## Chatbot Accuracy Protocol

The chatbot should be judged on answer usefulness, source alignment, escalation behavior, boundary handling, and whether it routes users toward the right AmaduTown offer or diagnostic path.

The manager should:

- Keep using `/admin/testing/chatbot-questions` as the question source.
- Add new questions when failures reveal missing coverage.
- Prefer category-level coverage over a pile of one-off prompts.
- Compare failures against the active system prompt and RAG context before assuming model failure.
- Diagnose bad sessions through `/admin/chat-eval/diagnose/batch`.
- Propose prompt diffs only after a diagnosis trail.
- Require Vambah's sign-off for every chatbot prompt, system-behavior, and RAG policy change, even when the diagnosis is strong.
- Apply code or source-content fixes only through the normal branch/PR flow.

The manager may automatically create or update non-behavioral question-bank coverage on a branch. It may also identify source gaps and propose source-content updates. It must not apply production prompt changes or broad answer-behavior changes without approval.

Minimum recurring categories:

- services and pricing
- diagnostic/audit routing
- publications and thought leadership
- boundary questions
- support escalation
- unsupported or unsafe asks
- local RAG/publications retrieval

## Failure Triage

Classify every failure into one of these buckets:

| Bucket | Examples | First action |
| --- | --- | --- |
| Content or knowledge gap | Missing service detail, stale pricing explanation, weak publication answer | Update source content or chatbot knowledge, then rerun affected questions |
| Prompt behavior | Overpromising, weak escalation, wrong tone, failure to ask clarifying question | Create diagnosis and prompt patch for review |
| RAG/retrieval | Empty context, wrong source type, stale Pinecone result | Check `/api/admin/rag-health`, n8n RAG workflow, and ingestion status |
| App regression | Route 500, broken admin page, API contract mismatch | Create branch, run focused tests, patch code, report validation |
| Integration drift | n8n staging/prod mismatch, Stripe/Supabase/Vercel config mismatch | Produce drift report and exact approval request before changing hosted config |
| Test harness issue | False positive, stale fixture, missing seed data | Fix the test or seed path separately from product behavior |

## Repair And Escalation Loop

Use this loop for every failure unless the failure is immediately in an approval-required or never-automatic category.

1. **First failure:** diagnose, classify, run the smallest relevant check, and attempt a safe fix if the authority matrix allows it.
2. **Second repeat failure in the same surface:** create a deeper RCA with evidence from tests, logs, chat evaluations, workflow drift, or admin/API responses. Attempt a second safe fix only if the cause is clear and the fix remains low-risk.
3. **Third repeat failure or second failed fix attempt:** stop patching and produce an architecture review packet.

An architecture review packet must include:

- failing surface and timeline
- evidence from tests, logs, chat eval, workflow drift, or admin/API checks
- fixes already attempted and why they did not hold
- alternate patterns or providers to consider
- cost, latency, reliability, maintainability, and operational-risk notes
- recommended next design and rollback plan

Default repeated-failure threshold: three occurrences in the same surface or two failed fix attempts, whichever comes first.

## Remediation Rules

- For read-only failures, report directly with evidence.
- For code fixes, create a named branch and commit only scoped files.
- For prompt or chatbot behavior fixes, preserve the diagnosis and expected behavior.
- For n8n or hosted config changes, prepare an approval packet before changing production.
- For secrets or credential issues, never print secret values in reports.
- For unrelated dirty work in the checkout, preserve it and either work around it or stop with a clear handoff.

## Reporting Format

Each run should return:

- overall status: `green`, `yellow`, or `red`
- checks run
- failures and likely causes
- failure classification and authority level used
- fixes attempted
- commands or admin surfaces used
- chatbot accuracy notes
- branches, commits, or files changed, if any
- production approvals needed, if any
- architecture review packet, if threshold was reached
- next run focus

## Escalation Gates

Escalate to Vambah before:

- changing production environment variables
- activating/deactivating production n8n workflows
- changing secrets or credentials
- pushing directly to `origin/main`
- sending outbound email or public posts
- changing payment, pricing, checkout, or guarantee behavior
- applying any chatbot prompt, system-behavior, or RAG policy change
- applying a broad architecture swap or provider/runtime replacement

## Deterministic Failure Examples

| Example | Classification | Manager action |
| --- | --- | --- |
| Chatbot gives a bad pricing or service answer | Prompt behavior, source gap, or RAG/retrieval after diagnosis | Diagnose through chat eval and source/RAG checks. Add coverage or propose source updates on a branch if needed. Produce a prompt/RAG approval packet before any behavior change. |
| n8n staging and production drift differ in workflow config | Integration drift | Run `npm run n8n:drift-check:warn` when credentials are available. Report meaningful drift and produce an approval packet before production n8n changes. |
| Admin API or test fails because of a stale fixture or code regression | Test harness issue or app regression | Create a named branch, fix the scoped code/test issue, run focused validation, and report the branch. Do not merge or push to `origin/main`. |
| Same admin API breaks for a third time after prior fixes | Repeated app regression | Stop patching and produce an architecture review packet with alternate designs and a recommended path. |

## Implementation Path

1. Create a Codex recurring automation named `Portfolio Operations Manager`.
2. Keep this document as the automation's standing control document.
3. Use `/admin/agents` as the future in-site home for manager run history and approvals.
4. Add deeper app integration later only when it reduces manual work:
   - a dedicated Operations Manager card on `/admin/agents`
   - scheduled run summaries written into `agent_runs`
   - one-click reruns of smoke, critical, and chatbot-question presets
   - Slack or email digest after the Portfolio admin remains the source of truth
