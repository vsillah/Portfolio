# Social candidate projection contract

## User value

The existing Social Content evidence and topic-backlog workflow turns timely public momentum and active product work into traceable, review-only content opportunities. The projection is recurring and policy-driven. Jev, Dark Castle Chess, and future products qualify through the same receipt rules rather than product-specific exceptions.

## Stable identity join

Every receipt is normalized to one `product_identity`. Candidate projection uses an exact identity join. A matching topic phrase cannot join receipts from different products.

Only approved, privacy-safe summaries with provenance, reviewer, approval timestamp, content hash, and `raw_content_included: false` are eligible.

## Candidate classes

| Candidate class | Required receipts | Current acceptance case |
| --- | --- | --- |
| `public_momentum_repository` | One fresh approved public-news or social-trend receipt and one approved repository document or implementation receipt with the same product identity | Jev |
| `active_github_product` | One approved app/product catalog receipt and one current read-only GitHub activity receipt with the same product identity | Dark Castle Chess |

The code-level policy registry is `SOCIAL_CANDIDATE_RECEIPT_POLICIES` in `lib/social-trend-work-join.ts`. Missing receipt classes produce a `candidate_receipt_policy_incomplete` blocker with a recovery action. The candidate is not projected until every required class is present.

## Persisted lineage

Each joined candidate retains:

- the candidate class and policy version;
- every joined receipt ID;
- source group, source kind, and source ID;
- exact product identity and lifecycle stage;
- provenance and evidence URL;
- summary hash;
- reviewer and approval, observation timestamps; and
- the explicit no-raw-content flag.

The same metadata helper writes this lineage into the canonical Agent Ops work item and the existing `social_topic_backlog` projection. Candidate keys remain receipt-derived for deduplication. Freshness rules continue to reject stale momentum and stale GitHub activity.

## Boundaries

Projection creates review-only opportunities. It does not generate copy, approve content, call discovery or media providers, render media, upload assets, schedule, publish, send externally, or claim that development activity proves deployment or outcomes.
