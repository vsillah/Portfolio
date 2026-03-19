# Contributing & Customization Guide

## The Golden Rule

```
config/  → YOUR territory. Customize freely.
src/     → TEMPLATE territory. Updated automatically.
```

### What you should edit

| File | What to customize |
|------|-------------------|
| `config/branding.ts` | Business name, colors, welcome message, suggested actions |
| `config/prompts.ts` | System prompt, AI personality, topic keywords |
| `config/features.ts` | Toggle voice chat, history, suggested actions on/off |
| `config/integrations.ts` | Usually no edits needed — reads from `.env.local` |
| `.env.local` | API keys and webhook URLs |
| `database/seed.sql` | Default system prompt text in the database |

### What you should NOT edit

Everything in `src/` is maintained by the template author. When updates are available, they arrive as a Pull Request that only touches `src/` — so your customizations in `config/` are never overwritten.

If you edit files in `src/`, future update PRs may have merge conflicts.

## Receiving Updates

When the template author pushes improvements:

1. A Pull Request appears in your repo automatically (via GitHub Actions)
2. Review the changes in the **Files changed** tab
3. If no conflicts: click **Merge pull request**
4. If conflicts in `config/`: follow the migration steps in the PR description

## Commit Message Convention

If you're making changes to your chatbot, use these prefixes:

- `config:` — changes to `config/` files
- `content:` — changes to prompts, seed data, copy
- `style:` — visual/CSS changes
- `fix:` — bug fixes
- `feat:` — new features you're adding

Example: `config: update business name and colors`

## Getting Help

If an update PR has conflicts you can't resolve, you can:

1. Close the PR and skip that update
2. Open an issue on the template repo for help
3. Re-run `npm run doctor` after merging to verify everything still works
