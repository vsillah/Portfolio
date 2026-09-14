# Case-structured discovery

## Workflow

The existing Sales conversation and audit walkthrough now place **Case discovery** above the workbench. Open a section to capture the question, success measure, timing, definitions, investigation buckets, evidence gaps, hypotheses, options and next action. Choose a framework and record client alignment. Call prompts stay behind a disclosure.

**Save discovery** saves the packet and ordinary call notes together. **Save and review proposal** saves first, then opens the existing proposal modal/drawer. Failed saves retain edits and offer retry. Proposal recovery errors or an empty offer without an existing proposal block the handoff with an explanation. Follow-up gaps are advisory, so an operator can review a proposal while evidence is incomplete.

The proposal review includes a collapsed **Discovery review · Internal only** packet. The operator uses it to review the existing scope and line items. There is no automatic copying into client text, AI script requests, PDFs, agreements or the client dashboard. Client-facing output continues through the existing branded proposal/document/dashboard workflow.

## Data and provenance

- Existing storage: `sales_sessions.internal_notes`, via the existing authenticated admin session PUT route.
- A versioned JSON suffix stores the packet. Ordinary call notes remain independently editable. Unsupported/malformed suffixes are retained as ordinary text, avoiding silent data loss.
- This is a review aid, not automatic proposal scope generation. Concurrent editing of the same session retains the existing last-write-wins behavior.
- Source inspected through Dropbox on 2026-09-14: `/SimpleMind/Export/Discovery/191015 Case Structuring.html`, file id `id:57d0Mff9Q1oAAAAAAAAYEw`, revision `63258f2c193c7024e68dc`.
- Only concise operating guidance was derived from the general structuring material. Private examples, names and organizational notes were excluded. No raw export is copied into the repository or client UI.

## Validation

```bash
node --import tsx scripts/build-chatbot-knowledge.ts
./node_modules/.bin/vitest run lib/case-discovery.test.ts components/admin/sales/CaseDiscoveryPanel.test.tsx
./node_modules/.bin/next lint --file components/admin/sales/CaseDiscoveryPanel.tsx --file lib/case-discovery.ts --file 'app/admin/sales/conversation/[sessionId]/page.tsx' --file 'app/admin/sales/[auditId]/page.tsx'
./node_modules/.bin/tsc --noEmit --pretty false
node scripts/qa/slack-receipt-status-server.cjs
node scripts/qa/case-discovery.cjs
```

Results: 12 focused tests passed; scoped lint passed; both routes passed at all four viewport widths. No unexpected writes or page errors. External analytics requests were blocked.

Unit/component coverage: legacy and malformed note preservation, serialization and rehydration, framework and alignment changes, missing-input guidance, save failure/retry, proposal blockers, internal review without unrelated notes.

Typecheck is blocked by existing duplicate object keys in `lib/social-comment-inbox-ui.test.ts:51-52`, confirmed in base `ee353349`. The generated knowledge dependency was built locally. No full production build success is claimed.

## QA routes and evidence

- Conversation: `http://127.0.0.1:3197/admin/sales/conversation/11111111-1111-4111-8111-111111111111`
- Audit: `http://127.0.0.1:3197/admin/sales/42`
- These are real Next.js pages exercised with Playwright-supplied synthetic auth/API responses. The URLs alone do not recreate the fixture in a separate browser session.
- Start the existing isolated QA server above in a clean worktree with no environment files. It injects synthetic credentials, blocks outbound server requests and mocks remote fonts. Then run the recorder; it blocks external browser requests and rejects unexpected API writes.
- Committed review artifacts: `case-discovery-1440.mp4`, `case-discovery-390.mp4`, `conversation-360.png`, `proposal-audit-360.png`, and `evidence.json`. Desktop MP4 frames and narrow-width screenshots were visually inspected.
- Recorder outputs: `local-private/case-discovery-qa/evidence.json`, `case-discovery-{1440,768,390,360}.mp4`, and screenshots for each route and proposal review.
- The recorder covers both routes, framework selection, evidence entry, alignment, save failure/retry, private proposal handoff and reload persistence at 1440, 768, 390 and 360 pixels.
- Writes are intercepted in browser memory. No live session, proposal or customer records are created or changed.

## Captain handoff

Use an approved preview or staging session at `/admin/sales/conversation/<session-id>` and `/admin/sales/<audit-id>` for hosted QA. Confirm a saved packet survives a real authenticated reload and review the existing proposal drawer with the packet. Human QA remains pending until the captain supplies the exact authenticated hosted route and review evidence. The local recordings establish rendered behavior with synthetic API responses, not deployed database persistence.

No migrations, credentials, provider activation, external sends, explicit deployment or merge are part of this lane. Both `Vercel – portfolio` and `Vercel – portfolio-staging` require captain verification before integration.
