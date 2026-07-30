# Agentified Visual AutoResearch

Status: internal preparation only
Owner lane: Content Strategy / Visual Production
Captain gate: required before merge, deployment, provider handoff, scheduling, or publishing

## Purpose

Agentified visual work should use the same operating shape as Model Ops AutoResearch:

1. start from approved source material,
2. search for existing suitable assets,
3. score candidates against explicit suitability criteria,
4. write a traceable QA packet,
5. revise or generate only when the current candidates fail,
6. stop at human visual/privacy approval before provider handoff or publication.

This process applies to Agentified LinkedIn visuals, carousel assets, thumbnails, and short-form cover frames.

## Source Order

Use approved assets before creating new imagery.

1. Portfolio repo assets:
   - `public/agentified-cover.svg`
   - `public/agentified-cover.jpg`
   - `public/amadutown-logo-upscaled.png`
   - `agentified/manuscript/visuals/rendered/**`
   - `agentified/source-assets/**`
   - `docs/agentic-content-review-packets/**`
   - `agentified/campaign/**`
2. AmaduTown Google Drive materials:
   - `/Users/vambahsillah/Library/CloudStorage/GoogleDrive-vsillah@gmail.com/My Drive/2. AmaduTown Advisory Solutions/`
   - `/Users/vambahsillah/Library/CloudStorage/GoogleDrive-vsillah@gmail.com/My Drive/2. AmaduTown Advisory Solutions/Artifacts /Company Materials/`
3. New imagery only after the source-audit packet marks existing candidates as unsuitable.

## Suitability Criteria

Each candidate must be checked for:

- Brand fit and Agentified message alignment.
- Consistency with the approved draft copy and source packet.
- LinkedIn feed dimensions, mobile crop, and legibility.
- Accessibility and alt-text readiness.
- Privacy, rights, and source provenance.
- Visual quality and artifact risk.
- Human-review readiness.

Any blocker keeps the asset out of provider handoff. A failed candidate can be revised, regenerated, or replaced, but the next candidate must receive a fresh QA packet.

## Loop Contract

```text
approved draft
  -> source search
  -> candidate shortlist
  -> QA packet
  -> pass?
       yes -> human visual/privacy review
       no  -> revise/generate replacement candidate
  -> repeat until pass, budget stop, or human decision
```

## Local Packet Generator

Run:

```bash
npm run agentified:visual-source-audit
```

Default output:

- `docs/agentified-visual-qa/agentified-visual-source-audit-YYYY-MM-DD.md`
- `docs/agentified-visual-qa/agentified-visual-source-audit-YYYY-MM-DD.json`

The generator is read-only with respect to production systems. It reads local repo assets and Google Drive-synced file paths, then writes a local review packet. It does not publish, schedule, upload media, create provider drafts, or mutate database rows.

## Escalation Rules

- If no candidate passes source suitability, create a new internal visual candidate with source provenance and mark it `generated_candidate_pending_qa`.
- If privacy, rights, or factual consistency is unclear, stop at human review.
- If the requested asset needs paid provider generation, stop at a provider/budget gate.
- If a candidate passes agent QA, it is eligible only for human visual/privacy approval.

## Captain Closeout Requirements

Before this lane can be merged, the captain report must include:

- source roots searched,
- draft IDs covered,
- candidate paths selected or rejected,
- pass/fail findings by draft,
- generated packet path,
- validation command output,
- remaining human gates.
