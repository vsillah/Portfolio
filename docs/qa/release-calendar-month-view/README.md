# Release Calendar List, Calendar, and Gantt review

Product build: `fd30fa9ad444799cfa87c75109289862467cb9b0`.

The three MP4s show the existing authenticated Release Calendar route on localhost with a synthetic, read-only admin session. The fixture contains 90 persisted release rows and ten immutable draft rows. It includes completed, cancelled, published, and superseded history; no preparation-priority logic or external-action lock is changed. The capture script blocks and records every non-read request.

The walkthroughs show List → Calendar → Gantt, month and window navigation, filters and empty recovery, overflow disclosure, exact-row Details, and the 390×844 selected-day agenda and vertical campaign cards. Desktop, 820px mid-width, and 390px mobile runs checked visible event/milestone counts, responsive-layout visibility, keyboard activation, and horizontal overflow. Dark, light, and system color schemes were exercised. `results.json` records the route, product commit, fixture count, viewports, and side-effect flags.

Run the fixture capture against the exact production build on `localhost:3219` with outbound n8n disabled:

```bash
PORT=3219 N8N_DISABLE_OUTBOUND=true MOCK_N8N=true npm run start
node scripts/qa/record-release-calendar-month-view.mjs
```

The task-local integrated browser was unavailable. A dedicated Chrome fallback reached the localhost login gate and was closed; unrelated browser tabs were untouched. The Integration Captain will use its in-app browser for the authenticated Human QA route. These synthetic recordings are visual and interaction evidence, not a live production-data smoke or Human QA approval.
