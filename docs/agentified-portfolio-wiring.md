# Agentified Portfolio Wiring

Agentified now lives inside Portfolio at `agentified/`.

## Surfaces

- Public landing page: `/agentified`
- Publications card: `components/Publications.tsx`
- Shared metadata: `lib/agentified-publication.ts`
- Admin workspace: `/admin/content/agentified`
- Content Hub navigation: `lib/admin-nav.ts` and `components/admin/AdminSidebar.tsx`

## Current Status

- Subtitle: `The Product Leader's Guide to Superhuman Acceleration Built on Trust`
- Canonical manuscript source: `agentified/manuscript/production-draft/chapters/`
- Canonical companion workbook: `agentified/manuscript/workbook/agentified-operating-system-workbook.md`
- Canonical assembled drafts:
  - Production: `agentified/manuscript/production-draft/agentified-production-draft.md`
  - Workbook-enhanced: `agentified/manuscript/workbook-enhanced/agentified-workbook-enhanced-draft.md`
- Latest Claude/Drive manuscript: `Agentified_Manuscript_v4`
  - Google Doc: `https://docs.google.com/document/d/1t3ZQ_x73-GDIXvgvDyYa5rgPa01P5VidXURGOE-TGuo`
  - Local Drive pointer: `/Users/vambahsillah/Library/CloudStorage/GoogleDrive-vsillah@gmail.com/My Drive/Agentified_Manuscript_v4.gdoc`
  - Verified 2026-07-04: front matter contains `The Product Leader's Guide to Superhuman Acceleration Built on Trust`.
- Production draft: `agentified/manuscript/production-draft/agentified-production-draft.md`
- Workbook-enhanced draft: `agentified/manuscript/workbook-enhanced/agentified-workbook-enhanced-draft.md`
- Public status label: `Author review`
- Supabase publication row: seeded in dev and production as `Agentified`, `display_order=2`, `is_published=true`, `publication_url=/agentified`
- Seed command: `npm run publications:seed-agentified -- --target prod`

## Build Commands

```bash
cd /Users/vambahsillah/Projects/Portfolio/agentified
./scripts/assemble-production-draft.sh
./scripts/assemble-workbook-enhanced-draft.sh
```

## Claude/Fable 5 Collaboration

Codex can call Claude Code from the Portfolio workspace through the repo-local bridge:

```bash
cd /Users/vambahsillah/Projects/Portfolio
agentified/scripts/run-fable5-collaboration.sh \
  agentified/prompts/fable5-source-smoke.md \
  source-smoke
```

- System prompt: `agentified/prompts/fable5-collaboration-system.md`
- Read-only manuscript review prompt: `agentified/prompts/fable5-manuscript-fine-tune-review.md`
- Receipts: `agentified/collaboration/claude-fable5/runs/`
- Bridge note: `agentified/collaboration/claude-fable5/README.md`

## Open Brain

Use the existing private manuscript summarizer when the draft should be represented in Open Brain. It records private chapter summaries and avoids copying raw manuscript text into durable memory.

```bash
npm run open-brain:manuscript-summaries -- --export-dir /Users/vambahsillah/Projects/Portfolio/agentified/manuscript/production-draft
```

## Remaining Gates

- Decide whether to create a gated lead magnet once PDF/EPUB proof assets exist.
- Decide whether public screenshots or structural diagrams from Portfolio are approved.
- Run one opening-pages pass so the manuscript delivers on trusted acceleration immediately.
