# Long-form script intelligence QA

- Reviewed code commit: `28920065`
- Route: `http://127.0.0.1:3210/admin/content/video-generation?qa_script_intelligence=ready&rev=28920065#script-intelligence-review`
- Viewports: desktop `1440x1000`; mobile `390x844`
- States: passing packet, stale topic evidence, originality blocked
- Interactions: proof-placement drill-in, topic-source trace, framework receipts
- External requests: none beyond the existing Supabase authentication refresh
- Protected actions exercised: none

The privacy-safe fixtures create no record and cannot call a provider, render,
upload, create a platform draft, schedule, publish, spend, or send externally.
The MP4 was encoded as H.264 with `yuv420p` and fast-start enabled. `results.json`
contains the `ffprobe` receipt.

Reproduce from the worktree while the matching localhost server is running:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3210 \
PLAYWRIGHT_AUTH_STATE=.auth/long-form-script-intelligence-local.json \
npm run admin:auth:save

QA_REVISION=28920065 \
node scripts/qa/record-long-form-script-intelligence.mjs
```
