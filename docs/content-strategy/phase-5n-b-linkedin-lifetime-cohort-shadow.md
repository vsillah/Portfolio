# Phase 5N-B: LinkedIn owner-export lifetime cohort, review only

## Boundary and source-policy candidate

This is a **candidate**, not an issued source policy. It applies only to the retained, owner-downloaded private XLSX whose SHA-256 is `235d0302a761205ed835a8c7e05502024690823d6d9358c8af48b31da035a79c` and whose pinned header SHA-256 is `4f49c84ac68a2a76507c32a7ad846d64e2e539106cda56e2eab9fb749abfcbe8`. The original stays outside Git. The existing exact-publication-timestamp and complete first-seven-day contracts remain unchanged. Lifetime impressions from one owner-export observation date are a distinct proposed evidence class; they never stand in for seven-day impressions.

Proposed source-policy ID: `linkedin-member-owner-export-lifetime-image-v1-candidate`. Status: **unissued**. An owning source-policy decision must independently bind the exact source and schema hashes, account/member identity, each canonical `ugcPost` or `share` entity, the verified owner-export observation date, the directly reported **lifetime impressions** field definition, rights and privacy review, permitted use, private storage location, access, issued time, explicit expiry, deletion/refresh instruction, and an approval receipt from the owning store. A policy-shaped argument in local code cannot issue this approval. No observation date, expiry, account verification, or retention authority is inferred from the filename or workbook alone.

The proposed portfolio governance ceiling is delete or refresh within **at most 30 days**, if an authorized owner activates it with a concrete issued and expiry time. It is inactive now and is not a LinkedIn requirement. Owner-directed deletion invalidates the source and all derived cohort conclusions. A refresh requires a distinct newly hashed export, a new observation and source-policy review, and immediate rollback to **Unscored** pending approval. Source/schema drift or expired approval has the same rollback. A private store must have a demonstrable delete path before any persistence is considered.

## Cohort rule under review

Each target requires at least **five other distinct** eligible comparables. All six or more posts must have the same independently verified member account, `image` format, exact canonical entity identity, one verified owner-export observation date, directly reported lifetime impressions, an approved topic decision, and an approved promise-class decision. The maturity threshold and finite age band must be explicit in the policy. Publication is only day precision; the constructor conservatively bounds age by one day on either side, and both bounds must fall inside the band. It does not invent a publication timestamp or normalize impressions by age.

No row qualifies on a missing denominator, inferred window, cross-account or cross-format match, ambiguous entity, immature age, absent topic/promise ruling, unsupported metric equivalence, unverified rights or privacy, unissued owning policy, source drift, or unstable age effect. One observation cannot establish metric stability over time. A future authority review must assess whether within-band age effects preserve useful rank and whether a band change reverses conclusions. Until that is established, every cohort remains **Unscored**. The pure constructor in `scripts/research/linkedin_lifetime_cohort_shadow.py` has no scorer, receipt, packet link, persistence, calendar, notification, provider, or external-execution path.

## Shadow calibration on retained source

The local read verified the exact source hash and pinned schema and observed six image rows with explicit `ugcPost`/`share` identities. The table contains aggregate review outcomes only; no row identity, date, impression value, or ranking is published. The observation date, account attestation, topic/promise decisions, rights/retention approval, owning source-policy receipt, and stability evidence were not supplied to this lane. These candidates are alternatives for review, not authorized thresholds.

| Candidate | Minimum maturity | Inclusive age band | Eligible sample | Unresolved cases | Unsupported-change rate | Metric stability / rank sensitivity | Outcome |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| C1 | 7 days | 8–30 days | 0 | 6 | 6/6 | Unassessable from one unapproved observation | Unscored |
| C2 | 14 days | 15–60 days | 0 | 6 | 6/6 | Unassessable from one unapproved observation | Unscored |
| C3 | 30 days | 31–90 days | 0 | 6 | 6/6 | Unassessable from one unapproved observation | Unscored |

Here, “unsupported change” means a proposed change from the current Unscored state would lack required authority; it does **not** mean a production record was changed. All six rows retain Unscored status for each candidate. We cannot rank the candidates by performance because the necessary age-effect and repeat-observation evidence is absent. The synthetic six-row fixture proves that five *other* comparables could form a review-only cohort if every independent gate were satisfied; five total rows fail. Even the synthetic valid result issues no score or receipt.

## Captain review and stop conditions

The only live-source operation was a local, read-only parse of the retained workbook. Its bytes, metric values, row identities, and private path were not copied into Git, a PR, or the report. No extra LinkedIn collection, provider analytics, credential setup, upload, scheduling, posting, notification, production mutation, or deployment occurred. Stop at this review packet on insufficient comparables, unstable age effects, unsupported metric equivalence, privacy/rights ambiguity, source/schema drift, raw-source exposure, or failed checks. A future proposal needs an authorized source-policy decision and a fresh private calibration with repeat observations before any scoring integration can be considered.
