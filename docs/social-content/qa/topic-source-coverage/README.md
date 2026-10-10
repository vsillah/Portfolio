# Topic source coverage preview QA

This packet records the deployed preview-only, read-only fixture for governed social topic source coverage.

## Route

`/admin/social-content/topic-source-coverage-qa?step=copy&qa=topic-source-coverage`

The fixture exists only in Vercel preview, development, and test environments. It is disabled when `VERCEL_ENV=production`. No shared social-content row is created. Save, approval, rejection, topic selection, provider calls, uploads, scheduling, publishing, and external sends remain unavailable.

The walkthrough checks both deterministic states through the real detail API:

- `ready`: all five approved source collections and Dark Castle Chess, Accelerated, and Agentified have receipt-backed coverage.
- `blocked`: the meeting-summary scan and Agentified receipt expose their recovery instructions.

## Reproduce against a deployed preview

Run from the canonical Portfolio checkout so Vercel supplies a short-lived preview-access token without writing it into this worktree:

```bash
vc env run --cwd /Users/vambahsillah/Projects/Portfolio -- \
  sh -c 'cd "$1" && QA_BASE_URL="$2" node scripts/qa/social-topic-source-coverage.cjs' \
  sh /Users/vambahsillah/.codex/worktrees/e4c5/Portfolio \
  https://DEPLOYMENT.vercel.app
```

The script validates 390px, 768px, and 1440px widths, asserts that the live backlog is not requested, rejects any API mutation or outside request, and writes the screenshots, playable MP4 files, and `results.json` into this directory.
