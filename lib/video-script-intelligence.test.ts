import { describe, expect, it } from 'vitest'
import jevTemplateRun from '../artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev-killer-script-template-run-v2-presenter-first.json'
import {
  evaluateVideoScript,
  evaluateVideoScriptTemplateRun,
  scriptTemplatePromptBlock,
  SEEDED_VIDEO_SCRIPT_TEMPLATES,
  type VideoScriptTemplateRunReceipt,
} from './video-script-intelligence'

const SHORTS_CONCLUSION = 'Governed automation begins when uncertainty is visible enough to route, review, and refuse.'
const SHORTS_CHANNEL_CTA = 'Subscribe to the channel for more practical ways to govern AI decisions.'
const SHORTS_BODY = 'The problem is that a fluent answer can sound certain even when the model is guessing. Jev uses typed probabilities for a bounded decision. In the Portfolio evaluation workflow I built, the receipt makes the real work visible. Inspect the score, apply the policy, and keep a human owner for exceptions. Operators can review the threshold, owner, and evidence behind the handoff. Use the field guide before a score moves work.'
const CONCLUSION_ORDER_BLOCKER = 'YouTube script must contain a substantive conclusion followed by the bounded channel CTA.'
const CHANNEL_CTA_TAIL_BLOCKER = 'Bounded channel CTA must appear at the end of the YouTube script.'

function shortsTemplateReceipt(input: {
  scriptText?: string
  conclusion?: string
  channelCta?: string
} = {}): VideoScriptTemplateRunReceipt {
  const conclusion = input.conclusion ?? SHORTS_CONCLUSION
  const channelCta = input.channelCta ?? SHORTS_CHANNEL_CTA
  const scriptText = input.scriptText ?? `${SHORTS_BODY} ${conclusion} ${channelCta}`
  return {
    receipt_version: 'video_script_template_run_receipt_v2',
    receipt_id: 'template-run:jev:killer-script:youtube-shorts:v2:20261014',
    status: 'passed',
    input_version: 'sha256:jev-source-v1',
    generated_at: '2026-10-14T22:43:22.000Z',
    target: 'youtube_shorts',
    template_binding: {
      contract_version: 'video_script_template_v1',
      template_id: 'seed-killer-script',
      template_key: 'killer_script',
      template_name: 'Killer script',
    },
    source_binding: {
      source_receipt_id: 'source:jev:approved',
      claim_ids: ['jev-typed-probabilities', 'jev-policy-boundary'],
      evidence_asset_ids: ['jev-operator-field-guide'],
      approved_copy_reference: 'inputs/jev.json#/source_channel_packet/linkedin_copy',
    },
    narrative_map: {
      pain_point: 'A fluent answer can sound certain even when the model is guessing.',
      hook: 'A fluent answer can sound certain even when the model is guessing. Jev uses typed probabilities.',
      open_loop: 'Inspect the score, apply policy, retain ownership, and preserve the receipt.',
      frame: 'A score is an input to a governed decision rather than the decision itself.',
      practitioner_proof: 'In the evaluation harness I built, the workflow keeps the decision receipt visible.',
      explanatory_progression: ['Inspect the score.', 'Apply the policy.', 'Keep a human owner and receipt.'],
      practical_value: 'Operators can inspect the score, threshold, owner, and evidence behind the handoff.',
      cta: 'Use the field guide to review the threshold, owner, and retained receipt before a score moves work.',
      closing_principle: SHORTS_CONCLUSION,
      conclusion,
      channel_cta: channelCta,
    },
    script: {
      text: scriptText,
      sha256: 'sha256:current-script',
      word_count: scriptText.trim().split(/\s+/).filter(Boolean).length,
      expected_duration_seconds: 44,
    },
    prior_script: {
      text: 'A score is not a decision.',
      sha256: 'sha256:prior-script',
      disposition: 'superseded_draft_evidence',
    },
    provider_execution: {
      status: 'blocked_pending_explicit_approval',
      max_provider_jobs: 1,
      no_retry: true,
      cost_ceiling_usd: 9,
      expected_cost_usd: 2.54,
      approval_wording: 'Approve exactly one bounded review job and stop if any binding differs.',
    },
  }
}

function evaluateShorts(receipt: VideoScriptTemplateRunReceipt) {
  return evaluateVideoScriptTemplateRun({
    receipt,
    template: SEEDED_VIDEO_SCRIPT_TEMPLATES[0],
    expectedInputVersion: 'sha256:jev-source-v1',
    expectedScriptSha256: 'sha256:current-script',
    approvedSourceReceiptIds: ['source:jev:approved'],
    approvedClaimIds: ['jev-typed-probabilities', 'jev-policy-boundary'],
    approvedEvidenceAssetIds: ['jev-operator-field-guide'],
  })
}

describe('video-script-intelligence', () => {
  it('blocks scripts with no clear pain point or CTA before render', () => {
    const scorecard = evaluateVideoScript({
      scriptText: 'This is a general lesson about AI and product work.',
      outline: {
        hook: 'AI and product work.',
      },
    })

    expect(scorecard.blockers).toEqual(expect.arrayContaining([
      'Script needs a clearer audience pain point before render.',
      'Script needs an explicit CTA before render.',
    ]))
    expect(scorecard.overall_score).toBeLessThan(60)
  })

  it('passes a source-safe Accelerated script outline with a visible CTA', () => {
    const scorecard = evaluateVideoScript({
      scriptText: 'The problem is that AI can create faster than teams can govern. I built the Portfolio workflow to show the receipt. Join the Accelerated Workshop interest path if you want the operating loop.',
      outline: {
        pain_point: 'AI can create faster than teams can govern.',
        hook: 'AI can create faster than teams can govern.',
        open_loop: 'Show the operating loop that closes the gap.',
        proof_demo: 'I built the Portfolio workflow to show the receipt.',
        cta: 'Join the Accelerated Workshop interest path.',
        source_distance_notes: 'AmaduTown original proof.',
      },
    })

    expect(scorecard.blockers).toEqual([])
    expect(scorecard.cta_clarity).toBeGreaterThanOrEqual(75)
    expect(scorecard.source_distance_safety).toBeGreaterThanOrEqual(75)
  })

  it('adds selected template and research pattern evidence to the prompt block', () => {
    const block = scriptTemplatePromptBlock(
      SEEDED_VIDEO_SCRIPT_TEMPLATES[0],
      [
        {
          title: 'Useful outlier',
          source_url: 'https://youtu.be/IUE8o_e4uCY',
          hook_transcript: 'Most scripts fail because the opening does not name the pain.',
          pattern_packet: {
            hook_structure: 'Name the pain before the lesson.',
            promise_value: 'A repeatable structure.',
            cta_style: 'Ask viewers to apply it.',
          },
        },
      ],
    )

    expect(block).toContain('Selected script template: Killer script')
    expect(block).toContain('Approved public research pattern evidence')
    expect(block).toContain('Use these as outline patterns only')
  })

  it('passes a version-bound Jev Shorts template run while keeping provider execution blocked', () => {
    const passingScript = 'The problem is that a fluent answer can sound certain even when the model is guessing. Jev uses typed probabilities for a bounded decision. In the Portfolio evaluation workflow I built, the receipt makes the real work visible. Inspect the score, apply the policy, and keep a human owner for exceptions. Operators can review the threshold, owner, and evidence behind the handoff. Use the field guide before a score moves work. Governed automation begins when uncertainty is visible enough to route, review, and refuse. Subscribe to the channel for more practical ways to govern AI decisions.'
    const receipt: VideoScriptTemplateRunReceipt = {
      receipt_version: 'video_script_template_run_receipt_v2',
      receipt_id: 'template-run:jev:killer-script:youtube-shorts:v2:20261014',
      status: 'passed',
      input_version: 'sha256:jev-source-v1',
      generated_at: '2026-10-14T22:43:22.000Z',
      target: 'youtube_shorts',
      template_binding: {
        contract_version: 'video_script_template_v1',
        template_id: 'seed-killer-script',
        template_key: 'killer_script',
        template_name: 'Killer script',
      },
      source_binding: {
        source_receipt_id: 'source:jev:approved',
        claim_ids: ['jev-typed-probabilities', 'jev-policy-boundary'],
        evidence_asset_ids: ['jev-operator-field-guide'],
        approved_copy_reference: 'inputs/jev.json#/source_channel_packet/linkedin_copy',
      },
      narrative_map: {
        pain_point: 'A fluent answer can sound certain even when the model is guessing.',
        hook: 'A fluent answer can sound certain even when the model is guessing. Jev uses typed probabilities.',
        open_loop: 'Inspect the score, apply policy, retain ownership, and preserve the receipt.',
        frame: 'A score is an input to a governed decision rather than the decision itself.',
        practitioner_proof: 'In the evaluation harness I built, the workflow keeps the decision receipt visible.',
        explanatory_progression: ['Inspect the score.', 'Apply the policy.', 'Keep a human owner and receipt.'],
        practical_value: 'Operators can inspect the score, threshold, owner, and evidence behind the handoff.',
        cta: 'Use the field guide to review the threshold, owner, and retained receipt before a score moves work.',
        closing_principle: 'Governed automation begins when uncertainty is visible enough to route, review, and refuse.',
        conclusion: 'Governed automation begins when uncertainty is visible enough to route, review, and refuse.',
        channel_cta: 'Subscribe to the channel for more practical ways to govern AI decisions.',
      },
      script: {
        text: passingScript,
        sha256: 'sha256:current-script',
        word_count: passingScript.split(/\s+/).length,
        expected_duration_seconds: 44,
      },
      prior_script: {
        text: 'A score is not a decision.',
        sha256: 'sha256:prior-script',
        disposition: 'superseded_draft_evidence',
      },
      provider_execution: {
        status: 'blocked_pending_explicit_approval',
        max_provider_jobs: 1,
        no_retry: true,
        cost_ceiling_usd: 9,
        expected_cost_usd: 2.54,
        approval_wording: 'Approve exactly one bounded review job and stop if any binding differs.',
      },
    }

    const readiness = evaluateVideoScriptTemplateRun({
      receipt,
      template: SEEDED_VIDEO_SCRIPT_TEMPLATES[0],
      expectedInputVersion: 'sha256:jev-source-v1',
      expectedScriptSha256: 'sha256:current-script',
      approvedSourceReceiptIds: ['source:jev:approved'],
      approvedClaimIds: ['jev-typed-probabilities', 'jev-policy-boundary'],
      approvedEvidenceAssetIds: ['jev-operator-field-guide'],
    })

    expect(readiness.ready).toBe(true)
    expect(readiness.blockers).toEqual([])
    expect(readiness.scorecard.notes).toContain('Template: Killer script')
  })

  it('accepts a conclusion and channel CTA that differ only by case and punctuation', () => {
    const readiness = evaluateShorts(shortsTemplateReceipt({
      scriptText: `${SHORTS_BODY} GOVERNED AUTOMATION, begins when uncertainty is visible enough to route, review, and refuse! SUBSCRIBE to the channel for more practical ways to govern AI decisions.`,
    }))

    expect(readiness.blockers).toEqual([])
    expect(readiness.ready).toBe(true)
  })

  it('fails when the bounded channel CTA precedes the substantive conclusion', () => {
    const readiness = evaluateShorts(shortsTemplateReceipt({
      scriptText: `${SHORTS_BODY} ${SHORTS_CHANNEL_CTA} ${SHORTS_CONCLUSION}`,
    }))

    expect(readiness.ready).toBe(false)
    expect(readiness.blockers).toContain(CONCLUSION_ORDER_BLOCKER)
    expect(readiness.blockers).not.toContain(CHANNEL_CTA_TAIL_BLOCKER)
    expect(readiness.blockers).not.toContain('Every required template section must map to approved spoken copy.')
  })

  it('fails when the bounded channel CTA is outside the closing window', () => {
    const trailing = 'Later notes stay after the invitation so the closing window can move past the channel call. '
    const readiness = evaluateShorts(shortsTemplateReceipt({
      scriptText: `${SHORTS_BODY} ${SHORTS_CONCLUSION} ${SHORTS_CHANNEL_CTA} ${trailing.repeat(3).trim()}`,
    }))

    expect(readiness.ready).toBe(false)
    expect(readiness.blockers).toContain(CHANNEL_CTA_TAIL_BLOCKER)
    expect(readiness.blockers).not.toContain(CONCLUSION_ORDER_BLOCKER)
  })

  it('rejects punctuation-only conclusion and channel CTA placeholders', () => {
    const readiness = evaluateShorts(shortsTemplateReceipt({
      conclusion: '...',
      channelCta: '!!!',
      scriptText: `${SHORTS_BODY} ${SHORTS_CONCLUSION} ${SHORTS_CHANNEL_CTA}`,
    }))

    expect(readiness.ready).toBe(false)
    expect(readiness.blockers).toEqual(expect.arrayContaining([
      CONCLUSION_ORDER_BLOCKER,
      CHANNEL_CTA_TAIL_BLOCKER,
    ]))
    expect(readiness.blockers).not.toContain('Every required template section must map to approved spoken copy.')
  })

  it('fails closed when a template receipt is stale, unbound, too short, or provider-ready', () => {
    const template = SEEDED_VIDEO_SCRIPT_TEMPLATES[0]
    const receipt = {
      receipt_version: 'video_script_template_run_receipt_v2',
      receipt_id: 'template-run:jev:stale',
      status: 'passed',
      input_version: 'sha256:old',
      generated_at: '2026-10-14T22:43:22.000Z',
      target: 'youtube_shorts',
      template_binding: {
        contract_version: 'video_script_template_v1',
        template_id: template.id,
        template_key: template.key,
        template_name: template.name,
      },
      source_binding: {
        source_receipt_id: 'source:unknown',
        claim_ids: ['unknown-claim'],
        evidence_asset_ids: ['unknown-asset'],
        approved_copy_reference: '',
      },
      narrative_map: {
        pain_point: '', hook: '', open_loop: '', frame: '', practitioner_proof: '',
        explanatory_progression: ['Only one beat.'], practical_value: '', cta: '', closing_principle: '', conclusion: '', channel_cta: '',
      },
      script: { text: 'Too short.', sha256: 'missing-prefix', word_count: 3, expected_duration_seconds: 9 },
      prior_script: { text: 'Prior.', sha256: 'missing-prefix', disposition: 'superseded_draft_evidence' },
      provider_execution: {
        status: 'ready' as never,
        max_provider_jobs: 2 as never,
        no_retry: false as never,
        cost_ceiling_usd: 10,
        expected_cost_usd: 11,
        approval_wording: '',
      },
    } satisfies VideoScriptTemplateRunReceipt

    const readiness = evaluateVideoScriptTemplateRun({
      receipt,
      template,
      expectedInputVersion: 'sha256:current',
      expectedScriptSha256: 'sha256:current-script',
      approvedSourceReceiptIds: ['source:jev:approved'],
      approvedClaimIds: ['jev-typed-probabilities'],
      approvedEvidenceAssetIds: ['jev-operator-field-guide'],
    })

    expect(readiness.ready).toBe(false)
    expect(readiness.blockers).toEqual(expect.arrayContaining([
      'Template-run receipt is stale for the approved source input.',
      'Template run is not bound to an approved source receipt.',
      'Every required template section must map to approved spoken copy.',
      'YouTube Shorts template run must target 22 to 120 seconds.',
      'Provider execution must remain blocked, single-job, and no-retry.',
    ]))
  })

  it('validates the checked-in Jev Killer script receipt against its approved source bindings', () => {
    const readiness = evaluateVideoScriptTemplateRun({
      receipt: jevTemplateRun as VideoScriptTemplateRunReceipt,
      template: SEEDED_VIDEO_SCRIPT_TEMPLATES.find((template) => template.key === 'killer_script') ?? null,
      expectedInputVersion: 'sha256:e6fc9ae4aadd61e3a871e8f7af2dd0a2d424d5c20ae6a8d0eac861b16e796bd5',
      expectedScriptSha256: jevTemplateRun.script.sha256,
      approvedSourceReceiptIds: ['source:jev:approved-composite-20261014'],
      approvedClaimIds: ['jev-typed-probabilities', 'jev-policy-boundary'],
      approvedEvidenceAssetIds: ['jev-operator-field-guide'],
    })

    expect(readiness).toMatchObject({ ready: true, blockers: [] })
    expect(readiness.scorecard.proof_density).toBeGreaterThanOrEqual(75)
    expect(jevTemplateRun.provider_execution.status).toBe('blocked_pending_explicit_approval')
  })
})
