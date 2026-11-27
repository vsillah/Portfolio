# Jev YouTube acquisition identity reconciliation — review only

**Status:** blocked; no identity correction, seed edit, exclusion override, policy approval, or evidence linkage.

## Exact binding

- Social Content: `f966123f-05eb-48ec-a7c2-970afce642ef`
- Calendar item: `669f6c22-d373-4423-bf7c-77661c484302`
- Approved seed: `cohort.json`, stable-content SHA-256 `bdb9262ff106932123661a90c35d812753008952eee65635878d4642276bbf8c`
- Single read-only acquisition: observed `2026-11-26T22:21:21.387Z`; response receipt SHA-256 `34712a8fac5f1f808f2805f8fe05e6604678c2d2b39dc1fb527cd4ab056f5c69`; HTTP 409; 81 provider response hashes; zero included records.

The bridge returned `Fewer than five attributable comparables share one current audience band.` All eight seed comparables received the same narrower exclusion: `Comparable publication or Shorts identity differs from the approved seed.` The route first checked exact video ID, channel ID, public status, 15–60 second duration, parseable publication time, and public views. The narrower exclusion therefore occurred at its subsequent combined comparison of `publishedAt` and `duration` with the seed. It does **not** identify which of those two fields differed.

| Seed video ID | Seed channel ID | Seed publication | Seed duration | Current acquisition decision |
| --- | --- | --- | ---: | --- |
| `gTHQpAkgjy4` | `UCIdKG8UrW1PcTQF7ncmHpKw` | `2025-04-18T12:01:22.000Z` | 54 s | Excluded; publication or duration mismatch, exact field unknown |
| `usE8BPWET3M` | `UC0O0NkJFTSufNGiYEMXbSWg` | `2026-10-04T02:33:08.000Z` | 18 s | Excluded; publication or duration mismatch, exact field unknown |
| `_ODSVV3SIEI` | `UCV8Ukjbe-7VpMSbtTXjh0_Q` | `2024-11-28T17:17:47.000Z` | 39 s | Excluded; publication or duration mismatch, exact field unknown |
| `ZAdGsLGaGSU` | `UC5Vw2SKzV0o7sMyR24q2D_g` | `2026-10-17T07:00:11.000Z` | 51 s | Excluded; publication or duration mismatch, exact field unknown |
| `ojpZ-TJv918` | `UCRpkfHKgj-wzK36FpI8iukA` | `2026-07-14T02:56:21.000Z` | 29 s | Excluded; publication or duration mismatch, exact field unknown |
| `sA6UA2fMNHg` | `UCKWaEZ-_VweaEx1j62do_vQ` | `2025-02-22T13:01:15.000Z` | 45 s | Excluded; publication or duration mismatch, exact field unknown |
| `SQEMkQu0b6o` | `UCcWMDJeI1AKhNlgATr1_m7A` | `2026-09-08T15:47:57.000Z` | 21 s | Excluded; publication or duration mismatch, exact field unknown |
| `DVEOS9t_DHM` | `UCJ3oB3ghEUdGhHnXZD4Dx3g` | `2026-10-06T21:49:28.000Z` | 32 s | Excluded; publication or duration mismatch, exact field unknown |

## What the receipt can prove

The merged `lib/youtube-readonly-evidence-acquisition.ts` hashes the raw provider response bytes in process memory, then returns `provider_responses` entries with object IDs, HTTP status, and body SHA-256. It does not return or persist the raw provider bodies. The acquisition result also did not expose each candidate's current `publishedAt` and `duration` after that combined comparison failed. A hash cannot reveal those values. The 81 original raw bodies were not found in the repo or the narrowly relevant production research/source-receipt rows. The response summary was retained only in the authenticated browser session, which was unavailable during this review because the Mac was locked. Even that summary contains hashes, not raw provider bodies.

There is consequently no source-supported field-level correction for any of the eight identities. In particular, `.000Z` in the seed must not be treated as equivalent to a provider timestamp without the original provider value and a policy for canonical timestamp comparison. The seed and all historical receipts remain unchanged.

## Freshness and rights/privacy candidate status

| Candidate | Binding available | Missing authority | Decision |
| --- | --- | --- | --- |
| YouTube external-creator public-metrics freshness/expiry | Target IDs, acquisition receipt hash, observed time | Approved exact source-class policy ID/version, authority receipt and policy hash, raw-response/observation binding, explicit expiry rule and `expires_at` | **Not issuable.** `expires_at` stays null; observation time or the old seed expiry cannot supply it. |
| Comparable public-metadata privacy and rights | Eight seed URLs/channel IDs and historical topic inclusion decisions | Approved receipt for these exact newly observed response versions, permitted use, reviewer/authority, privacy classification, and rights basis | **Not issuable.** No external-creator clearance is inferred. |

`docs/release-calendar-source-freshness.md` requires an independently evidenced, exact-version `source_freshness_receipt`; it explicitly rejects deriving expiry from retrieval, review, or modification time. `lib/attributable-performance-evidence.ts` requires an approved, version-bound `SourceClassPolicy` with explicit `expires_at` and approval hash. No matching approved YouTube external-creator policy was found in the scoped repo search or the relevant production receipt tables. Existing `privacy:jev:public-safe-20261014` and `rights:jev:owned-public-assets-20261014` apply to Jev's owned assets and do not authorize third-party comparable metrics or media use. A production source receipt for `docs/jev-shadow/README.md` is a public-safe repository summary, not this comparison cohort.

Both non-issuable candidates are pinned to `acquisition_receipt_sha256=34712a8fac5f1f808f2805f8fe05e6604678c2d2b39dc1fb527cd4ab056f5c69` and `observed_at=2026-11-26T22:21:21.387Z`. The freshness candidate's source class is `external_creator`, platform `youtube`, format `shorts`, with `approved=false`, `policy_id=null`, `policy_version=null`, `raw_response_sha256=null`, and `expires_at=null`. The privacy/rights candidate has `approved=false`, `authority_receipt_id=null`, and no claim of permitted third-party use. These fields describe missing evidence; they are not approval receipts.

## Stop and recovery gate

No live acquisition was repeated. No title, thumbnail, packet, calendar, credential, provider setting, publication, notification, or external-execution state was changed. To reconcile the eight rows, a separately authorized process must retain the exact provider `videos.list` raw response bytes for each approved video ID, verify each body's SHA-256 against its original response hash if that hash can be recovered, and compare its canonical video ID, channel ID, `snippet.publishedAt`, `contentDetails.duration`, public status, and Shorts classification against the seed one field at a time. Missing raw bytes or a hash mismatch blocks correction. A source owner must separately approve the exact-version freshness policy and comparable privacy/rights receipts before qualification. A further live provider read is a new acquisition and needs separate authorization.
