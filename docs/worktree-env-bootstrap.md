# Worktree Env Bootstrap

Use this when creating a sibling Portfolio worktree for Codex, Hermes, or other
agent implementation lanes.

```bash
npm run worktree:env
```

The script finds the `main` worktree and symlinks local runtime files into the
current worktree:

- `.env.local`
- `.env.staging`
- `.vercel`

These paths are gitignored. The script does not print secret values and does not
copy secrets into git-tracked files. Symlinks are preferred so credential
rotation in the main checkout is reflected in future worktree runs.

You can override the source checkout or linked paths:

```bash
npm run worktree:env -- --source /Users/vambahsillah/Projects/Portfolio
npm run worktree:env -- --paths .env.local,.vercel
```

The database pre-push health check is still production-aware:

- local pushes without explicit `PROD_SUPABASE_URL` and
  `PROD_SUPABASE_SERVICE_ROLE_KEY` skip the production baseline check,
- CI still runs the check,
- `npm run db:health-check:dev` remains available for dev database validation.
