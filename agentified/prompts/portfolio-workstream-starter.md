# Portfolio Workstream Starter Prompt

Use this prompt to start a new Codex or Claude Code workstream from the Portfolio project root.

```text
You are working in /Users/vambahsillah/Projects/Portfolio.

Objective:
Continue the Agentified publication workstream inside Portfolio. Agentified is Vambah Sillah's third book and should be treated as a real Portfolio publication, manuscript workspace, and Open Brain-connected operating-system case study.

Current state:
- Agentified lives at /Users/vambahsillah/Projects/Portfolio/agentified.
- Public page: /agentified.
- Admin workspace: /admin/content/agentified.
- Shared metadata: lib/agentified-publication.ts.
- Portfolio wiring note: docs/agentified-portfolio-wiring.md.
- Supabase publication rows already exist in dev and production:
  - title: Agentified
  - publication_url: /agentified
  - publisher: AmaduTown Manuscript
  - display_order: 2
  - is_published: true
  - file_path: /agentified-cover.svg
- Seed command, if reconciliation is needed:
  npm run publications:seed-agentified -- --target prod

Canonical positioning:
- Title: Agentified
- Subtitle: The Product Leader's Guide to Superhuman Acceleration Built on Trust
- Core thesis: Acceleration in an agentic world only scales when the process can be trusted.
- The book should build from Accelerated, but stand on its own as the product leader's guide to governing agentic work through memory, roles, routing, approvals, evals, drift checks, receipts, and operating-system design.

Author-story spine to preserve:
- Vambah first tried Replit and found the harness too limited for the guardrails, walled-garden boundaries, authority choices, customization, security posture, and autonomy he needed.
- He then moved to Cursor and found the economics hard to sustain because the harness did not own a frontier model and could not subsidize the agentic workload.
- Codex became home because it provided flexibility, computer/web/app navigation, frontier-model orchestration through the harness, direct GitHub/worktree traceability, and a strong link between chats and code.
- Portfolio came first. Because his personal and professional corpus already lived there, it became the substrate for Open Brain, Shaka, role delineation, Kanban, evals, drift assessment, approvals, and Mission Control.

Voice and manuscript rules:
- Sound like Vambah: grounded, reflective, practical, morally clear, systems-minded.
- Open from concrete scenes and operating tensions, then move into product principles.
- Keep the book human, not generic AI thought leadership.
- Avoid AI-isms: no formulaic "not just / not only" antithesis, no empty "unlock/leverage/seamless/robust/landscape" filler, no over-polished consulting cadence.
- Keep private chats, raw personal records, private manuscript source text, secrets, and unapproved inferences out of public/docs surfaces.
- Public sources and YouTube references should live as formal endnotes or source maps, not as raw playlist dumps.

Important manuscript surfaces:
- agentified/manuscript/production-draft/agentified-production-draft.md
- agentified/manuscript/workbook-enhanced/agentified-workbook-enhanced-draft.md
- agentified/manuscript/workbook/agentified-operating-system-workbook.md
- agentified/manuscript/workbook/worksheet-insertion-plan.md
- agentified/manuscript/references/formal-endnotes.md
- agentified/manuscript/references/youtube-ai-source-map.md
- agentified/agentified-book-blueprint.md
- agentified/claude-code-fable5-handoff.md

Recommended first pass:
1. Read docs/agentified-portfolio-wiring.md and lib/agentified-publication.ts.
2. Read the latest author-review and workbook notes under agentified/manuscript.
3. Inspect the current git status and preserve unrelated dirty work.
4. Choose one focused lane:
   - opening-pages manuscript pass,
   - workbook prompt/example expansion,
   - Open Brain manuscript summary path,
   - public/admin Portfolio surface polish,
   - PDF/EPUB lead magnet preparation,
   - cover/package readiness.
5. Produce a scoped artifact or patch. Do not drift into broad rewrite unless explicitly asked.

Validation expectations:
- If code changes: run npx tsc --noEmit and focused tests for the touched surface.
- If Portfolio publication surfaces change: smoke /agentified, /, and /admin/content/agentified locally.
- If Supabase is touched: verify MCP tool availability first, inspect schema before writing, and verify the row after the write.
- If manuscript content changes: rebuild the relevant draft using:
  cd /Users/vambahsillah/Projects/Portfolio/agentified
  ./scripts/assemble-production-draft.sh
  ./scripts/assemble-workbook-enhanced-draft.sh

Working rules:
- Do not push directly to origin/main.
- Do not revert unrelated dirty files.
- Keep raw private manuscript material source-safe.
- Make next-step ownership explicit at the end.
```
