import { createHash } from 'node:crypto'

import type { SocialContentItem } from '@/lib/social-content'
import {
  AMADUTOWN_VISUAL_SYSTEM_VERSION,
  type DeterministicVisualSpec,
} from '@/lib/social-practitioner-content'

export const DETERMINISTIC_VISUAL_ASSET_VERSION = 'deterministic_visual_asset_v1' as const
export const DETERMINISTIC_VISUAL_RENDERER_VERSION = 'amadutown_html_svg_v1' as const
export const DETERMINISTIC_VISUAL_STORAGE_BUCKET = 'social-content' as const

export type DeterministicVisualAssetReceipt = {
  version: typeof DETERMINISTIC_VISUAL_ASSET_VERSION
  status: 'current' | 'stale'
  social_content_id: string
  copy_version: string
  candidate_id: string
  candidate_hash: string
  renderer: 'html_svg'
  renderer_version: typeof DETERMINISTIC_VISUAL_RENDERER_VERSION
  render_input_hash: string
  brand_asset_hash: string
  asset_sha256: string
  asset_url: string
  storage_bucket: typeof DETERMINISTIC_VISUAL_STORAGE_BUCKET
  storage_path: string
  rendered_at: string
  rendered_by: string
  idempotency_key: string
  provider_receipt: {
    provider: 'none'
    model: null
    status: 'not_called'
    external_call: false
    receipt_id: string
  }
  provider_calls: {
    gemini: false
    heygen: false
    n8n_media: false
    other_media: false
  }
  external_actions: {
    provider_upload: false
    platform_draft: false
    schedule: false
    publish: false
    external_send: false
  }
  invalidated_at?: string | null
  invalidation_reason?: 'copy_version_changed' | 'candidate_changed' | null
}

export type DeterministicVisualRenderProjection = {
  state: 'ready' | 'current' | 'blocked'
  code:
    | 'ready'
    | 'asset_stale'
    | 'already_current'
    | 'copy_not_approved'
    | 'release_locked'
    | 'candidate_missing'
    | 'candidate_not_reviewable'
    | 'provider_boundary_invalid'
    | 'storage_unavailable'
    | 'copy_version_stale'
    | 'candidate_id_mismatch'
    | 'candidate_hash_mismatch'
    | 'render_unavailable'
    | 'write_conflict'
  can_render: boolean
  summary: string
  recovery_action: string
  copy_version: string
  candidate_id: string | null
  candidate_hash: string | null
  provider: 'none' | null
  provider_calls_enabled: false
  receipt: DeterministicVisualAssetReceipt | null
}

export class DeterministicVisualRenderError extends Error {
  constructor(
    public readonly code: DeterministicVisualRenderProjection['code'],
    message: string,
    public readonly recoveryAction: string,
    public readonly status = 409,
  ) {
    super(message)
    this.name = 'DeterministicVisualRenderError'
  }
}

type VisualRenderItem = Pick<SocialContentItem, 'id' | 'status' | 'image_url' | 'rag_context'>

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)
    : []
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  )
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

export function readDeterministicVisualSpec(ragContext: unknown): DeterministicVisualSpec | null {
  const quality = record(record(ragContext).practitioner_content_quality)
  const visual = record(quality.deterministic_visual)
  const candidate = record(visual.candidate)
  const argumentMap = record(visual.argument_map)
  const artDirectionReceipt = record(visual.art_direction_receipt)
  if (!Object.keys(visual).length) return null

  return {
    system_version: text(visual.system_version) as DeterministicVisualSpec['system_version'],
    template: text(visual.template) as DeterministicVisualSpec['template'],
    aspect_ratio: text(visual.aspect_ratio) as DeterministicVisualSpec['aspect_ratio'],
    eyebrow: text(visual.eyebrow),
    headline: text(visual.headline),
    evidence_lines: strings(visual.evidence_lines),
    result_label: text(visual.result_label),
    argument_map: {
      context: text(argumentMap.context),
      constraint: text(argumentMap.constraint),
      decision_mechanism: text(argumentMap.decision_mechanism),
      result_boundary: text(argumentMap.result_boundary),
      practical_takeaway: text(argumentMap.practical_takeaway),
    },
    visual_rationale: text(visual.visual_rationale),
    candidate: {
      candidate_id: text(candidate.candidate_id),
      status: text(candidate.status) as DeterministicVisualSpec['candidate']['status'],
      renderer: text(candidate.renderer) as DeterministicVisualSpec['candidate']['renderer'],
      artifact_url: text(candidate.artifact_url) || null,
    },
    art_direction_receipt: {
      provider: text(artDirectionReceipt.provider),
      model: text(artDirectionReceipt.model) || null,
      receipt_id: text(artDirectionReceipt.receipt_id),
      status: text(artDirectionReceipt.status) as DeterministicVisualSpec['art_direction_receipt']['status'],
    },
  }
}

export function deterministicVisualCandidateHash(spec: DeterministicVisualSpec): string {
  const candidateIdentity = {
    system_version: spec.system_version,
    template: spec.template,
    aspect_ratio: spec.aspect_ratio,
    eyebrow: spec.eyebrow,
    headline: spec.headline,
    evidence_lines: spec.evidence_lines,
    result_label: spec.result_label,
    argument_map: spec.argument_map,
    visual_rationale: spec.visual_rationale,
    candidate: {
      candidate_id: spec.candidate.candidate_id,
      renderer: spec.candidate.renderer,
    },
    art_direction_receipt: spec.art_direction_receipt,
  }
  return sha256(JSON.stringify(canonicalize(candidateIdentity)))
}

export function deterministicVisualCandidateHashFromRagContext(ragContext: unknown): string | null {
  const spec = readDeterministicVisualSpec(ragContext)
  return spec ? deterministicVisualCandidateHash(spec) : null
}

export function readDeterministicVisualAssetReceipt(ragContext: unknown): DeterministicVisualAssetReceipt | null {
  const value = record(record(ragContext).deterministic_visual_asset)
  if (value.version !== DETERMINISTIC_VISUAL_ASSET_VERSION) return null
  return value as unknown as DeterministicVisualAssetReceipt
}

function candidateBlocker(spec: DeterministicVisualSpec | null): Pick<DeterministicVisualRenderProjection, 'code' | 'summary' | 'recovery_action'> | null {
  if (
    spec?.system_version !== AMADUTOWN_VISUAL_SYSTEM_VERSION
    || !['practitioner_signal_card', 'constraint_decision_result'].includes(spec.template)
    || !['1.91:1', '1:1', '4:5', '9:16'].includes(spec.aspect_ratio)
  ) {
    return {
      code: 'candidate_missing',
      summary: 'The deterministic candidate uses an unsupported visual-system contract.',
      recovery_action: 'Restore the current AmaduTown deterministic system version, template, and aspect ratio before rendering.',
    }
  }
  if (!spec?.candidate.candidate_id || spec.candidate.renderer !== 'html_svg') {
    return {
      code: 'candidate_missing',
      summary: 'The deterministic HTML/SVG candidate is missing or incomplete.',
      recovery_action: 'Return to the approved content packet, create one HTML/SVG candidate, and reload this visual review.',
    }
  }
  if (!['in_review', 'approved'].includes(spec.candidate.status)) {
    return {
      code: 'candidate_not_reviewable',
      summary: `Candidate ${spec.candidate.candidate_id} is ${spec.candidate.status || 'not ready'} and cannot be rendered.`,
      recovery_action: 'Move the current candidate into the in-review lifecycle before rendering its review asset.',
    }
  }
  if (
    spec.art_direction_receipt.provider !== 'none'
    || spec.art_direction_receipt.model !== null
    || spec.art_direction_receipt.status !== 'not_called'
    || !spec.art_direction_receipt.receipt_id
  ) {
    return {
      code: 'provider_boundary_invalid',
      summary: 'The candidate does not carry the required provider-none receipt.',
      recovery_action: 'Restore an explicit provider none / model null / not called receipt before rendering locally.',
    }
  }
  if (
    !spec.headline
    || !spec.eyebrow
    || spec.evidence_lines.length < 2
    || !spec.result_label
    || !spec.visual_rationale
    || Object.values(spec.argument_map).some((value) => !value)
  ) {
    return {
      code: 'candidate_missing',
      summary: 'The deterministic candidate is missing required visual content.',
      recovery_action: 'Complete the headline, evidence lines, and five-part argument map before rendering.',
    }
  }
  return null
}

export function projectDeterministicVisualRender(input: {
  item: VisualRenderItem
  copyVersion: string
  storageAvailable: boolean
  releaseLocked?: boolean
}): DeterministicVisualRenderProjection {
  const spec = readDeterministicVisualSpec(input.item.rag_context)
  const candidateId = spec?.candidate.candidate_id || null
  const candidateHash = spec ? deterministicVisualCandidateHash(spec) : null
  const receipt = readDeterministicVisualAssetReceipt(input.item.rag_context)
  const base = {
    copy_version: input.copyVersion,
    candidate_id: candidateId,
    candidate_hash: candidateHash,
    provider: spec?.art_direction_receipt.provider === 'none' ? 'none' as const : null,
    provider_calls_enabled: false as const,
    receipt,
  }

  if (input.item.status !== 'approved') {
    return {
      ...base,
      state: 'blocked',
      code: 'copy_not_approved',
      can_render: false,
      summary: 'The current copy version is not approved.',
      recovery_action: 'Approve the current copy, then return to Visuals to render the version-bound review asset.',
    }
  }
  if (input.releaseLocked) {
    return {
      ...base,
      state: 'blocked',
      code: 'release_locked',
      can_render: false,
      summary: 'Release evidence locks this content version.',
      recovery_action: 'Reconcile the schedule or publication evidence before replacing its reviewed asset.',
    }
  }
  const blocker = candidateBlocker(spec)
  if (blocker) {
    return { ...base, state: 'blocked', can_render: false, ...blocker }
  }
  if (!input.storageAvailable) {
    return {
      ...base,
      state: 'blocked',
      code: 'storage_unavailable',
      can_render: false,
      summary: 'Internal Social Content storage is unavailable.',
      recovery_action: 'Restore the social-content bucket and server storage credentials, then reload this review. No provider fallback is allowed.',
    }
  }

  const current = Boolean(
    receipt?.status === 'current'
    && receipt.social_content_id === input.item.id
    && receipt.copy_version === input.copyVersion
    && receipt.candidate_id === candidateId
    && receipt.candidate_hash === candidateHash
    && receipt.renderer === 'html_svg'
    && receipt.renderer_version === DETERMINISTIC_VISUAL_RENDERER_VERSION
    && receipt.render_input_hash === deterministicVisualRenderInputHash({
      copyVersion: input.copyVersion,
      candidateHash: candidateHash || '',
      brandAssetHash: receipt.brand_asset_hash,
    })
    && /^[a-f0-9]{64}$/.test(receipt.asset_sha256)
    && receipt.provider_receipt?.provider === 'none'
    && receipt.provider_receipt?.model === null
    && receipt.provider_receipt?.status === 'not_called'
    && receipt.provider_receipt?.external_call === false
    && receipt.provider_calls?.gemini === false
    && receipt.provider_calls?.heygen === false
    && receipt.provider_calls?.n8n_media === false
    && receipt.provider_calls?.other_media === false
    && receipt.external_actions?.provider_upload === false
    && receipt.external_actions?.platform_draft === false
    && receipt.external_actions?.schedule === false
    && receipt.external_actions?.publish === false
    && receipt.external_actions?.external_send === false
    && receipt.asset_url === input.item.image_url
    && spec?.candidate.artifact_url === receipt.asset_url
  )
  if (current) {
    return {
      ...base,
      state: 'current',
      code: 'already_current',
      can_render: false,
      summary: 'The stored review asset already matches this copy and candidate.',
      recovery_action: 'Review the current asset and continue through the visual, packet, and privacy gates.',
    }
  }

  return {
    ...base,
    state: 'ready',
    code: receipt ? 'asset_stale' : 'ready',
    can_render: true,
    summary: receipt
      ? 'The stored review asset is stale for the current copy or candidate.'
      : 'The approved copy and provider-none HTML/SVG candidate are ready for local rendering.',
    recovery_action: receipt
      ? 'Render the current candidate to replace the stale review asset and reset downstream visual approvals.'
      : 'Render the candidate locally, then review the stored asset before approving visuals.',
  }
}

export function assertDeterministicVisualRenderRequest(input: {
  projection: DeterministicVisualRenderProjection
  expectedCopyVersion: unknown
  expectedCandidateId: unknown
  expectedCandidateHash: unknown
}): 'render' | 'current' {
  const expectedCopyVersion = text(input.expectedCopyVersion)
  const expectedCandidateId = text(input.expectedCandidateId)
  const expectedCandidateHash = text(input.expectedCandidateHash)
  if (expectedCopyVersion !== input.projection.copy_version) {
    throw new DeterministicVisualRenderError(
      'copy_version_stale',
      'Copy changed since this visual review opened.',
      'Reload the Social Content record and render only the current approved copy version.',
    )
  }
  if (input.projection.state === 'blocked') {
    throw new DeterministicVisualRenderError(
      input.projection.code,
      input.projection.summary,
      input.projection.recovery_action,
      input.projection.code === 'storage_unavailable' ? 503 : 409,
    )
  }
  if (expectedCandidateId !== input.projection.candidate_id) {
    throw new DeterministicVisualRenderError(
      'candidate_id_mismatch',
      'The deterministic candidate changed since this visual review opened.',
      'Reload the Visuals step and verify the current candidate before rendering.',
    )
  }
  if (expectedCandidateHash !== input.projection.candidate_hash) {
    throw new DeterministicVisualRenderError(
      'candidate_hash_mismatch',
      'The deterministic candidate content changed since this visual review opened.',
      'Reload the Visuals step and render only the currently displayed candidate hash.',
    )
  }
  if (input.projection.state === 'current') return 'current'
  if (!input.projection.can_render) {
    throw new DeterministicVisualRenderError(
      input.projection.code,
      input.projection.summary,
      input.projection.recovery_action,
      input.projection.code === 'storage_unavailable' ? 503 : 409,
    )
  }
  return 'render'
}

export function deterministicVisualRenderInputHash(input: {
  copyVersion: string
  candidateHash: string
  brandAssetHash: string
}): string {
  return sha256(JSON.stringify({
    renderer_version: DETERMINISTIC_VISUAL_RENDERER_VERSION,
    copy_version: input.copyVersion,
    candidate_hash: input.candidateHash,
    brand_asset_hash: input.brandAssetHash,
  }))
}

export function deterministicVisualStoragePath(input: {
  socialContentId: string
  copyVersion: string
  candidateId: string
  renderInputHash: string
}): string {
  const safeCandidateId = input.candidateId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 96)
  return `deterministic/${input.socialContentId}/${input.copyVersion}/${safeCandidateId}-${input.renderInputHash}.png`
}

export function buildDeterministicVisualAssetPatch(input: {
  item: VisualRenderItem
  copyVersion: string
  candidateHash: string
  renderInputHash: string
  brandAssetHash: string
  assetSha256: string
  assetUrl: string
  storagePath: string
  actor: string
  renderedAt: string
}): { image_url: string; content_format: 'single_image'; carousel_slides: null; carousel_pdf_url: null; carousel_slide_urls: null; rag_context: Record<string, unknown> } {
  const ragContext = record(input.item.rag_context)
  const quality = record(ragContext.practitioner_content_quality)
  const visual = record(quality.deterministic_visual)
  const candidate = record(visual.candidate)
  const previousReceipt = readDeterministicVisualAssetReceipt(ragContext)
  const history = Array.isArray(ragContext.deterministic_visual_asset_history)
    ? ragContext.deterministic_visual_asset_history
    : []
  const providerReceiptId = `provider-none-${input.renderInputHash.slice(0, 24)}`
  const receipt: DeterministicVisualAssetReceipt = {
    version: DETERMINISTIC_VISUAL_ASSET_VERSION,
    status: 'current',
    social_content_id: input.item.id,
    copy_version: input.copyVersion,
    candidate_id: text(candidate.candidate_id),
    candidate_hash: input.candidateHash,
    renderer: 'html_svg',
    renderer_version: DETERMINISTIC_VISUAL_RENDERER_VERSION,
    render_input_hash: input.renderInputHash,
    brand_asset_hash: input.brandAssetHash,
    asset_sha256: input.assetSha256,
    asset_url: input.assetUrl,
    storage_bucket: DETERMINISTIC_VISUAL_STORAGE_BUCKET,
    storage_path: input.storagePath,
    rendered_at: input.renderedAt,
    rendered_by: input.actor,
    idempotency_key: `social-deterministic-visual:${input.item.id}:${input.copyVersion}:${input.candidateHash}:${input.renderInputHash}`,
    provider_receipt: {
      provider: 'none',
      model: null,
      status: 'not_called',
      external_call: false,
      receipt_id: providerReceiptId,
    },
    provider_calls: {
      gemini: false,
      heygen: false,
      n8n_media: false,
      other_media: false,
    },
    external_actions: {
      provider_upload: false,
      platform_draft: false,
      schedule: false,
      publish: false,
      external_send: false,
    },
  }
  const existingReviews = record(ragContext.section_gate_reviews)
  const sectionGateReviews = { ...existingReviews }
  for (const key of ['visual_assets', 'asset_packet', 'privacy', 'linkedin_draft', 'platform_draft', 'submit']) {
    sectionGateReviews[key] = {
      ...record(existingReviews[key]),
      status: 'pending',
      decided_at: null,
      decided_by: null,
      invalidated_at: input.renderedAt,
      invalidation_reason: 'deterministic_asset_rendered',
    }
  }

  return {
    image_url: input.assetUrl,
    content_format: 'single_image',
    carousel_slides: null,
    carousel_pdf_url: null,
    carousel_slide_urls: null,
    rag_context: {
      ...ragContext,
      practitioner_content_quality: {
        ...quality,
        deterministic_visual: {
          ...visual,
          candidate: {
            ...candidate,
            artifact_url: input.assetUrl,
          },
        },
      },
      deterministic_visual_asset: receipt,
      deterministic_visual_asset_history: previousReceipt
        ? [...history, previousReceipt].slice(-5)
        : history.slice(-5),
      section_gate_reviews: sectionGateReviews,
      previous_image_handoffs: ragContext.previous_image_handoffs ?? {
        linkedin: ragContext.linkedin_draft_handoff ?? null,
        platform: ragContext.platform_draft_handoff ?? null,
        production_assets: ragContext.production_assets ?? null,
      },
      linkedin_draft_handoff: null,
      platform_draft_handoff: null,
      production_assets: null,
      agentified_visual_qa: null,
    },
  }
}

export function invalidateDeterministicVisualAsset(input: {
  currentRagContext: unknown
  nextRagContext: Record<string, unknown>
  now: string
  reason: 'copy_version_changed' | 'candidate_changed'
}): { ragContext: Record<string, unknown>; invalidatedAssetUrl: string | null } {
  const receipt = readDeterministicVisualAssetReceipt(input.currentRagContext)
  const nextRagContext = { ...input.nextRagContext }
  if (receipt) {
    nextRagContext.deterministic_visual_asset = {
      ...receipt,
      status: 'stale',
      invalidated_at: input.now,
      invalidation_reason: input.reason,
    }
  }
  const quality = record(nextRagContext.practitioner_content_quality)
  const visual = record(quality.deterministic_visual)
  const candidate = record(visual.candidate)
  if (Object.keys(candidate).length) {
    nextRagContext.practitioner_content_quality = {
      ...quality,
      deterministic_visual: {
        ...visual,
        candidate: { ...candidate, artifact_url: null },
      },
    }
  }
  const reviews = record(nextRagContext.section_gate_reviews)
  const nextReviews = { ...reviews }
  for (const key of ['visual_assets', 'asset_packet', 'privacy', 'linkedin_draft', 'platform_draft', 'submit']) {
    if (reviews[key] || receipt) {
      nextReviews[key] = {
        ...record(reviews[key]),
        status: 'pending',
        invalidated_at: input.now,
        invalidation_reason: input.reason,
      }
    }
  }
  nextRagContext.section_gate_reviews = nextReviews
  if (receipt) {
    nextRagContext.linkedin_draft_handoff = null
    nextRagContext.platform_draft_handoff = null
    nextRagContext.production_assets = null
    nextRagContext.agentified_visual_qa = null
  }
  return { ragContext: nextRagContext, invalidatedAssetUrl: receipt?.asset_url || null }
}

export function bufferSha256(buffer: Buffer): string {
  return sha256(buffer)
}
