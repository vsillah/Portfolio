# Official public signal measurement

The Social Content **Launch evidence → Official public signal preparation** panel is the operator entry point. An authenticated Portfolio admin can check the allowlisted official OpenAI and Meta public sources, record an exact public observation for separate review, inspect receipts and blocked reasons, and prepare a measurement for one selected pending official packet. The server route is `/api/admin/social-content/source-coverage/official-signals`. Its GET is read-only; POST accepts only `collect_official`, `intake_observation`, or `measure`. Operators do not need Codex, a shell, or a module import. No action here approves an official packet or fills its pending momentum scores.

An observation must be a separately reviewed, attributable public research packet. Its `source_url` must be an HTTPS public page and must exactly match the observation's `source_url`. Intake creates a `review_ready` research packet with a stable observation identity and official packet binding. A reviewer verifies its source, values, denominators, and freshness in the existing Content Intelligence research review. Only an approved observation with that review receipt can contribute to measurement. The observation contract is:

```json
{
  "version": "public_signal_observation_v1",
  "coverage_identity": "the official packet's exact coverage_identity",
  "source_url": "https://public.example.org/exact-page",
  "observed_at": "2026-10-20T12:00:00.000Z",
  "expires_at": "2026-10-25T12:00:00.000Z",
  "public_attention": { "observed": 80, "required": 100 },
  "relevance": { "observed": 9, "required": 10 },
  "evidence_note": "Describe where both exact values and denominators appear on this public page."
}
```

The observed and required values must be recorded from the public source with a defensible denominator. The producer computes each normalized score as `min(1, observed / required)`, rounded to four decimals. It takes the mean across sources, rounded to four decimals. Both means must reach `0.65`. Three unique attributable source URLs on at least two hosts are required, including the official release URL. The observation window and expiry are capped at seven days. A source marked `excluded`, a mismatched URL or identity, an unapproved packet, an expired observation, or a missing denominator contributes no score.

Successful receipts include stable official and source packet identities, exact values and denominators, source fingerprints, formula, timestamps, source URLs, thresholds and a content hash. They live only in `actor_metadata.public_signal_measurement_receipt` on the pending official packet. Existing receipts are never replaced automatically. The existing review route revalidates the stored receipt before a human can approve the packet.

When evidence is insufficient, the official packet stays `review_ready` with `public_signal_measurement_state.status = "Unscored"`. The state records the observed and required values, evidence fingerprint, owner `social_content_research`, and a maximum of three changed-evidence attempts. Unchanged evidence causes no new write or retry. After three attempts, the owner must review the evidence or packet manually. No public observations are inferred from an official announcement, a research outlier score, or an unattributed source.

This phase adds no production run, candidate projection, provider call, content generation, publication or external send. The panel exposes future authorized operator actions; no collection, intake, or measurement was run against production during implementation. The observation identity uniqueness migration must be applied through the Integration Captain migration gate before live intake.
