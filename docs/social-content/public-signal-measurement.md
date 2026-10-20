# Official public signal measurement

The existing Social Content coverage intake prepares measurements for pending OpenAI and Meta research packets. It reads approved public research packets containing `actor_metadata.public_signal_observation`. It never approves an official packet or fills the pending momentum scores.

An observation must be a separately reviewed, attributable public research packet. Its `source_url` must be an HTTPS public page and must exactly match the observation's `source_url`. The observation contract is:

```json
{
  "version": "public_signal_observation_v1",
  "coverage_identity": "the official packet's exact coverage_identity",
  "source_url": "https://public.example.org/exact-page",
  "observed_at": "2026-10-20T12:00:00.000Z",
  "expires_at": "2026-10-25T12:00:00.000Z",
  "public_attention": { "observed": 80, "required": 100 },
  "relevance": { "observed": 9, "required": 10 }
}
```

The observed and required values must be recorded from the public source with a defensible denominator. The producer computes each normalized score as `min(1, observed / required)`, rounded to four decimals. It takes the mean across sources, rounded to four decimals. Both means must reach `0.65`. Three unique attributable source URLs on at least two hosts are required, including the official release URL. The observation window and expiry are capped at seven days. A source marked `excluded`, a mismatched URL or identity, an unapproved packet, an expired observation, or a missing denominator contributes no score.

Successful receipts include stable official and source packet identities, exact values and denominators, source fingerprints, formula, timestamps, source URLs, thresholds and a content hash. They live only in `actor_metadata.public_signal_measurement_receipt` on the pending official packet. Existing receipts are never replaced automatically. The existing review route revalidates the stored receipt before a human can approve the packet.

When evidence is insufficient, the official packet stays `review_ready` with `public_signal_measurement_state.status = "Unscored"`. The state records the observed and required values, evidence fingerprint, owner `social_content_research`, and a maximum of three changed-evidence attempts. Unchanged evidence causes no new write or retry. After three attempts, the owner must review the evidence or packet manually. No public observations are inferred from an official announcement, a research outlier score, or an unattributed source.

This phase adds no production run, candidate projection, provider call, content generation, publication or external send. Intake can prepare receipts during a future authorized coverage sweep; actual source observations and reviewer approval remain separate gates.
