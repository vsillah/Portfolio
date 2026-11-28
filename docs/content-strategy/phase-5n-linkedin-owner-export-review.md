# Phase 5N: owner export review contract

This local review contract reads an explicitly supplied owner-downloaded Creator Analytics XLSX. The original workbook stays outside the repository and unchanged. The first reviewed source is identified only by SHA-256 `235d0302a761205ed835a8c7e05502024690823d6d9358c8af48b31da035a79c`. The parser pins its observed 15-column schema by hash. A different source or schema stops the review until it is examined and approved as a new version.

Run the local review with an explicit private path and expected hash:

```bash
python3 scripts/research/linkedin_owner_export_review.py --source "$LOCAL_OWNER_EXPORT" --expected-sha256 235d0302a761205ed835a8c7e05502024690823d6d9358c8af48b31da035a79c
```

The command writes a redacted report to standard output only. Do not redirect it into the repository or attach it to a public PR. It emits no source path, post URL, raw identity, metric value, or workbook bytes. Identity kind and digest let an authorized reviewer compare rows without exposing the identity. The parser retains exact `ugcPost` or `share` identity in process memory for classification and rejects activity-only inference. The export's publication date is recorded as **day precision**. All observed rows in the initial export classify as `image`; a `text` row blocks this image cohort.

The review report is always **Unscored**. Exact publication timestamps, activity binding, complete seven-day windows, same-format baselines, rights and retention, issued source-policy approval, and explicit expiry remain unproved. Its 30-day maximum freshness ceiling is inactive Portfolio governance for a future candidate, not a LinkedIn requirement. A policy claim supplied to the pure function cannot by itself issue approval. An authorized owner must direct deletion or refresh; every refresh needs a newly hashed export and rolls back to Unscored. Persisted use needs a separate, explicit version-bound policy approval and deletion plan.

This module has no scorer, receipt, packet, calendar, preparation, notification, persistence, network, or provider connection. All such switches remain false. The existing exact-timestamp and exact-seven-day scoring contracts are unchanged. Tests use synthetic in-memory XLSX bytes; no private workbook content belongs in tests or Git.
