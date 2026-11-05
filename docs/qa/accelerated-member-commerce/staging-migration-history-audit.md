# Portfolio staging migration-history audit

Date: 2026-11-05. Target: `xxissfhcdjivuhxwjyhv` (Portfolio Dev/staging). Base: `8922179808c27b01f0ce06b54c800110fb283655`.

The complete version-by-version map is in `staging-migration-discrepancy-map.json`. It records each staging-only version, each local-only version, same-name candidate files, and whether the stored SQL bytes match. MD5 is used only to compare bytes, not as a security proof or a claim of semantic equivalence. No customer rows or SQL bodies are included.

## Findings

| Comparison | Count |
| --- | ---: |
| Staging migration-history rows | 128 |
| Local `supabase/migrations/*.sql` files | 60 |
| Exact version on both sides | 9 |
| Exact-version SQL byte matches | 7 |
| Staging-only versions | 119 |
| Staging-only versions whose SQL bytes match a local file elsewhere | 49 |
| Local-only versions | 51 |
| Local-only versions whose SQL bytes match a staging record | 35 |
| Local-only versions with no staging SQL byte match | 16, including the new commerce migration |

Among the 119 staging-only versions, 28 have no same-name file in either `supabase/migrations` or legacy `migrations`; 44 have a name candidate with different SQL bytes; 47 have a name candidate with identical SQL bytes. Two additional staging versions match SQL bytes under a different local name. The two exact-version SQL differences are `20260506090332_secure_documents_local_rag_rls` and `20260830170000_allow_sms_outreach_queue_channels`. Name or version equality must not be treated as content equality.

The direct worktree `supabase db push --dry-run --linked` fails because remote versions are absent from the active local directory. Its suggested bulk `supabase migration repair --status reverted ...` is unsafe: it would relabel already-applied staging migrations as unapplied. The local `*.test.ts` file in the migration directory only produces a skip warning.

## Safe lane-specific route

No staging history repair is needed for this commerce migration. A temporary project mirror fetched the 128 staging records into `/tmp/portfolio-accelerated-migration-audit.iTJFJM/supabase/migrations`. After copying the CLI-created `20261105180647_accelerated_member_commerce.sql` into that mirror, the staging dry run completed and listed **only** that new migration. `supabase migration fetch` and `supabase db push --dry-run` did not change staging history or schema. The migration SQL also passed a rolled-back staging transaction; follow-up checks confirmed its new function and column did not persist.

Exact read-only reproduction:

```bash
supabase migration list --linked
supabase db push --dry-run --linked
supabase migration fetch --linked --workdir /tmp/portfolio-accelerated-migration-audit.iTJFJM
cp supabase/migrations/20261105180647_accelerated_member_commerce.sql /tmp/portfolio-accelerated-migration-audit.iTJFJM/supabase/migrations/
supabase db push --dry-run --linked --workdir /tmp/portfolio-accelerated-migration-audit.iTJFJM
```

The temporary mirror is linked to staging only. Its link must be checked again before any future write. This audit did **not** run `supabase db push` without `--dry-run`, `migration repair`, `db pull`, or any production command.

## Durable reconciliation, separately scoped

1. Preserve the fetched staging SQL as an audit source and compare the 2 exact-version differences and all 44 divergent name candidates. Check the 16 local-only SQL files without a remote byte match against live schema and their intended environments. These could be unapplied work, changed copies, or migrations applied under different SQL; the map does not decide which.
2. Compare production migration history before renaming, removing, or replacing committed migration files. A staging-safe rename could break a different environment that applied the local timestamp.
3. Decide how to represent remote-only history and genuinely unapplied local migrations in the repository. Run a clean dry run from that reviewed history before any history repair or schema write. Do not execute the CLI's blanket `repair --status reverted` suggestion.

The narrow next gate for this lane is finishing code and regression checks, then applying only `20261105180647_accelerated_member_commerce.sql` to staging through a reviewed staging-only mirror. This turn remains read-only for migration history.
