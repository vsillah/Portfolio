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

## Canonical Workflow Contract

The Social Content detail page, final review packet, and Kanban links must project the same canonical workflow state. Do not create a duplicate per-draft tracker or a separate human task for each visual decision.

Use this sequence:

1. Context complete: attributable source basis, audience and voice calibration, claims or constraints, and intended channel.
2. Copy generated and reviewed.
3. Visuals, rights, and privacy: Amina selects the visual strategy, prepares or reuses candidates, records provenance, and runs agent QA.
4. Platform draft handoff.
5. Explicit submit gate.
6. Status signals after the approved platform action.

Context is a required upstream step. If an approved Agentified draft cites a source packet or Amina challenger record but still shows Context as pending, run a read-only data/state audit first. If the underlying source basis exists, the UI should show `Context recorded` with source links and any migration note. If the source basis is genuinely missing, show it as a blocker with the recovery action; do not silently backfill production rows.

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

## Amina Visual Strategy And Selection

Amina owns visual strategy and selection for the approved Agentified package. Vambah should not have to prescribe whether each draft needs an illustration, carousel, diagram, framework visual, or photo-led composition.

Given approved copy, recorded context, approved brand/source assets, and channel constraints, Amina should:

- choose the appropriate visual form for each draft or batch,
- reuse or derive from approved Portfolio, Agentified, or AmaduTown assets when suitable,
- generate a new internal candidate only when existing assets fail suitability,
- record the rationale and provenance for the selected pattern and source assets,
- run agent QA against the suitability criteria,
- revise within bounded limits when QA fails,
- advance automatically to batch human visual/privacy review when the evidence passes.

Normal passed assets should return as one batch-level final visual/privacy review packet. Escalate only when there is rights or privacy uncertainty, an unsupported claim, low confidence or failed QA, a budget threshold, an external provider boundary, or a scheduling/publication boundary.

## Research-To-Creation Input

Amina should use approved, public-safe outlier social research for comparable creators and personas as pattern input, not as material to copy.

Transferable patterns can include:

- topic framing,
- hook type,
- content format,
- narrative structure,
- visual grammar,
- CTA shape,
- cadence,
- observable engagement signals.

The output must be original and grounded in Portfolio, Agentified, and AmaduTown context. Do not reproduce another creator's copy, distinctive illustration, thumbnail composition, proprietary asset, or brand identity.

Each Amina decision record must preserve:

- the research pattern used,
- the Portfolio-specific evidence or context,
- the selected visual form and rationale,
- source asset provenance,
- originality, rights, privacy, and platform-terms checks,
- the agent QA result and any bounded revision notes.

Source permission, rights/privacy uncertainty, and platform-terms risk are escalation exceptions.

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
