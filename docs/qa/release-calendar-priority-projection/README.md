# Release Calendar priority projection QA

Product commit: `a22b63d72c2bee2292e260fcad464539a43f1635`

The three MP4 walkthroughs use the exact localhost Release Calendar route with `section=calendar` and a commit-bound `rev` query. A synthetic, read-only authenticated session supplies 90 persisted calendar rows and ten immutable draft rows. Four persisted rows are historical examples: completed, cancelled, published, and explicitly superseded. They remain in the 100-row calendar and are absent from preparation priorities.

The capture script checks the priority states and ordering, 100-row count, no horizontal overflow, constrained row cells, search, channel filter, pagination, Details expansion, keyboard focus, and zero write requests at 1280×800, 820×900, and 390×844. Provider generation, upload, scheduling, publishing, and send remain disabled in the fixture. `results.json` records the bound commit, route, viewport sizes, and side-effect flags.

The task-local integrated in-app browser was unavailable, and the isolated Chrome fallback reached localhost sign-in while 1Password was locked. That dedicated Chrome tab was closed after the captain confirmed its in-app browser is available for the final handoff. Authenticated interactive review remains pending in the captain lane. The synthetic MP4s show the built UI; they are not a live production-data smoke or a substitute for that review.

Reproduce with `QA_OUTPUT=docs/qa/release-calendar-priority-projection node scripts/qa/record-release-calendar-automation.mjs` while the exact product build is running on localhost:3000 with outbound n8n disabled.
