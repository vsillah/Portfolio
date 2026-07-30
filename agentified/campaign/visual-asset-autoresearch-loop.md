# Agentified visual asset AutoResearch loop

Status: Operating spec
Date: 2026-07-29
Lane: Portfolio Content Strategy
Primary owners: Taharqa for brand direction, Hannibal for asset packet assembly, Idia for visual suitability, Moremi for privacy and rights review
Mode: Human gated

## Purpose

This loop governs what happens when the current Portfolio, AmaduTown, or Agentified assets are not suitable for an approved social draft.

The loop should answer one practical question before a new asset moves forward:

Can we reuse or derive from an approved asset, and if not, can we create a new candidate that passes suitability review before a human sees it?

This process does not publish, schedule, upload, send outreach, change production settings, or submit anything to LinkedIn. Provider generation remains separately approval-gated unless Vambah explicitly authorizes that scoped action.

## Relationship to AutoResearch

This mirrors the Portfolio AutoResearch pattern:

1. Start with a bounded proposal.
2. Attach source evidence and provenance.
3. Generate or derive one candidate at a time.
4. Score the candidate against explicit gates.
5. Record pass, fail, and revision reasons.
6. Continue only while the next iteration is justified.
7. Stop for human approval, budget limit, provider authorization, or unresolved risk.

The result is a visual decision packet, not an autonomous publishing action.

## Source-first rule

Every visual task starts with a source audit before generating anything new.

Required source classes:

- Portfolio public assets in `public/`, `design-files/`, and relevant admin/product screenshots.
- Agentified manuscript visuals, rendered figures, cover comps, prompt briefs, and source maps.
- AmaduTown company materials from the connected Google Drive company folders.
- Approved campaign packet, draft copy, CTA, and source basis for the specific asset.

If an existing source asset is suitable, the loop stops and records the source path, use case, and any required crop or derivative treatment.

## Suitability gates

A candidate must pass all gates before it can be marked safe for human visual review.

| Gate | Pass condition | Owner |
| --- | --- | --- |
| Brand fit | Matches AmaduTown visual system, tone, and campaign intent. | Taharqa |
| Message alignment | Supports the approved draft without changing the claim or CTA. | Hannibal |
| Source provenance | Source paths, prompts, derivation notes, and provider/model details are recorded. | Askia |
| Legibility | Works at LinkedIn feed dimensions and mobile crop; text is readable or absent. | Idia |
| Accessibility | Alt-text draft is ready; contrast and semantic intent are clear. | Idia |
| Privacy and rights | No private data, raw manuscript leakage, client material, screenshots, or unlicensed third-party use. | Moremi |
| Visual quality | No obvious artifacts, warped text, wrong logos, broken hands/faces, or low-resolution output. | Idia |
| Publication boundary | Candidate is review-ready only; publishing and scheduling remain closed. | Shaka |

## Loop states

| State | Meaning | Allowed next action |
| --- | --- | --- |
| `source_audit` | Existing assets are being searched and evaluated. | Reuse, derive, or mark source unsuitable. |
| `candidate_spec_ready` | The visual brief, source map, format, and suitability rubric are ready. | Ask for provider-generation authorization if needed, or generate via approved local process. |
| `candidate_generated` | One candidate exists with source and generation metadata. | Run agent suitability QA. |
| `qa_blocked` | Candidate failed one or more gates. | Record failure reason and create a revised candidate spec. |
| `qa_passed` | Candidate passed all agent gates. | Route to human visual/privacy review. |
| `human_review_ready` | Human can review the candidate with provenance and QA findings. | Approve, revise, hold, or reject. |
| `blocked` | Budget, rights, privacy, provider, or source risk prevents another iteration. | Stop and escalate with the exact blocker. |

## Candidate packet fields

Each iteration should record:

- draft id and asset id,
- campaign id and campaign phase,
- approved copy and CTA snapshot,
- intended platform and dimensions,
- source assets searched,
- selected source or reason no source was suitable,
- visual hypothesis,
- prompt or derivation instructions,
- provider or local render path,
- provider authorization status,
- candidate URL or file path,
- visual QA score,
- failed gates and reason codes,
- revision instruction for the next attempt,
- cost estimate or actual cost when available,
- idempotency key,
- human gate status.

## Iteration rules

One loop cycle is:

1. Build a candidate spec from the approved draft and source audit.
2. Confirm whether the next step is local derivation or provider generation.
3. If provider generation is needed, stop unless that provider action is explicitly authorized.
4. Create one candidate.
5. Run Idia suitability scoring and Moremi privacy/rights review.
6. If the candidate fails, write a revision note tied to the failed gates.
7. Repeat only if the revision note is specific and the iteration budget is still open.
8. Mark `human_review_ready` only after all agent gates pass.

Default limits:

- maximum 3 candidate attempts per draft before escalation,
- maximum 1 provider call per attempt,
- no provider call without explicit scoped approval,
- no use of private or client-specific material as visual source,
- no publish, schedule, upload, or platform submission from this loop.

## Portfolio implementation target

The existing `visual_asset_candidates` table and Idia candidate scoring path can be reused for the scoring and reason-code model. Social Content needs an adjacent candidate ledger for campaign visuals because the current `regenerate-image` route updates a prompt and calls n8n once, but does not preserve a full attempt history or AutoResearch-style suitability loop.

Recommended implementation backlog item:

Title: `Visual asset suitability AutoResearch loop`

Owner lane: Course and Video Production with Portfolio Content Strategy support

Implementation owners:

- Taharqa: brand and prompt constraints,
- Hannibal: social asset packet shape,
- Idia: candidate scoring and visual QA,
- Moremi: privacy, rights, and publication boundary,
- Piye: API, schema, and UI implementation,
- Yaa Asantewaa: n8n/provider boundary and idempotency.

Acceptance criteria:

- Social Content has a candidate history for visual assets with source provenance, generation metadata, QA findings, and human gate status.
- Existing source assets are evaluated before any new provider generation is proposed.
- Failed candidates record specific reason codes and next-attempt guidance.
- The UI shows the latest candidate plus compact iteration history.
- `Approve Visuals` remains disabled until agent suitability and privacy review pass.
- Provider generation, publishing, scheduling, uploads, and platform submission remain separately approval-gated.
- Tests cover source-audit fallback, candidate failure, repeat attempt, budget stop, provider authorization stop, and human-review-ready pass.

## Human gate

Human approval can choose:

- approve this visual for the draft,
- revise with feedback,
- hold for source or rights clarification,
- reject and stop further attempts.

Human approval of a visual authorizes only the visual for the draft review path. It does not authorize external publishing, scheduling, provider submission, paid promotion, or production-setting changes.
