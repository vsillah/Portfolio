import { describe, expect, it } from 'vitest'
import {
  SOCIAL_VIDEO_ADAPTATION_RECEIPT_KINDS,
  SocialVideoAdaptationError,
  buildSocialVideoAdaptationPacket,
  evaluateSocialVideoAdaptation,
  produceSocialVideoAdaptationInput,
  type SocialVideoAdaptationInput,
  type SocialVideoAdaptationSourceInput,
  type SocialVideoTarget,
} from './social-video-adaptation'

const generatedAt = '2026-10-14T14:00:00.000Z'
const inputVersion = 'sha256:current-artifact-packet'

function receipts(overrides: Partial<Record<string, Record<string, unknown>>> = {}) {
  return Object.fromEntries(SOCIAL_VIDEO_ADAPTATION_RECEIPT_KINDS.map((kind) => [kind, {
    receipt_id: `receipt-${kind}`,
    kind,
    status: 'passed',
    input_version: inputVersion,
    reviewed_at: '2026-10-14T13:00:00.000Z',
    valid_until: '2026-10-21T13:00:00.000Z',
    ...overrides[kind],
  }])) as SocialVideoAdaptationInput['receipts']
}

function scene(input: {
  id: string
  target: SocialVideoTarget
  artifactId: string
  purpose: string
}) {
  return {
    scene_id: input.id,
    target: input.target,
    purpose: input.purpose,
    narration: `This scene explains ${input.purpose} through the approved artifact instead of repeating a social post headline.`,
    claim_ids: ['claim-value'],
    artifact_ids: [input.artifactId],
    source_receipt_ids: ['receipt-source'],
    on_screen_text: [`Evidence: ${input.purpose}`],
    motion_direction: 'Begin on the full artifact, then move deliberately to the evidence region named in the narration.',
  }
}

function fixture(input: {
  productId?: string
  productLabel?: string
  assetType?: SocialVideoAdaptationInput['evidence_assets'][number]['asset_type']
  assetId?: string
  targetDecision?: SocialVideoAdaptationInput['target_decision']
} = {}): SocialVideoAdaptationInput {
  const productId = input.productId ?? 'jev'
  const productLabel = input.productLabel ?? 'Jev'
  const assetId = input.assetId ?? 'operator-dashboard-capture'
  const targetDecision = input.targetDecision ?? 'long_form'
  const targets: SocialVideoTarget[] = targetDecision === 'both'
    ? ['youtube_long_form', 'youtube_shorts']
    : targetDecision === 'shorts'
      ? ['youtube_shorts']
      : ['youtube_long_form']
  const scenes = [
    scene({ id: 'long-hook', target: 'youtube_long_form', artifactId: assetId, purpose: 'the operator problem visible in the dashboard' }),
    scene({ id: 'long-walkthrough', target: 'youtube_long_form', artifactId: assetId, purpose: 'the evidence and decision regions of the operator dashboard' }),
    scene({ id: 'long-value', target: 'youtube_long_form', artifactId: assetId, purpose: 'the practical operator value of traceable decisions' }),
    scene({ id: 'long-close', target: 'youtube_long_form', artifactId: assetId, purpose: 'the bounded next action and receipt trail' }),
    ...(targets.includes('youtube_shorts') ? [
      scene({ id: 'short-hook', target: 'youtube_shorts' as const, artifactId: assetId, purpose: 'the three-second operator tension' }),
      scene({ id: 'short-proof', target: 'youtube_shorts' as const, artifactId: assetId, purpose: 'the visible proof region' }),
      scene({ id: 'short-close', target: 'youtube_shorts' as const, artifactId: assetId, purpose: 'the traceable operating principle' }),
    ] : []),
  ].filter((item) => targets.includes(item.target))
  const longFormScript = [
    `Most people see a polished ${productLabel} artifact. The useful story is the decision trail the artifact makes visible.`,
    'Start with the operator problem. A result can look finished while the source, review state, and next accountable action remain scattered across separate tools.',
    `This approved ${productLabel} evidence gives us something concrete to inspect. The first region shows what entered the workflow. The second makes the decision visible. The third preserves the boundary around what the system may do next.`,
    'That sequence matters because the viewer can distinguish a demonstrated capability from a provider promise or a production action. The artifact carries proof, ownership, and limits together.',
    'Now follow the visual path. We begin wide so the full operating context is legible, move to the evidence region as the claim is introduced, and finish on the receipt trail that lets an operator verify the next action.',
    'The practical value is not another dashboard or decorative diagram. It is less time reconstructing why a decision was made and less ambiguity about who still owns the handoff.',
    'The same test applies to any AI-enabled workflow: show the source, show the decision, show the boundary, and keep the final action human-gated until its separate approval exists.',
    'Use this artifact as a review tool. Ask whether every visible claim has a receipt and whether the motion helps the viewer understand the system instead of adding spectacle.',
  ].join('\n\n')
  const shortsScript = [
    `${productLabel} looks polished, but the useful part is the decision trail behind it.`,
    'Watch the artifact move from source evidence to the operator decision and then to the bounded next action.',
    'That visible receipt trail helps a reviewer separate demonstrated value from provider promises or production activation.',
    'If the source, owner, and gate are visible, the artifact becomes a practical review tool instead of a decorative proof point.',
  ].join(' ')

  return {
    adaptation_id: `adaptation-${productId}`,
    generated_at: generatedAt,
    input_version: inputVersion,
    target_decision: targetDecision,
    identity: {
      campaign_id: 'campaign-operator-proof',
      product_id: productId,
      topic_id: 'topic-traceable-operations',
      source_ids: ['source-product', 'source-proof'],
      channel_packet_ids: ['channel-linkedin', 'channel-youtube'],
    },
    source_channel_packet: {
      campaign_id: 'campaign-operator-proof',
      product_id: productId,
      topic_id: 'topic-traceable-operations',
      source_ids: ['source-product', 'source-proof'],
      channel_packet_ids: ['channel-linkedin', 'channel-youtube'],
      linkedin_copy: 'A dashboard should make the source, decision, and approval boundary visible. That is how an operator can trust the handoff.',
    },
    receipts: receipts(),
    claims: [{
      claim_id: 'claim-value',
      text: `${productLabel} helps operators inspect the evidence, decision, and bounded next action in one traceable flow.`,
      source_receipt_ids: ['receipt-source'],
      proof_receipt_ids: ['receipt-visual', 'receipt-challenger'],
      privacy_boundary: 'Describe only the approved, privacy-safe artifact state; do not imply live provider quality or production activation.',
    }],
    evidence_assets: [{
      asset_id: assetId,
      asset_type: input.assetType ?? 'dashboard_capture',
      label: `${productLabel} approved visual evidence`,
      reference: `/evidence/${productId}/${assetId}.png`,
      source_receipt_ids: ['receipt-source'],
      privacy_receipt_id: 'receipt-privacy',
      rights_receipt_id: 'receipt-rights',
      approved_use: 'Customer-facing walkthrough with only the visible, approved, redacted state.',
    }],
    draft: {
      title_options: [
        { title: `What ${productLabel}'s artifact teaches operators`, targets, promise: 'Walk through the evidence and decision path.', claim_ids: ['claim-value'] },
        { title: 'The receipt trail behind a trustworthy operating decision', targets, promise: 'See the artifact, process, and bounded value.', claim_ids: ['claim-value'] },
      ],
      format_adaptations: targets.map((target) => ({
        target,
        opening_hook: target === 'youtube_long_form'
          ? `Most people see a polished ${productLabel} artifact. The useful story is the decision trail the artifact makes visible.`
          : `${productLabel} looks polished. Can you see the decision trail behind it?`,
        full_spoken_script: target === 'youtube_long_form' ? longFormScript : shortsScript,
        target_duration_seconds: target === 'youtube_long_form' ? 420 : 45,
        adaptation_rationale: target === 'youtube_long_form'
          ? 'The long-form cut teaches the full artifact, process, value, and receipt sequence with time for visual inspection.'
          : 'The Shorts cut compresses the artifact into one tension, one proof path, and one traceable operating principle.',
      })),
      practical_value: 'The walkthrough gives operators a repeatable test for evidence, ownership, and next-action clarity.',
      why_artifact_matters: 'The approved artifact turns an abstract governance claim into an inspectable operating sequence.',
      scenes,
      shot_plan: scenes.map((item, index) => ({
        shot_id: `shot-${index + 1}`,
        scene_id: item.scene_id,
        artifact_id: assetId,
        framing: index === 0 ? 'Full artifact establishing frame' : 'Cropped evidence region with surrounding context retained',
        action: 'Move from context to the exact proof region named in the narration, then pause for inspection.',
        source_receipt_ids: ['receipt-source', 'receipt-visual'],
        privacy_boundary: 'Show only the approved redacted capture; exclude private names, messages, tokens, and unrelated account state.',
      })),
      thumbnail_brief: {
        headline: 'Show the decision trail',
        visual_subject: `One legible crop of the approved ${productLabel} artifact with the evidence-to-decision path highlighted.`,
        artifact_ids: [assetId],
        claim_ids: ['claim-value'],
        source_receipt_ids: ['receipt-source', 'receipt-visual'],
        composition: 'Artifact-first composition with one highlighted decision path and no decorative three-box overlay.',
        mobile_readability_note: 'Keep the artifact crop recognizable at phone size and limit the headline to four words.',
      },
      composition_rationale: {
        dominant_composition: `${productId}-artifact-walkthrough`,
        why_this_structure: 'The approved artifact already contains the operating sequence, so the camera follows its evidence path instead of imposing a generic template.',
        motion_rationale: 'Motion directs attention from source to decision to receipt; pauses give the viewer time to inspect each proof point.',
        recent_approved_compositions: ['generic-three-box', 'quote-card'],
      },
      traceability_summary: 'Every title, scene, shot, claim, and thumbnail reference resolves to the current source, visual, privacy, rights, challenger, and script-quality receipts.',
    },
  }
}

describe('social video artifact adaptation', () => {
  it('turns Jev operator-dashboard evidence into a rich source-bound teaching walkthrough', () => {
    const packet = buildSocialVideoAdaptationPacket(fixture())

    expect(packet.status).toBe('ready_for_render_approval')
    expect(packet.targets).toEqual(['youtube_long_form'])
    expect(packet.draft.scenes).toHaveLength(4)
    expect(packet.draft.shot_plan.every((shot) => shot.artifact_id === 'operator-dashboard-capture')).toBe(true)
    expect(packet.draft.composition_rationale.dominant_composition).toBe('jev-artifact-walkthrough')
    expect(packet.video_generation_bridge).toMatchObject({
      status: 'manual_draft_packet_ready',
      render_gate: 'explicit_approval_required',
      side_effects: {
        provider_generation: false,
        render: false,
        upload: false,
        platform_draft: false,
        schedule: false,
        publish: false,
        external_send: false,
        credential_change: false,
        spending: false,
      },
    })
  })

  it('uses real Dark Castle gameplay evidence for process, value, and traceability in both formats', () => {
    const prepared = fixture({
      productId: 'dark-castle-chess',
      productLabel: 'Dark Castle Chess',
      assetType: 'gameplay_capture',
      assetId: 'dark-castle-gameplay-turn',
      targetDecision: 'both',
    })
    const { draft: _preparedDraft, ...approvedSource } = prepared
    const produced = produceSocialVideoAdaptationInput({
      ...approvedSource,
      source_version: 'social_video_adaptation_source_v1',
      artifact_semantics: {
        product_label: 'Dark Castle Chess',
        subject_label: 'Dark Castle gameplay decision',
        audience_problem: 'A gameplay clip can show a move without helping a learner understand the decision, response, and traceable lesson behind it.',
        operating_tension: 'The board position looks simple until the player must explain why one move teaches more than another.',
        practical_value: 'The adaptation lets a learner inspect the position, follow the product response, and connect the move to a repeatable decision principle.',
        why_artifact_matters: 'The real gameplay capture proves the teaching sequence through visible interaction instead of substituting a logo or promotional poster.',
        closing_principle: 'Gameplay earns attention when the viewer can trace the position, decision, response, and lesson without invented outcomes.',
        thumbnail_promise: 'See the decision, not only the move',
        evidence_regions: [
          { region_id: 'board-position', asset_id: 'dark-castle-gameplay-turn', label: 'starting board position', description: 'The visible position before the learner commits to a move.', claim_ids: ['claim-value'], on_screen_text: '1. Read the position' },
          { region_id: 'decision-response', asset_id: 'dark-castle-gameplay-turn', label: 'decision and product response', description: 'The recorded move and the product feedback that follows it.', claim_ids: ['claim-value'], on_screen_text: '2. Inspect the response' },
          { region_id: 'learning-trace', asset_id: 'dark-castle-gameplay-turn', label: 'traceable learning outcome', description: 'The visible connection between the move, feedback, and reusable lesson.', claim_ids: ['claim-value'], on_screen_text: '3. Carry the lesson forward' },
        ],
        process_steps: [
          { step_id: 'read-position', label: 'Read the position', description: 'Establish the real board state and the choice the learner faces before explaining the system response.', claim_ids: ['claim-value'], evidence_region_ids: ['board-position'] },
          { step_id: 'inspect-response', label: 'Inspect the decision response', description: 'Follow the recorded move into the visible product feedback without inventing gameplay or outcome claims.', claim_ids: ['claim-value'], evidence_region_ids: ['decision-response'] },
          { step_id: 'trace-lesson', label: 'Trace the learning value', description: 'Connect the visible response to the repeatable decision principle the learner can use in a future position.', claim_ids: ['claim-value'], evidence_region_ids: ['learning-trace'] },
        ],
        recent_approved_compositions: ['dashboard_evidence_path', 'generic-three-box'],
      },
    } satisfies SocialVideoAdaptationSourceInput)
    const packet = buildSocialVideoAdaptationPacket(produced)

    expect(packet.targets).toEqual(['youtube_long_form', 'youtube_shorts'])
    expect(packet.evidence_assets[0]).toMatchObject({ asset_type: 'gameplay_capture', asset_id: 'dark-castle-gameplay-turn' })
    expect(packet.draft.scenes.filter((scene) => scene.target === 'youtube_long_form')).toHaveLength(6)
    expect(packet.draft.scenes.filter((scene) => scene.target === 'youtube_shorts')).toHaveLength(3)
    expect(packet.draft.composition_rationale.dominant_composition).toBe('gameplay_decision_sequence')
    expect(packet.draft.format_adaptations.find((item) => item.target === 'youtube_long_form')?.full_spoken_script).toContain('Inspect the decision response')
    const shorts = packet.draft.format_adaptations.find((item) => item.target === 'youtube_shorts')!
    const shortsOpening = 'The board position looks simple until the player must explain why one move teaches more than another.'
    expect(`${shorts.opening_hook} ${shorts.full_spoken_script}`.split(shortsOpening)).toHaveLength(2)
    expect(shorts.full_spoken_script).not.toContain(shortsOpening)
    expect(packet.draft.practical_value).toContain('learner')
    expect(packet.draft.traceability_summary).toContain('approved source identities')
  })

  it('rejects a packet that merely reformats its LinkedIn copy', () => {
    const input = fixture({ targetDecision: 'shorts' })
    input.draft.format_adaptations[0].full_spoken_script = input.source_channel_packet.linkedin_copy

    const readiness = evaluateSocialVideoAdaptation(input)

    expect(readiness.ready).toBe(false)
    expect(readiness.blockers).toContain('youtube_shorts script merely restates the LinkedIn copy instead of adapting the artifact for video.')
    expect(() => buildSocialVideoAdaptationPacket(input)).toThrow(SocialVideoAdaptationError)
  })

  it('remains product-generic instead of hard-coding the acceptance examples', () => {
    const packet = buildSocialVideoAdaptationPacket(fixture({
      productId: 'future-product',
      productLabel: 'Future Product',
      assetType: 'workflow_capture',
      assetId: 'future-workflow-proof',
    }))

    expect(packet.identity.product_id).toBe('future-product')
    expect(packet.evidence_assets[0].asset_type).toBe('workflow_capture')
    expect(packet.draft.format_adaptations[0].opening_hook).toContain('Future Product')
  })

  it('fails closed when receipts are missing, stale, expired, or do not clear asset rights', () => {
    const input = fixture()
    delete input.receipts.voice
    input.receipts.framework = { ...input.receipts.framework!, input_version: 'sha256:old' }
    input.receipts.challenger = { ...input.receipts.challenger!, valid_until: '2026-10-13T13:00:00.000Z' }
    input.evidence_assets[0].rights_receipt_id = 'receipt-rights-old'

    expect(evaluateSocialVideoAdaptation(input).blockers).toEqual(expect.arrayContaining([
      'Required voice receipt is missing.',
      'framework receipt is stale for the current input version.',
      'challenger receipt expired before this packet was generated.',
      'Evidence artifact operator-dashboard-capture is missing current privacy or rights clearance.',
    ]))
  })

  it('fails closed when a claim, scene, shot, or thumbnail loses source lineage', () => {
    const input = fixture()
    input.claims[0].proof_receipt_ids = ['missing-proof']
    input.draft.scenes[0].claim_ids = ['missing-claim']
    input.draft.shot_plan[0].artifact_id = 'missing-artifact'
    input.draft.thumbnail_brief.source_receipt_ids = ['receipt-source']

    expect(evaluateSocialVideoAdaptation(input).blockers).toEqual(expect.arrayContaining([
      'Claim claim-value is not bound to current proof receipts.',
      'Scene long-hook has missing or invalid claim bindings.',
      'Every shot must bind a unique shot identity to a valid scene and evidence artifact.',
      'Thumbnail or cover brief requires current source and visual receipts.',
    ]))
  })

  it('requires an artifact-specific rationale before reusing a recent composition', () => {
    const input = fixture()
    input.draft.composition_rationale.recent_approved_compositions = ['jev-artifact-walkthrough']

    expect(evaluateSocialVideoAdaptation(input).blockers).toContain(
      'A recently approved composition cannot be reused without an artifact-specific rationale.',
    )
  })
})
