# BUGBOT.md — Scheduled Background Agent Guide

This file scopes the Cursor scheduled "test coverage" background agent (branches like `cursor/missing-test-coverage-*` / `cursor/regression-test-coverage-*`). Read this before opening a PR.

The main goal: **ship small, stable test additions that still apply cleanly when reviewed 1–7 days later.** Historically, ~70% of daily agent PRs went stale because they targeted high-churn modules or made large surface changes. This file narrows the agent to low-churn helpers and enforces review-friendly PR shape.

## Hard rules

1. **Tests only.** Do not modify application code, migrations, config, or existing tests. PRs must be purely additive: only new `*.test.ts` files.
2. **Rebase before opening.** If the branch is >24h behind `origin/main`, rebase onto `main` first. A PR that would revert any non-test file is invalid — abort.
3. **One surface per PR.** Each PR tests a single module (or tightly-related module pair). Large multi-file PRs are harder to triage and more likely to rot.
4. **Verify locally before pushing:**
   - `npx vitest run <new-test-file>` must pass.
   - `npm run lint` must pass.
   - `npx tsc --noEmit` must pass for the new test file.
5. **No ESLint plugin-specific disables.** The repo uses only `next/core-web-vitals`. Do **not** add `// eslint-disable-next-line @typescript-eslint/no-explicit-any` or similar — that plugin is not configured and the rule definition will fail the build. If you need to allow `any`, use a type assertion or a type that doesn't require disabling.

## Allowed targets (stable, high-value)

Prioritize these surfaces. They have been stable for months and tests against them age well.

### Pure utilities / parsers
- `lib/usps.ts`, `lib/tech-stack-lookup.ts`, `lib/video-slug.ts`, `lib/proposal-access-code.ts`, `lib/read-ai-meeting-id.ts`
- `lib/admin-return-context.ts`, `lib/admin-meeting-context-items.ts`
- Any pure function in `lib/` with no Supabase/fetch/n8n calls

### Financial / pricing helpers
- `lib/cost-calculator.ts`, `lib/pricing-model.ts`, `lib/margin-display.ts`
- `lib/installments.ts`, `lib/continuity.ts`, `lib/guarantees.ts`
- `lib/value-calculations.ts`

### Stable business logic
- `lib/audit-report-tier.ts`, `lib/audit-report-access.ts`, `lib/delivery-email.ts`
- `lib/lead-from-meeting.ts`, `lib/meeting-pain-classifier.ts`
- `lib/social-content.ts`, `lib/quick-wins-display.ts`
- `lib/constants/**`

### Webhook / integration plumbing (carefully)
- Signature validators, dedupe helpers, payload normalizers
- `app/api/slack-meeting-dedupe/route.ts`, `app/api/read-ai-meeting-dedupe/route.ts`
- `app/api/address/suggest/route.ts`, `app/api/address/validate/route.ts`

## No-go zones (high churn — do not write tests for these)

These surfaces change frequently. Tests written against them are usually stale within a week. **Skip entirely.**

- `lib/gamma-*.ts` (gamma-report-builder, gamma-evidence-index, gamma-theme-config, gamma-derived-metrics, gamma-generation, gamma-client, auto-audit-summary-gamma)
  — exception: `gamma-derived-metrics.ts` **is** stable and OK to test, but **only** additive cases for `computeDerivedMetrics` / `resolveOrganizationLabel`.
- `lib/n8n-value-evidence*.ts`, VEP pipeline wiring (VEP-001, VEP-002)
- `lib/heygen-config.ts`, `lib/heygen-*.ts` — Supabase client surface keeps evolving
- `lib/printful-*.ts`, `lib/module-sync-*.ts` — have been restructured multiple times
- `lib/database-health-check.ts` (does not exist — logic lives in `scripts/database-health-check.ts`; do not test scripts from `lib/`)
- `app/api/admin/value-evidence/workflow-complete/route.ts` — route behavior has drifted (currently returns 500 on paths tests expected 200)
- `app/admin/reports/gamma/**` — active UI iteration
- Any file under `app/admin/**` unless explicitly in "allowed" above
- Any migration (`migrations/*.sql`)

## Test-writing conventions

### Imports / mocks

Anything that imports `@/lib/supabase` transitively must mock it **before** importing the module under test:

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: null,
  supabaseAdmin: null,
  default: null,
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
}))

// Then import the module under test
import { yourFn } from '@/lib/your-module'
```

For `fetch`-dependent code:
```ts
vi.stubGlobal('fetch', vi.fn())
```

For API route tests, use `NextRequest` from `next/server` and construct requests with absolute URLs (`http://localhost/...`).

### Test file placement

- Colocate next to source: `lib/foo.ts` → `lib/foo.test.ts`.
- Exception for n8n helpers (historical): `lib/__tests__/n8n-*.test.ts`.
- API routes: next to `route.ts` as `route.test.ts`.

### Test content

- Cover happy path **and** at least one error / fallback branch.
- Mock external I/O (Supabase, fetch, n8n webhooks) — never hit real services.
- Prefer asserting observable behavior (return value, arguments passed to mock) over implementation details.
- Keep per-file test count to ≤ 10 cases. If you think more is warranted, split into a second PR.

## Branch / PR hygiene

- Branch name: `cursor/missing-test-coverage-<short-hash>` or `cursor/regression-test-coverage-<short-hash>` (current convention — keep it).
- PR title: `test: add regression coverage for <module>`
- PR body must include:
  - **Target file(s)** (link to the source being tested)
  - **Why this helper is stable** (one sentence — last modified date, low rate of change)
  - **Cases covered** (bullet list)
  - **Verification:** "Ran `npx vitest run <file>` locally, all cases pass"
- **Do not include** any non-test file changes. If you accidentally stage one, abort the PR.

## Before opening the PR: staleness self-check

Run this check and abort if it fails:

```bash
git fetch origin main
BEHIND=$(git rev-list --count HEAD..origin/main)
if [ "$BEHIND" -gt 5 ]; then
  echo "Branch is $BEHIND commits behind main. Rebase or abort."
  exit 1
fi

# Confirm only test files changed vs main:
CHANGED=$(git diff --name-only origin/main...HEAD | grep -v -E '\.test\.(ts|tsx)$' || true)
if [ -n "$CHANGED" ]; then
  echo "Non-test files changed: $CHANGED — abort."
  exit 1
fi
```

## When in doubt

Skip it. A PR that never gets opened is cheaper than a stale PR that has to be triaged and closed a month later.
