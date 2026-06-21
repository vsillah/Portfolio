import type { FrameworkVisualType } from './social-content'

export type RedactionIssueType =
  | 'name'
  | 'email'
  | 'phone'
  | 'account_id'
  | 'private_url'
  | 'admin_record'
  | 'face'
  | 'raw_chronicle'
  | 'private_notes'

export type RedactionReviewDecision =
  | 'approve_redaction'
  | 'adjust_redaction'
  | 'safe_exception'
  | 'reject_clip'

export type RedactionItemStatus = 'pending' | 'unreviewed' | 'failed' | 'approved' | 'rejected'

export type VideoRedactionManifestStatus = 'ready' | 'requires_review' | 'blocked'

export interface ChronicleIngestionScope {
  approved: boolean
  source: string
  window_label: string
  notes?: string[]
}

export interface BrollLibraryAsset {
  id: string
  route: string
  route_description: string | null
  filename: string
  screenshot_path: string | null
  clip_path: string | null
  captured_at: string | null
}

export interface VideoRedactionManifestItem {
  id: string
  issue_type: RedactionIssueType
  source: 'post_copy' | 'chronicle' | 'broll' | 'video_script'
  original_asset: {
    label: string
    url_or_path: string | null
  }
  redacted_asset: {
    label: string
    url_or_path: string | null
  } | null
  timestamp_ranges: Array<{
    start_ms: number
    end_ms: number
  }>
  bounding_boxes: Array<{
    x: number
    y: number
    width: number
    height: number
    label: string
  }>
  proposed_action: 'auto_blur' | 'reject_clip' | 'manual_review'
  confidence: number
  reviewer_decision: RedactionReviewDecision | null
  status: RedactionItemStatus
  evidence: string
}

export interface VideoRedactionManifest {
  policy: 'hard_gate_auto_blur_first'
  status: VideoRedactionManifestStatus
  items: VideoRedactionManifestItem[]
  unresolved_count: number
  generated_at: string
  reviewer_required: true
  publish_blocker: string | null
}

export interface SocialProductionAssetsPacket {
  version: 'social_production_assets_v2'
  status: 'review_ready'
  generated_at: string
  source: 'social_content_asset_packet'
  approval_boundary: string
  references: {
    open_brain: string[]
    public_sources: string[]
    placement_guidance: string[]
  }
  chronicle_evidence: {
    ingestion_mode: 'direct_scoped_review'
    scope: ChronicleIngestionScope
    proposals: Array<{
      id: string
      note: string
      sensitivity: 'public_safe_summary' | 'needs_redaction_review'
    }>
    boundary: string
  }
  illustration: {
    status: 'prompt_ready'
    image_prompt: string | null
    framework_visual_type: FrameworkVisualType | null
  }
  app_screenshot_carousel: {
    status: 'recommended' | 'ready'
    routes: Array<{ route: string; label: string }>
    existing_asset_count: number
    carousel_pdf_url?: string | null
    carousel_slide_urls?: string[] | null
  }
  broll: {
    status: 'matched' | 'missing'
    hints: string[]
    assets: BrollLibraryAsset[]
  }
  video_script: {
    status: 'draft_ready'
    title: string
    script_text: string
    broll_hints: string[]
  }
  video_redaction_manifest: VideoRedactionManifest
  visual_qa: {
    status: 'required'
    checklist: string[]
  }
}

export interface RedactionGate {
  ready: boolean
  unresolvedItems: VideoRedactionManifestItem[]
  message: string | null
}

export function isRedactionItemResolved(item: VideoRedactionManifestItem): boolean {
  if (item.status === 'failed' || item.status === 'pending' || item.status === 'unreviewed') return false
  if (!item.reviewer_decision) return false
  return item.reviewer_decision === 'approve_redaction'
    || item.reviewer_decision === 'safe_exception'
    || item.reviewer_decision === 'reject_clip'
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function stableId(prefix: string, value: string, index: number) {
  return `${prefix}-${index + 1}-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'item'}`
}

function excerpt(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 140)
}

function createRedactionItem(params: {
  id: string
  issueType: RedactionIssueType
  source: VideoRedactionManifestItem['source']
  label: string
  path: string | null
  evidence: string
  confidence: number
  proposedAction?: VideoRedactionManifestItem['proposed_action']
}): VideoRedactionManifestItem {
  return {
    id: params.id,
    issue_type: params.issueType,
    source: params.source,
    original_asset: {
      label: params.label,
      url_or_path: params.path,
    },
    redacted_asset: null,
    timestamp_ranges: [{ start_ms: 0, end_ms: 4000 }],
    bounding_boxes: [{ x: 0, y: 0, width: 1, height: 1, label: 'full_frame_review' }],
    proposed_action: params.proposedAction ?? 'auto_blur',
    confidence: params.confidence,
    reviewer_decision: null,
    status: 'pending',
    evidence: excerpt(params.evidence),
  }
}

function detectTextRedactions(text: string, source: VideoRedactionManifestItem['source'], label: string) {
  const findings: VideoRedactionManifestItem[] = []
  const checks: Array<{ type: RedactionIssueType; pattern: RegExp; confidence: number }> = [
    { type: 'email', pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, confidence: 0.98 },
    { type: 'phone', pattern: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g, confidence: 0.9 },
    { type: 'account_id', pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, confidence: 0.92 },
    { type: 'private_url', pattern: /https?:\/\/\S*(?:token|auth|session|admin|client|meeting|redirect)\S*/gi, confidence: 0.86 },
    { type: 'admin_record', pattern: /\/admin\/[^\s)'"<>]+/gi, confidence: 0.82 },
  ]

  for (const check of checks) {
    const matches = [...text.matchAll(check.pattern)]
    for (const [index, match] of matches.entries()) {
      findings.push(createRedactionItem({
        id: stableId(`${source}-${check.type}`, match[0], index),
        issueType: check.type,
        source,
        label,
        path: null,
        evidence: match[0],
        confidence: check.confidence,
      }))
    }
  }

  const lower = text.toLowerCase()
  if (lower.includes('raw chronicle') || lower.includes('raw screen history')) {
    findings.push(createRedactionItem({
      id: `${source}-raw-chronicle`,
      issueType: 'raw_chronicle',
      source,
      label,
      path: null,
      evidence: text,
      confidence: 0.88,
      proposedAction: 'manual_review',
    }))
  }
  if (lower.includes('private note') || lower.includes('client data') || lower.includes('private material')) {
    findings.push(createRedactionItem({
      id: `${source}-private-notes`,
      issueType: 'private_notes',
      source,
      label,
      path: null,
      evidence: text,
      confidence: 0.8,
      proposedAction: 'manual_review',
    }))
  }

  return findings
}

function detectBrollRedactions(assets: BrollLibraryAsset[]) {
  return assets.flatMap((asset, index) => {
    const haystack = [asset.route, asset.route_description, asset.filename, asset.clip_path, asset.screenshot_path].filter(Boolean).join(' ')
    const findings = detectTextRedactions(haystack, 'broll', asset.route_description || asset.filename)
    const adminAsset = asset.route.startsWith('/admin') || haystack.toLowerCase().includes('admin')
    if (!adminAsset) return findings
    return [
      ...findings,
      createRedactionItem({
        id: stableId('broll-admin-record', asset.filename, index),
        issueType: 'admin_record',
        source: 'broll',
        label: asset.route_description || asset.filename,
        path: asset.clip_path || asset.screenshot_path,
        evidence: `${asset.route} ${asset.route_description || ''}`.trim(),
        confidence: 0.84,
      }),
    ]
  })
}

export function getProductionAssets(ragContext: unknown): SocialProductionAssetsPacket | null {
  const record = asRecord(ragContext)
  const assets = record.production_assets
  if (!assets || typeof assets !== 'object' || Array.isArray(assets)) return null
  const packet = assets as SocialProductionAssetsPacket
  return packet.version === 'social_production_assets_v2' ? packet : null
}

export function getVideoRedactionGate(productionAssets: SocialProductionAssetsPacket | null): RedactionGate {
  const items = productionAssets?.video_redaction_manifest?.items ?? []
  const unresolvedItems = items.filter((item) => !isRedactionItemResolved(item))

  return {
    ready: unresolvedItems.length === 0,
    unresolvedItems,
    message: unresolvedItems.length
      ? `Video privacy review required: ${unresolvedItems.length} redaction item${unresolvedItems.length === 1 ? '' : 's'} unresolved.`
      : null,
  }
}

export function buildSocialProductionAssetsPacket(input: {
  contentId: string
  postText: string
  ctaText: string | null
  hashtags: string[]
  imagePrompt: string | null
  frameworkVisualType: FrameworkVisualType | null
  ragContext: Record<string, unknown> | null
  brollAssets: BrollLibraryAsset[]
  chronicleScope: ChronicleIngestionScope
  generatedAt?: string
}): SocialProductionAssetsPacket {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const ragContext = input.ragContext ?? {}
  const goalId = asString(ragContext.goal_id)
  const chronicleNotes = [
    ...asStringArray(ragContext.chronicle_evidence_notes),
    ...(input.chronicleScope.notes ?? []),
  ].filter((note, index, all) => note.trim() && all.indexOf(note) === index)
  const openBrain = asStringArray(ragContext.open_brain_references)
  const existingScreenshotAssets = Array.isArray(ragContext.app_screenshot_assets)
    ? ragContext.app_screenshot_assets
    : []
  const brollHints = input.brollAssets.length
    ? input.brollAssets.map((asset) => asset.route_description || asset.filename)
    : ['social content', 'agent ops', 'open brain', 'review gates']
  const defaultRoutes = [
    { route: `/admin/social-content/${input.contentId}`, label: 'Social Content review' },
    { route: '/admin/agents/swarm-board', label: 'Agent Swarm Board' },
    { route: goalId ? `/admin/agents/standup?goal=${encodeURIComponent(goalId)}` : '/admin/agents/standup', label: 'Standup Room goal' },
    { route: '/admin/agents/open-brain', label: 'Open Brain references' },
  ]
  const videoScript = [
    input.postText.split(/\n+/).find(Boolean)?.trim() || 'This post started with a practical workflow problem.',
    '',
    'Show the operating layer: the draft, the reference trail, the app screenshots, the b-roll, and the approval gates.',
    '',
    input.ctaText || 'Where would this kind of review surface reduce burden in your work?',
  ].join('\n')
  const chronicleText = chronicleNotes.join('\n')
  const redactionItems = [
    ...detectTextRedactions(input.postText, 'post_copy', 'Approved LinkedIn copy'),
    ...detectTextRedactions(input.ctaText ?? '', 'post_copy', 'Approved LinkedIn CTA'),
    ...detectTextRedactions(chronicleText, 'chronicle', 'Direct Chronicle evidence proposals'),
    ...detectTextRedactions(videoScript, 'video_script', 'Draft video script'),
    ...detectBrollRedactions(input.brollAssets),
  ]
  const unresolvedCount = redactionItems.filter((item) => !isRedactionItemResolved(item)).length

  return {
    version: 'social_production_assets_v2',
    status: 'review_ready',
    generated_at: generatedAt,
    source: 'social_content_asset_packet',
    approval_boundary: 'Review-only asset packet. Provider generation, uploads, publishing, scheduling, and outbound sends remain separately approval-gated.',
    references: {
      open_brain: openBrain,
      public_sources: asStringArray(ragContext.public_sources),
      placement_guidance: [
        'Attach public source URLs only after reference review.',
        'Label internal Portfolio proof as product evidence, not public citation.',
        'Keep private-derived Chronicle material summarized and reviewed.',
      ],
    },
    chronicle_evidence: {
      ingestion_mode: 'direct_scoped_review',
      scope: input.chronicleScope,
      proposals: chronicleNotes.map((note, index) => ({
        id: stableId('chronicle-note', note, index),
        note,
        sensitivity: /raw|screen|client|private|admin/i.test(note)
          ? 'needs_redaction_review'
          : 'public_safe_summary',
      })),
      boundary: 'Direct Chronicle ingestion can propose evidence and assets for review, but raw Chronicle media is internal review material only.',
    },
    illustration: {
      status: 'prompt_ready',
      image_prompt: input.imagePrompt,
      framework_visual_type: input.frameworkVisualType,
    },
    app_screenshot_carousel: {
      status: 'recommended',
      routes: defaultRoutes,
      existing_asset_count: existingScreenshotAssets.length,
    },
    broll: {
      status: input.brollAssets.length ? 'matched' : 'missing',
      hints: brollHints,
      assets: input.brollAssets,
    },
    video_script: {
      status: 'draft_ready',
      title: 'LinkedIn companion video script',
      script_text: videoScript,
      broll_hints: brollHints,
    },
    video_redaction_manifest: {
      policy: 'hard_gate_auto_blur_first',
      status: unresolvedCount ? 'requires_review' : 'ready',
      items: redactionItems,
      unresolved_count: unresolvedCount,
      generated_at: generatedAt,
      reviewer_required: true,
      publish_blocker: unresolvedCount
        ? `Video privacy review required before publish readiness: ${unresolvedCount} unresolved item${unresolvedCount === 1 ? '' : 's'}.`
        : null,
    },
    visual_qa: {
      status: 'required',
      checklist: [
        'Confirm all redaction items are approved, adjusted, excepted, or rejected.',
        'Use only redacted or approved-safe video segments in final export.',
        'Confirm screenshots do not expose private admin/client data.',
        'Confirm illustration is labeled as conceptual proof, not raw evidence.',
      ],
    },
  }
}
