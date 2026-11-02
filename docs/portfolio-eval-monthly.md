# Portfolio eval registry and monthly review

`data/evals/manifest.json` is the machine-readable inventory. Each entry names its owner, scope, exact test or evidence command, existing pass rule, environment, freshness policy, evidence format, and remediation route. The runner checks that every repository test whose path contains `eval`, `benchmark`, `golden`, `quality`, `qa`, `llm-judge`, `chatbot`, `video-script`, or `source-validator` appears exactly once. Adding a matching test without a registry entry fails the monthly run.

At the `b45d6d01` base, the local chatbot bank contains 202 questions in 19 categories: 65 have expected keywords, 137 do not, 8 are boundary cases, and 9 are diagnostic cases. These are inventory counts, not a model-quality pass threshold. The new corpus test checks structural integrity without freezing those counts.

## Safe monthly command

From the Portfolio repository with dependencies installed:

```bash
npm run evals:monthly
```

The default runs only the entries marked `local`. It does not load `.env`, call model providers, query Supabase, or mutate data. Gated entries are reported as `gated`. The run writes a JSON report under `reports/evals/monthly/` with the Git commit, SHA-256 of the exact manifest bytes validated, UTC timestamp, coverage count, per-family result, owner, and remediation route. When a snapshot is supplied, the report records its SHA-256 digest without copying its contents or local path. That local directory is ignored by Git; attach a reviewed, privacy-safe report to the monthly automation or captain packet if it needs to persist beyond the worktree.

The existing **Monthly Portfolio Eval Coverage and Freshness Review** automation can invoke `npm run evals:monthly` from a checked-out revision, inspect the exit code and report path, and route each failure to the listed owner and Integration Captain. A failed exit code means missing registry coverage, missing command or environment, stale or absent supplied evidence, or a local test failure. Do not treat a gated result as a passing hosted eval.

## Hosted freshness evidence

For a read-only review, provide an approved, redacted JSON snapshot in a local file and run:

```bash
PORTFOLIO_EVAL_SNAPSHOT_PATH=/absolute/path/to/approved-eval-snapshot.json npm run evals:monthly
```

The snapshot shape is:

```json
{
  "chatbot": { "count": 6, "latestAt": "2026-10-01T00:00:00Z" },
  "llm-judge": { "count": 7, "latestAt": "2026-10-01T00:00:00Z" },
  "agent": { "count": 5, "latestAt": "2026-10-01T00:00:00Z" },
  "video-script": { "count": 1, "latestAt": "2026-10-01T00:00:00Z" }
}
```

Those numbers are an **example format**, not a claim about current production. Source tables and timestamp columns are in the manifest. The runner reads only the supplied file. For each hosted family it reports `absent`, `stale`, or `current` using its 31-day monthly freshness policy. Without a snapshot, it reports `gated`. If a snapshot is supplied, absent or stale evidence fails the run. A snapshot is evidence of recency, not of the evaluation's score or quality. The hosted pass threshold remains the persisted rubric or evaluation policy; where none is declared, human review is required before claiming a pass. No threshold was lowered or inferred from the observed record counts.

An owner may review additional test families with `npm run evals:monthly -- --include-gated`, after checking their required environment and side effects. The flag does not run hosted model or production evaluations; those require a separately approved workflow. The `--evidence-only <family-id>` option checks one hosted family against the supplied snapshot. Unknown families and missing snapshots fail closed.

## Expansion and remediation

When a new eval is added, the author adds a manifest entry with the owning team, executable command, existing threshold source, environment requirements, evidence location, and a route for failure. The Integration Captain reviews that entry and whether it can safely run locally. A failing deterministic family routes to the named owner for a scoped fix. Absent or stale hosted evidence routes to Model Ops or the video content owner for diagnosis and a separately authorized evaluation run. The monthly automation should report the failure, not silently refresh production evidence or invoke providers.

## Review-only hosted recovery packets

Use `scripts/portfolio-eval-recovery-packets.ts` to assemble a local JSON review packet for the four hosted families. It reads the canonical manifest, a commit-bound monthly report, the approved redacted snapshot, and an operator-reviewed bindings file. It writes packets to stdout and exits nonzero if any binding is blocked. It has no provider or database connection and grants no permission to execute a hosted evaluation.

After this change merges, run the monthly runner again from the exact reviewed commit with the approved snapshot. The older 2026-11-02 report has no `manifestSha256` and is deliberately rejected. The recovery CLI hashes the raw manifest file supplied to it and requires that digest to match the report's `manifestSha256`; a missing, malformed, or changed manifest digest blocks every packet.

```bash
./node_modules/.bin/tsx scripts/portfolio-eval-recovery-packets.ts \
  data/evals/manifest.json \
  /absolute/path/to/monthly-report.json \
  /absolute/path/to/freshness-snapshot.json \
  /absolute/path/to/approved-bindings.json > /absolute/path/to/recovery-packets.json
```

The bindings file has `{ "bindings": [ ... ], "previous": [ ... ] }`. Supply exactly one binding for each `chatbot`, `llm-judge`, `agent`, and `video-script` channel. Each binding names its manifest `familyId`; a `version` with `kind` (`prompt`, `rubric`, or `template`), exact `value`, and source; an approved source with `id`, `revision`, `approvalId`, `evidenceSha256`, matching channel/family/version, and `approved: true`; an `observed` count, latest timestamp, and approved provenance; and an `attempt` policy with `maxAttempts` (1–3), `maxRetries` (less than attempts), and expiry. The source approval and current version must be checked against their owning record before creating this file. Keep the bindings and output in a private local location; do not commit private source identifiers or results.

For chatbot, include `observed.humanRatings` as `{ "good": 0, "bad": 6 }` for the approved 2026-11-02 evidence. For LLM judge, use `observed.judgeRatings` with `{ "good": 2, "bad": 5, "aligned": 5, "misaligned": 2 }`. Human ratings and judge alignment are separate facts. For the agent, include `observed.agentRubric` with the approved rubric key, threshold `82`, average `76.8`, `passed: 2`, and `failed: 3`; these are historical observations. The video-script binding requires one *existing approved* `candidate` with its script, template, evidence, channel, and version identities matching the source. If none is eligible, the video packet stays blocked. The zero historical count never becomes a fabricated baseline score.

The packet repeats the manifest's threshold source and remediation owner. Agent threshold `82` is exact; chatbot and judge retain per-record `good`/`bad` review semantics with no invented aggregate pass value; video script retains the existing zero-blocker rule. Historical stale or absent evidence can produce a **review-ready recovery packet**, which means the proposed inputs can be reviewed, not that an evaluation passed or may run. A prior packet with the same key and digest returns `idempotent-replay`; changed content under the same key blocks. Review the packet, then use a separate authorization and execution workflow if a hosted run is warranted.
