import {
  SOCIAL_CAMPAIGN_CANDIDATE_VERSION,
  SOCIAL_CAMPAIGN_LONG_FORM_INPUT_VERSION,
  SOCIAL_CAMPAIGN_THUMBNAIL_V6_CHECKLIST,
  type CampaignPreparationCandidate,
} from '@/lib/social-campaign-package-preparation'
import { LONG_FORM_FRAMEWORK_LIBRARY, LONG_FORM_FRAMEWORK_LIBRARY_VERSION } from '@/lib/long-form-script-intelligence'

export const SOCIAL_CAMPAIGN_PACKAGE_QA_FIXTURE = 'campaign-package-preparation-v1'

function receipt(product: string, name: string, overrides: Partial<CampaignPreparationCandidate['receipts']['evidence']> = {}) {
  return {
    receipt_id: `receipt:${product}:${name}:20261018`,
    status: 'passed' as const,
    observed_at: '2026-10-18T12:00:00.000Z',
    fresh_until: '2026-10-25T12:00:00.000Z',
    source_href: `/admin/source-protocol?receipt=${encodeURIComponent(`receipt:${product}:${name}:20261018`)}`,
    observed_value: 84,
    required_value: 75,
    formula: 'normalized performance = observed views / channel baseline',
    sample_size: 8,
    ...overrides,
  }
}

function checklist(overrides: Partial<CampaignPreparationCandidate['thumbnail_checklist']> = {}) {
  return {
    ...Object.fromEntries(SOCIAL_CAMPAIGN_THUMBNAIL_V6_CHECKLIST.map((label) => [label, true])),
    ...overrides,
  } as CampaignPreparationCandidate['thumbnail_checklist']
}

function base(product: 'kicklab' | 'reversr' | 'kinflo', label: string): CampaignPreparationCandidate {
  const topic = `${label} product proof workflow`
  return {
    version: SOCIAL_CAMPAIGN_CANDIDATE_VERSION,
    candidate_id: `candidate:${product}:campaign:v1`,
    campaign_identity: product,
    product_label: label,
    social_content_id: `qa-${product}-campaign`,
    calendar_item_ids: [`calendar:${product}:linkedin`, `calendar:${product}:youtube`],
    content_version: '2026-10-18T12:00:00.000Z',
    input_version: `input:${product}:campaign:v1`,
    status: 'eligible',
    source_trace: [
      { source_id: `source:${product}:outlier:included`, label: 'Live topic-specific outlier', href: `https://www.youtube.com/results?search_query=${encodeURIComponent(label)}`, decision: 'selected', reason: 'Current public evidence met the recorded sample and normalized-performance threshold.' },
      { source_id: `source:${product}:outlier:excluded`, label: 'Excluded comparison', href: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${label} comparison`)}`, decision: 'excluded', reason: 'Excluded from performance support because the observation was stale or outside the topic cohort.' },
    ],
    receipts: {
      evidence: receipt(product, 'evidence'),
      outlier: { ...receipt(product, 'outlier'), route: 'social-content-outlier-decision/v1', threshold: 75, score: 84 },
      product_proof: receipt(product, 'product-proof'),
      originality: receipt(product, 'originality'),
      privacy: receipt(product, 'privacy'),
    },
    playlist_calibration: [{
      item_id: `playlist:${product}:taste-1`,
      source_href: 'https://www.youtube.com/playlist?list=PL-review-only',
      traits: ['dominant subject', 'short teaser', 'high contrast'],
      performance_weight: 0,
      evidence_role: 'taste_calibration_only',
      performance_status: 'unscored',
    }],
    thumbnail_checklist: checklist(),
    deliverables: {
      linkedin: { copy: `${label} turns a product lesson into a practical, receipt-backed story without claiming outcomes the evidence cannot support.`, visual_href: product === 'reversr' ? '/ReversR_app.png' : '/amadutown-logo-upscaled.png', visual_alt: `${label} review-only product visual.` },
      youtube: { title: `${label}: What the Product Proof Actually Shows`, thumbnail_teaser: 'SHOW THE WORK', description: `A review-only ${label} campaign description bound to approved evidence, product proof, and source limits.`, script: `Opening: name the real ${label} operator problem.\nProof: walk through the approved product evidence.\nBoundary: separate what is observed from what still needs measurement.\nClose: invite the viewer to inspect the workflow.`, storyboard: ['Human opening and tension', 'Owned product proof walkthrough', 'Evidence and limitation receipt', 'Practical close'], thumbnail_href: product === 'reversr' ? '/ReversR_app.webp' : '/amadutown-logo-upscaled.png' },
    },
    long_form_script_input: {
      version: SOCIAL_CAMPAIGN_LONG_FORM_INPUT_VERSION,
      receipt_id: `receipt:${product}:long-form-framework:20261018`,
      status: 'passed',
      campaign_identity: product,
      candidate_id: `candidate:${product}:campaign:v1`,
      content_updated_at: '2026-10-18T12:00:00.000Z',
      observed_at: '2026-10-18T12:00:00.000Z',
      fresh_until: '2026-10-25T12:00:00.000Z',
      source_href: `/admin/content/video-generation?campaign=${product}&review=script-intelligence`,
      framework_library_version: LONG_FORM_FRAMEWORK_LIBRARY_VERSION,
      framework_rule_ids: LONG_FORM_FRAMEWORK_LIBRARY.rules.map((rule) => rule.id),
      topic,
      promise: `a clear ${label} product proof review built from current topic evidence`,
      expected_duration_seconds: 180,
      topic_outlier_evidence: [2.4, 1.8, 2].map((ratio, index) => ({
        id: `topic:${product}:${index + 1}`,
        label: `${label} current topic comparison ${index + 1}`,
        source_url: `https://example.com/public-topic-evidence/${product}-${index + 1}`,
        creator: `Attributed public creator ${index + 1}`,
        topic,
        observed_at: '2026-10-18T12:00:00.000Z',
        published_at: '2026-10-10T12:00:00.000Z',
        views: Math.round(10_000 * ratio),
        channel_baseline_views: 10_000,
        attribution_status: 'attributable',
      })),
      creator_distance: {
        status: 'passed',
        compared_source_ids: LONG_FORM_FRAMEWORK_LIBRARY.sources.map((source) => source.id),
        longest_matching_phrase_words: 4,
        maximum_allowed_phrase_words: 7,
        copied_phrase_hits: [],
        voice_profile: 'vambah-approved',
        notes: 'Synthetic QA receipt for original, first-party product narration.',
      },
    },
  }
}

export function socialCampaignPackageQaCandidates() {
  const kicklab = base('kicklab', 'KickLab')
  const reversr = base('reversr', 'ReversR rebuild')
  reversr.status = 'blocked'
  reversr.receipts.evidence.fresh_until = '2026-10-18T13:00:00.000Z'
  reversr.receipts.evidence.source_href = '/admin/agents/content-intelligence?section=research&candidate=reversr'
  const kinflo = base('kinflo', 'KinFlo')
  kinflo.deliverables.youtube.thumbnail_teaser = 'SCOPE BEFORE STORY'
  return [kicklab, reversr, kinflo]
}

