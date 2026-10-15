export const YOUTUBE_PRESENTER_PACKAGE_VERSION = 'youtube_presenter_package_v1' as const

export type YouTubePresenterTarget = 'youtube_long_form' | 'youtube_shorts'
export type YouTubePresenterLayout = 'presenter_primary' | 'side_evidence' | 'conclusion' | 'cta'

export type YouTubePresenterRegion = {
  x: number
  y: number
  width: number
  height: number
}

export type YouTubePresenterCue = {
  cue_id: string
  layout: YouTubePresenterLayout
  start_seconds: number
  end_seconds: number
  spoken_text: string
  evidence_asset_id?: string | null
  evidence_region_id?: string | null
  presenter_region?: YouTubePresenterRegion | null
  evidence_region?: YouTubePresenterRegion | null
  source_crop?: YouTubePresenterRegion | null
  on_screen_text?: string | null
  loop?: boolean
  delivery?: 'spoken' | 'on_screen_end_card'
}

export type YouTubeEvidenceAsset = {
  asset_id: string
  path: string
  sha256: string
  width: number
  height: number
  source_receipt_id: string
  rights_receipt_id: string
}

export type YouTubePackagingReceipt = {
  receipt_id: string
  status: 'approved' | 'passed' | 'complete' | 'pending' | 'blocked'
  input_version: string
}

export type YouTubePresenterPackage = {
  version: typeof YOUTUBE_PRESENTER_PACKAGE_VERSION
  package_id: string
  target: YouTubePresenterTarget | 'linkedin' | 'non_video'
  review_only: boolean
  input_version: string
  script: {
    template_receipt_id: string
    template_receipt_version: string
    text: string
    sha256: string
    conclusion: string
    channel_cta: string
  }
  native_presenter: {
    path: string
    sha256: string
    provider_job_id: string
    rights_receipt_id: string
    source_script_sha256: string
  }
  render_contract: {
    width: number
    height: number
    fps: number
    background_color: string
    brand_logo: {
      path: string
      sha256: string
    }
    evidence_assets: YouTubeEvidenceAsset[]
  }
  timeline: YouTubePresenterCue[]
  packaging: {
    research_receipt_ids: string[]
    source_receipt_ids: string[]
    claim_ids: string[]
    privacy_receipt_id: string
    rights_receipt_id: string
    title_subject_receipt: YouTubePackagingReceipt & {
      subject: string
      candidates: Array<{
        candidate_id: string
        title: string
        promise: string
        research_receipt_ids: string[]
        source_receipt_ids: string[]
        claim_ids: string[]
      }>
    }
    thumbnail_receipt: YouTubePackagingReceipt & {
      path: string
      sha256: string
      width: number
      height: number
      headline: string
      research_receipt_ids: string[]
      source_receipt_ids: string[]
      claim_ids: string[]
      privacy_receipt_id: string
      rights_receipt_id: string
    }
  }
}

export type YouTubePresenterReadiness = {
  applicable: boolean
  ready: boolean
  blockers: string[]
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function passed(status: YouTubePackagingReceipt['status']) {
  return status === 'approved' || status === 'passed' || status === 'complete'
}

function overlaps(left: YouTubePresenterRegion, right: YouTubePresenterRegion) {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function containsInOrder(text: string, values: string[]) {
  const haystack = normalized(text)
  let offset = 0
  for (const value of values) {
    const needle = normalized(value)
    if (!needle) return false
    const found = haystack.indexOf(needle, offset)
    if (found < 0) return false
    offset = found + needle.length
  }
  return true
}

function sameSet(left: string[], right: string[]) {
  const a = unique(left).sort()
  const b = unique(right).sort()
  return a.length === b.length && a.every((value, index) => value === b[index])
}

export function evaluateYouTubePresenterPackage(input: {
  package: YouTubePresenterPackage
  expectedInputVersion: string
  approvedResearchReceiptIds: string[]
  approvedSourceReceiptIds: string[]
  approvedClaimIds: string[]
  approvedPrivacyReceiptIds: string[]
  approvedRightsReceiptIds: string[]
}): YouTubePresenterReadiness {
  const value = input.package
  if (value.target === 'linkedin' || value.target === 'non_video') {
    return { applicable: false, ready: true, blockers: [] }
  }

  const blockers: string[] = []
  if (value.version !== YOUTUBE_PRESENTER_PACKAGE_VERSION) blockers.push('YouTube presenter package version is missing or unsupported.')
  if (value.input_version !== input.expectedInputVersion) blockers.push('YouTube presenter package is stale for the approved content version.')
  if (!value.review_only) blockers.push('This pipeline stage must remain review-only until a separate release approval exists.')
  if (!value.script.template_receipt_id.trim() || !value.script.template_receipt_version.trim()) blockers.push('A version-bound script template receipt is required.')
  if (!value.script.sha256.startsWith('sha256:')) blockers.push('The reviewed script requires a SHA-256 binding.')
  if (!value.script.conclusion.trim() || !value.script.channel_cta.trim()) blockers.push('YouTube scripts require a substantive conclusion followed by a bounded channel CTA.')
  if (!containsInOrder(value.script.text, [value.script.conclusion, value.script.channel_cta])) {
    blockers.push('The script must contain the substantive conclusion followed by the bounded channel CTA.')
  }

  if (!value.native_presenter.path.trim() || !value.native_presenter.sha256.trim() || !value.native_presenter.provider_job_id.trim()) {
    blockers.push('A hash-bound approved native presenter source is required.')
  }
  if (!input.approvedRightsReceiptIds.includes(value.native_presenter.rights_receipt_id)) blockers.push('Native presenter rights receipt is missing or unapproved.')

  const render = value.render_contract
  if (!render) {
    blockers.push('A deterministic YouTube render contract with valid dimensions, frame rate, and background is required.')
  } else if (render.width < 720 || render.height < 720 || render.fps <= 0 || !render.background_color.trim()) {
    blockers.push('A deterministic YouTube render contract with valid dimensions, frame rate, and background is required.')
  }
  if (render && (!render.brand_logo?.path.trim() || !render.brand_logo.sha256.startsWith('sha256:'))) {
    blockers.push('The render contract requires a hash-bound brand logo.')
  }
  const evidenceAssets = new Map((render?.evidence_assets ?? []).map((asset) => [asset.asset_id, asset]))
  for (const asset of render?.evidence_assets ?? []) {
    if (!asset.asset_id.trim() || !asset.path.trim() || !asset.sha256.startsWith('sha256:') || asset.width <= 0 || asset.height <= 0) {
      blockers.push('Every evidence asset requires a stable identity, path, hash, and dimensions.')
    }
    if (!input.approvedSourceReceiptIds.includes(asset.source_receipt_id)) blockers.push('Evidence asset source receipt is missing or unapproved.')
    if (!input.approvedRightsReceiptIds.includes(asset.rights_receipt_id)) blockers.push('Evidence asset rights receipt is missing or unapproved.')
  }

  const cues = [...value.timeline].sort((left, right) => left.start_seconds - right.start_seconds)
  if (!cues.length || cues[0].layout !== 'presenter_primary' || Math.abs(cues[0].start_seconds) > 0.01) {
    blockers.push('YouTube output must open at zero with the approved presenter as the primary frame.')
  }
  if (cues[0]?.evidence_asset_id || cues[0]?.evidence_region_id) blockers.push('The presenter-first opening cannot display evidence screenshots or diagrams.')
  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index]
    if (!cue.cue_id.trim() || !Number.isFinite(cue.start_seconds) || !Number.isFinite(cue.end_seconds) || cue.end_seconds <= cue.start_seconds) {
      blockers.push('Every presenter timeline cue requires a stable identity and positive time range.')
      continue
    }
    if (index > 0) {
      const prior = cues[index - 1]
      if (cue.start_seconds < prior.end_seconds - 0.02) blockers.push('Presenter timeline cues cannot overlap.')
      if (cue.start_seconds > prior.end_seconds + 0.12) blockers.push('Presenter timeline cues must form a synchronized sequence without unbound gaps.')
    }
    if (cue.layout === 'side_evidence') {
      if (!cue.spoken_text.trim() || !cue.evidence_asset_id?.trim() || !cue.evidence_region_id?.trim()) {
        blockers.push('Every side-evidence change must bind one spoken talking point to one evidence region.')
      }
      if (!cue.presenter_region || !cue.evidence_region) blockers.push('Side evidence requires separate presenter and evidence frames.')
      if (!cue.source_crop) blockers.push('Every side-evidence cue requires a source crop bound to its evidence asset.')
      const asset = cue.evidence_asset_id ? evidenceAssets.get(cue.evidence_asset_id) : undefined
      if (!asset) blockers.push('Every side-evidence cue must reference a declared evidence asset.')
      if (asset && cue.source_crop && (
        cue.source_crop.x < 0 || cue.source_crop.y < 0
        || cue.source_crop.width <= 0 || cue.source_crop.height <= 0
        || cue.source_crop.x + cue.source_crop.width > asset.width
        || cue.source_crop.y + cue.source_crop.height > asset.height
      )) blockers.push('Side-evidence source crops must remain inside the declared evidence asset.')
      if (cue.presenter_region && cue.evidence_region && overlaps(cue.presenter_region, cue.evidence_region)) {
        blockers.push('Presenter video cannot overlap the screenshot or diagram frame.')
      }
      if (cue.loop) blockers.push('Unsynchronized evidence loops are not allowed.')
      if (cue.spoken_text.trim() && !normalized(value.script.text).includes(normalized(cue.spoken_text))) {
        blockers.push(`Evidence cue ${cue.cue_id} is not bound to the reviewed script.`)
      }
    }
  }

  const evidenceCues = cues.filter((cue) => cue.layout === 'side_evidence')
  const evidenceRegionIds = evidenceCues.map((cue) => cue.evidence_region_id ?? '')
  if (evidenceCues.length < 2) blockers.push('Presenter-first YouTube output requires at least two synchronized evidence changes.')
  if (unique(evidenceRegionIds).length !== evidenceRegionIds.length) blockers.push('Evidence regions cannot repeat as an unsynchronized screenshot loop.')

  const conclusionCue = cues.find((cue) => cue.layout === 'conclusion')
  const ctaCue = cues.find((cue) => cue.layout === 'cta')
  if (!conclusionCue || normalized(conclusionCue.spoken_text) !== normalized(value.script.conclusion)) blockers.push('The timeline requires the reviewed substantive conclusion.')
  if (!ctaCue || normalized(ctaCue.spoken_text) !== normalized(value.script.channel_cta)) blockers.push('The timeline requires the reviewed bounded channel CTA.')
  if (conclusionCue && ctaCue && ctaCue.start_seconds < conclusionCue.end_seconds - 0.02) blockers.push('The bounded channel CTA must follow the substantive conclusion.')
  if (ctaCue?.delivery !== 'spoken' && !(value.review_only && ctaCue?.delivery === 'on_screen_end_card')) {
    blockers.push('Release-ready YouTube output requires a spoken CTA; on-screen-only CTA is allowed only for a review artifact.')
  }

  const packageReceipts = value.packaging
  if (!sameSet(packageReceipts.research_receipt_ids, input.approvedResearchReceiptIds)) blockers.push('YouTube packaging research receipts are missing, stale, or mismatched.')
  if (!sameSet(packageReceipts.source_receipt_ids, input.approvedSourceReceiptIds)) blockers.push('YouTube packaging source receipts are missing, stale, or mismatched.')
  if (!sameSet(packageReceipts.claim_ids, input.approvedClaimIds)) blockers.push('YouTube packaging claim bindings are missing or mismatched.')
  if (!input.approvedPrivacyReceiptIds.includes(packageReceipts.privacy_receipt_id)) blockers.push('YouTube packaging privacy receipt is missing or unapproved.')
  if (!input.approvedRightsReceiptIds.includes(packageReceipts.rights_receipt_id)) blockers.push('YouTube packaging rights receipt is missing or unapproved.')

  const titles = packageReceipts.title_subject_receipt
  if (!titles || !passed(titles.status) || titles.input_version !== value.input_version || !titles.receipt_id.trim() || !titles.subject.trim()) {
    blockers.push('A passed, version-bound subject/title receipt is required.')
  }
  if (!titles || titles.candidates.length < 2) blockers.push('At least two research-bound YouTube title candidates are required.')
  for (const candidate of titles?.candidates ?? []) {
    if (!candidate.candidate_id.trim() || !candidate.title.trim() || !candidate.promise.trim()) blockers.push('Every YouTube title candidate requires an identity, title, and promise.')
    if (!sameSet(candidate.research_receipt_ids, packageReceipts.research_receipt_ids)
      || !sameSet(candidate.source_receipt_ids, packageReceipts.source_receipt_ids)
      || !sameSet(candidate.claim_ids, packageReceipts.claim_ids)) {
      blockers.push('Every YouTube title candidate must retain the package research, source, and claim bindings.')
    }
  }

  const thumbnail = packageReceipts.thumbnail_receipt
  if (!thumbnail || !passed(thumbnail.status) || thumbnail.input_version !== value.input_version || !thumbnail.receipt_id.trim()) blockers.push('A passed, version-bound thumbnail receipt is required.')
  if (!thumbnail || !thumbnail.path.trim() || !thumbnail.sha256.startsWith('sha256:') || thumbnail.width < 640 || thumbnail.height < 360 || !thumbnail.headline.trim()) {
    blockers.push('Thumbnail package requires a customer-facing preview, hash, dimensions, and headline.')
  }
  if (thumbnail && (!sameSet(thumbnail.research_receipt_ids, packageReceipts.research_receipt_ids)
    || !sameSet(thumbnail.source_receipt_ids, packageReceipts.source_receipt_ids)
    || !sameSet(thumbnail.claim_ids, packageReceipts.claim_ids)
    || thumbnail.privacy_receipt_id !== packageReceipts.privacy_receipt_id
    || thumbnail.rights_receipt_id !== packageReceipts.rights_receipt_id)) {
    blockers.push('Thumbnail package must retain the same research, source, claim, privacy, and rights bindings.')
  }

  return { applicable: true, ready: unique(blockers).length === 0, blockers: unique(blockers) }
}
