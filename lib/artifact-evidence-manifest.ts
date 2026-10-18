import {
  parseArtifactEvaluationReceipt,
  validateArtifactEvaluationReceipt,
  type ArtifactEvaluationKind,
  type ArtifactEvaluationReceipt,
} from '@/lib/artifact-evidence-evaluation'

export const ARTIFACT_EVIDENCE_MANIFEST_VERSION = 'artifact-evidence-manifest/v2' as const

export const ARTIFACT_EVIDENCE_CATEGORIES = [
  'copy_script',
  'visual_field',
  'product_screenshot',
  'visual_template',
  'presenter_avatar',
  'voice_narration',
  'music',
  'thumbnail',
  'title',
  'description',
  'cta',
  'source_research',
  'transformation',
  'final_output',
] as const

export type ArtifactEvidenceCategory = (typeof ARTIFACT_EVIDENCE_CATEGORIES)[number]

export type ArtifactEvidenceRegion = {
  x: number
  y: number
}

export type ArtifactEvidenceElement = {
  id: string
  category: ArtifactEvidenceCategory
  label: string
  input_excerpt: string
  customer_facing: boolean
  review_only: boolean
  redacted: boolean
  source_identity: string
  source_record_type: string
  authoritative_href: string | null
  artifact_url?: string | null
  evidence_receipt_ids: string[]
  version_hash: string
  content_version: string
  rights_privacy_status: 'passed' | 'blocked' | 'missing'
  rights_privacy_receipt_ids: string[]
  transformation_step: string
  evaluation_kind?: ArtifactEvaluationKind
  evaluation_receipt?: ArtifactEvaluationReceipt
  region?: ArtifactEvidenceRegion
}

export type ArtifactEvidenceManifest = {
  version: typeof ARTIFACT_EVIDENCE_MANIFEST_VERSION
  manifest_id: string
  manifest_hash: string
  content_version: string
  artifact_label: string
  preview_url: string | null
  preview_alt: string
  final_output_hashes: Array<{ label: string; sha256: string }>
  elements: ArtifactEvidenceElement[]
}

export type ArtifactEvidenceManifestValidation = {
  manifest: ArtifactEvidenceManifest | null
  ready: boolean
  stale: boolean
  blockers: string[]
}

export type YouTubePackagingTarget = 'youtube' | 'youtube_shorts'

export type YouTubePackagingEvidenceValidation = {
  ready: boolean
  pairBound: boolean
  target: YouTubePackagingTarget
  title: ArtifactEvidenceElement | null
  thumbnail: ArtifactEvidenceElement | null
  blockers: string[]
  recoveryActions: string[]
}

export type ArtifactManifestSnapshot = {
  manifest_id: string
  manifest_hash: string
  content_version: string
  evaluation_receipt_version: string | null
  evaluation_receipt_ids: string[]
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) : []
}

function timestamp(value: string): string | null {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
}

function safeAuthoritativeHref(value: unknown): string | null {
  const href = text(value)
  if (!href) return null
  if (!href.startsWith('/admin/') || href.includes('://') || href.includes('..')) return null
  return href
}

function safeArtifactUrl(value: unknown): string | null {
  const href = text(value)
  if (!href) return null
  if (!href.startsWith('/review-assets/') || href.includes('://') || href.includes('..')) return null
  return href
}

const EVALUATION_KIND_BY_CATEGORY: Partial<Record<ArtifactEvidenceCategory, ArtifactEvaluationKind>> = {
  copy_script: 'script_message',
  visual_field: 'headline_hook',
  visual_template: 'visual_concept',
  thumbnail: 'thumbnail',
  title: 'title_subject',
  description: 'description',
  cta: 'cta',
}

function parseElement(value: unknown): ArtifactEvidenceElement | null {
  const candidate = record(value)
  if (!candidate) return null
  const category = text(candidate.category)
  const status = text(candidate.rights_privacy_status)
  if (!ARTIFACT_EVIDENCE_CATEGORIES.includes(category as ArtifactEvidenceCategory)) return null
  if (!['passed', 'blocked', 'missing'].includes(status)) return null
  const regionRecord = record(candidate.region)
  const region = regionRecord && Number.isFinite(Number(regionRecord.x)) && Number.isFinite(Number(regionRecord.y))
    ? { x: Number(regionRecord.x), y: Number(regionRecord.y) }
    : undefined

  return {
    id: text(candidate.id),
    category: category as ArtifactEvidenceCategory,
    label: text(candidate.label),
    input_excerpt: text(candidate.input_excerpt),
    customer_facing: candidate.customer_facing === true,
    review_only: candidate.review_only === true,
    redacted: candidate.redacted === true,
    source_identity: text(candidate.source_identity),
    source_record_type: text(candidate.source_record_type),
    authoritative_href: safeAuthoritativeHref(candidate.authoritative_href),
    artifact_url: safeArtifactUrl(candidate.artifact_url),
    evidence_receipt_ids: strings(candidate.evidence_receipt_ids),
    version_hash: text(candidate.version_hash),
    content_version: text(candidate.content_version),
    rights_privacy_status: status as ArtifactEvidenceElement['rights_privacy_status'],
    rights_privacy_receipt_ids: strings(candidate.rights_privacy_receipt_ids),
    transformation_step: text(candidate.transformation_step),
    ...(text(candidate.evaluation_kind) ? { evaluation_kind: text(candidate.evaluation_kind) as ArtifactEvaluationKind } : {}),
    ...(candidate.evaluation_receipt ? { evaluation_receipt: parseArtifactEvaluationReceipt(candidate.evaluation_receipt) ?? undefined } : {}),
    ...(region ? { region } : {}),
  }
}

function packagingElementIssues(
  element: ArtifactEvidenceElement,
  label: 'Title' | 'Thumbnail',
  currentContentVersion: string,
  evaluationAsOf: string,
): { blockers: string[]; recoveryActions: string[] } {
  const blockers: string[] = []
  const recoveryActions: string[] = []
  const currentVersion = timestamp(currentContentVersion)
  if (!element.input_excerpt) {
    blockers.push(`${label} evidence is missing the customer-facing ${label === 'Title' ? 'title' : 'headline'}.`)
    recoveryActions.push(`Add the exact customer-facing ${label === 'Title' ? 'title' : 'thumbnail headline'} to the versioned packaging receipt, then rebuild the asset-package review.`)
  }
  if (!element.authoritative_href || !element.evidence_receipt_ids.length) {
    blockers.push(`${label} evidence is not bound to exact safe source links and receipt identities.`)
    recoveryActions.push(`Bind the ${label.toLowerCase()} to its exact approved source links and stable receipt IDs, then rebuild the asset-package review.`)
  }
  if (!element.version_hash || timestamp(element.content_version) !== currentVersion) {
    blockers.push(`${label} evidence is stale or not version-bound to the current content.`)
    recoveryActions.push(`Re-evaluate the ${label.toLowerCase()} against the current content version and issue a new version-bound receipt.`)
  }
  if (label === 'Thumbnail' && !element.artifact_url) {
    blockers.push('Thumbnail evidence is missing its actual bound review asset.')
    recoveryActions.push('Restore the versioned thumbnail file and receipt binding, then rebuild the asset-package review. A brief or poster alone is not sufficient.')
  }
  if (!element.evaluation_receipt) {
    blockers.push(`${label} evidence has no numerical evaluation receipt.`)
    recoveryActions.push(`Attach a current comparable/outlier cohort and complete the ${label.toLowerCase()} scorecard before asset-package review.`)
  } else {
    const evaluation = validateArtifactEvaluationReceipt(element.evaluation_receipt, currentContentVersion, evaluationAsOf)
    if (!evaluation.ready) {
      blockers.push(...evaluation.blockers.map((blocker) => `${label} evidence: ${blocker}`))
      recoveryActions.push(`Resolve the ${label.toLowerCase()} scorecard blockers, attach current attributable cohort receipts, and issue a fresh version-bound evaluation.`)
    }
  }
  return { blockers, recoveryActions }
}

export function validateYouTubePackagingEvidence(
  value: unknown,
  currentContentVersion: string,
  target: YouTubePackagingTarget,
  evaluationAsOf: string = new Date().toISOString(),
): YouTubePackagingEvidenceValidation {
  const manifest = parseArtifactEvidenceManifest(value)
  if (!manifest) {
    return {
      ready: false,
      pairBound: false,
      target,
      title: null,
      thumbnail: null,
      blockers: ['YouTube packaging evidence is missing or malformed.'],
      recoveryActions: ['Restore the versioned title and thumbnail receipts, then rebuild the existing Social Content asset-package review.'],
    }
  }

  const titles = manifest.elements.filter((element) => element.category === 'title' && element.customer_facing)
  const thumbnails = manifest.elements.filter((element) => element.category === 'thumbnail' && element.customer_facing)
  const blockers: string[] = []
  const recoveryActions: string[] = []
  if (titles.length !== 1) {
    blockers.push(titles.length === 0 ? 'Customer-facing title evidence is missing.' : 'Customer-facing title evidence is ambiguous because more than one title is marked current.')
    recoveryActions.push('Bind exactly one current customer-facing title and retire or version older candidates before asset-package review.')
  }
  if (thumbnails.length !== 1) {
    blockers.push(thumbnails.length === 0 ? 'Customer-facing thumbnail evidence is missing.' : 'Customer-facing thumbnail evidence is ambiguous because more than one thumbnail is marked current.')
    recoveryActions.push('Bind exactly one current customer-facing thumbnail and retire or version older candidates before asset-package review.')
  }

  const title = titles.length === 1 ? titles[0] : null
  const thumbnail = thumbnails.length === 1 ? thumbnails[0] : null
  if (title) {
    const issues = packagingElementIssues(title, 'Title', currentContentVersion, evaluationAsOf)
    blockers.push(...issues.blockers)
    recoveryActions.push(...issues.recoveryActions)
  }
  if (thumbnail) {
    const issues = packagingElementIssues(thumbnail, 'Thumbnail', currentContentVersion, evaluationAsOf)
    blockers.push(...issues.blockers)
    recoveryActions.push(...issues.recoveryActions)
  }

  const pairBound = Boolean(
    title?.input_excerpt
    && title.authoritative_href
    && title.evidence_receipt_ids.length
    && thumbnail?.input_excerpt
    && thumbnail.authoritative_href
    && thumbnail.evidence_receipt_ids.length
    && thumbnail.artifact_url,
  )
  return {
    ready: blockers.length === 0,
    pairBound,
    target,
    title,
    thumbnail,
    blockers: [...new Set(blockers)],
    recoveryActions: [...new Set(recoveryActions)],
  }
}

export function parseArtifactEvidenceManifest(value: unknown): ArtifactEvidenceManifest | null {
  const candidate = record(value)
  if (!candidate || candidate.version !== ARTIFACT_EVIDENCE_MANIFEST_VERSION) return null
  const elements = Array.isArray(candidate.elements)
    ? candidate.elements.map(parseElement).filter((entry): entry is ArtifactEvidenceElement => Boolean(entry))
    : []
  const hashes = Array.isArray(candidate.final_output_hashes)
    ? candidate.final_output_hashes.map((value) => {
        const hash = record(value)
        return hash ? { label: text(hash.label), sha256: text(hash.sha256) } : null
      }).filter((entry): entry is { label: string; sha256: string } => Boolean(entry))
    : []
  return {
    version: ARTIFACT_EVIDENCE_MANIFEST_VERSION,
    manifest_id: text(candidate.manifest_id),
    manifest_hash: text(candidate.manifest_hash),
    content_version: text(candidate.content_version),
    artifact_label: text(candidate.artifact_label),
    preview_url: text(candidate.preview_url) || null,
    preview_alt: text(candidate.preview_alt),
    final_output_hashes: hashes,
    elements,
  }
}

export function validateArtifactEvidenceManifest(
  value: unknown,
  currentContentVersion: string,
  evaluationAsOf: string = new Date().toISOString(),
): ArtifactEvidenceManifestValidation {
  const manifest = parseArtifactEvidenceManifest(value)
  if (!manifest) return { manifest: null, ready: false, stale: false, blockers: ['The artifact evidence manifest is missing or malformed.'] }

  const blockers: string[] = []
  const currentVersion = timestamp(currentContentVersion)
  const manifestVersion = timestamp(manifest.content_version)
  const stale = !currentVersion || !manifestVersion || currentVersion !== manifestVersion

  if (!manifest.manifest_id) blockers.push('The manifest identity is missing.')
  if (!/^sha256:[a-f0-9]{64}$/i.test(manifest.manifest_hash)) blockers.push('The manifest hash is missing or invalid.')
  if (stale) blockers.push('The artifact evidence manifest is stale for the current content version. Rebuild the review packet from the current artifact inputs.')
  if (!manifest.preview_alt) blockers.push('The artifact preview needs accessible alternative text.')
  if (!manifest.final_output_hashes.length || manifest.final_output_hashes.some((entry) => !entry.label || !/^[a-f0-9]{64}$/i.test(entry.sha256))) {
    blockers.push('Every final output needs a valid SHA-256 hash.')
  }

  const ids = new Set<string>()
  for (const category of ARTIFACT_EVIDENCE_CATEGORIES) {
    if (!manifest.elements.some((element) => element.category === category)) blockers.push(`Manifest category ${category.replaceAll('_', ' ')} is missing.`)
  }

  for (const element of manifest.elements) {
    if (!element.id || ids.has(element.id)) blockers.push('Every manifested element needs a unique stable identity.')
    ids.add(element.id)
    if (!element.label || !element.source_identity || !element.source_record_type || !element.version_hash || !element.transformation_step) {
      blockers.push(`${element.label || element.id || 'Manifest element'} is missing source, version, or transformation detail.`)
    }
    if (timestamp(element.content_version) !== manifestVersion) blockers.push(`${element.label || element.id} is stale for this manifest version.`)
    if (element.customer_facing) {
      if (!element.input_excerpt) blockers.push(`${element.label || element.id} is customer-facing but has no bounded input excerpt.`)
      if (!element.authoritative_href) blockers.push(`${element.label || element.id} is customer-facing but has no safe authoritative source link.`)
      if (!element.evidence_receipt_ids.length) blockers.push(`${element.label || element.id} is customer-facing but has no evidence receipt.`)
      if (element.rights_privacy_status !== 'passed' || !element.rights_privacy_receipt_ids.length) blockers.push(`${element.label || element.id} is customer-facing but lacks a passing rights/privacy receipt.`)
      if (element.redacted) blockers.push(`${element.label || element.id} cannot be both customer-facing and redacted.`)
    }
    const expectedEvaluationKind = EVALUATION_KIND_BY_CATEGORY[element.category]
    if (element.customer_facing && expectedEvaluationKind) {
      if (element.evaluation_kind !== expectedEvaluationKind || !element.evaluation_receipt) {
        blockers.push(`${element.label || element.id} is missing its versioned ${expectedEvaluationKind.replaceAll('_', ' ')} evaluation receipt.`)
      } else {
        const evaluation = validateArtifactEvaluationReceipt(element.evaluation_receipt, manifest.content_version, evaluationAsOf)
        if (element.evaluation_receipt.evaluation_kind !== expectedEvaluationKind) blockers.push(`${element.label || element.id} has the wrong evaluation kind.`)
        if (!evaluation.ready) blockers.push(...evaluation.blockers.map((blocker) => `${element.label || element.id}: ${blocker}`))
      }
    }
  }

  return { manifest, ready: blockers.length === 0, stale, blockers: [...new Set(blockers)] }
}

export function artifactManifestSnapshot(value: unknown): ArtifactManifestSnapshot | null {
  const manifest = parseArtifactEvidenceManifest(value)
  if (!manifest?.manifest_id || !manifest.manifest_hash || !manifest.content_version) return null
  const evaluationReceipts = manifest.elements
    .map((element) => element.evaluation_receipt)
    .filter((receipt): receipt is ArtifactEvaluationReceipt => Boolean(receipt))
  return {
    manifest_id: manifest.manifest_id,
    manifest_hash: manifest.manifest_hash,
    content_version: manifest.content_version,
    evaluation_receipt_version: evaluationReceipts[0]?.version ?? null,
    evaluation_receipt_ids: evaluationReceipts.map((receipt) => receipt.receipt_id).sort(),
  }
}
