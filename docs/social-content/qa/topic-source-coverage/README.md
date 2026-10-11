# Topic source coverage preview QA

This packet records the deployed preview-only, read-only fixture for governed social topic source coverage.

## Route

`/admin/social-content/topic-source-coverage-qa?step=copy&qa=topic-source-coverage`

The fixture exists only in Vercel preview, development, and test environments. It is disabled when `VERCEL_ENV=production`. No shared social-content row is created. The route renders an evidence-only surface rather than the Social Content editor: there is no post preview, editable copy, approval rail, topic-selection action, provider action, upload, schedule, publishing control, or external execution path.

The walkthrough checks both deterministic states through the real detail API:

- `ready`: all five approved source collections and Dark Castle Chess, Accelerated, and Agentified have receipt-backed coverage.
- `blocked`: the meeting-summary scan and Agentified receipt expose their recovery instructions.

## Reproduce against a deployed preview

Run from the canonical Portfolio checkout so Vercel supplies a short-lived preview-access token without writing it into this worktree:

```bash
vc env run --cwd /Users/vambahsillah/Projects/Portfolio -- \
  sh -c 'cd "$1" && QA_BASE_URL="$2" node scripts/qa/social-topic-source-coverage.cjs' \
  sh /ABSOLUTE/PATH/TO/PORTFOLIO-WORKTREE \
  https://DEPLOYMENT.vercel.app
```

The script validates 390px, 768px, and 1440px widths; checks the ready and blocked evidence states; confirms the publish-style affordances are absent; asserts that the live backlog is not requested; rejects any API mutation or outside request; and writes screenshots, playable MP4 files, and `results.json` into this directory.
