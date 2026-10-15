export const ARTIFACT_EVIDENCE_MANIFEST_VERSION = 'artifact-evidence-manifest/v1' as const

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
  evidence_receipt_ids: string[]
  version_hash: string
  content_version: string
  rights_privacy_status: 'passed' | 'blocked' | 'missing'
  rights_privacy_receipt_ids: string[]
  transformation_step: string
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
    evidence_receipt_ids: strings(candidate.evidence_receipt_ids),
    version_hash: text(candidate.version_hash),
    content_version: text(candidate.content_version),
    rights_privacy_status: status as ArtifactEvidenceElement['rights_privacy_status'],
    rights_privacy_receipt_ids: strings(candidate.rights_privacy_receipt_ids),
    transformation_step: text(candidate.transformation_step),
    ...(region ? { region } : {}),
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

export function validateArtifactEvidenceManifest(value: unknown, currentContentVersion: string): ArtifactEvidenceManifestValidation {
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
  }

  return { manifest, ready: blockers.length === 0, stale, blockers: [...new Set(blockers)] }
}

export function artifactManifestSnapshot(value: unknown): { manifest_id: string; manifest_hash: string; content_version: string } | null {
  const manifest = parseArtifactEvidenceManifest(value)
  if (!manifest?.manifest_id || !manifest.manifest_hash || !manifest.content_version) return null
  return {
    manifest_id: manifest.manifest_id,
    manifest_hash: manifest.manifest_hash,
    content_version: manifest.content_version,
  }
}
