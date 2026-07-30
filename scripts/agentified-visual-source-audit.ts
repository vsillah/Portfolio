import { promises as fs } from 'fs'
import path from 'path'
import sharp from 'sharp'

type CampaignPacket = {
  campaign?: {
    slug?: string
    hero_image_url?: string
  }
  calendar_items?: CampaignItem[]
}

type CampaignItem = {
  asset_id: string
  channel: string
  title: string
  campaign_phase?: string
  planned_angle?: string
  metadata?: {
    draft_asset_path?: string
    visual_asset?: string
  }
}

type Candidate = {
  path: string
  source: 'repo' | 'drive'
  type: 'image' | 'svg' | 'pdf' | 'document' | 'other'
  score: number
  reasons: string[]
  width?: number
  height?: number
}

type DraftReview = {
  asset_id: string
  title: string
  channel: string
  phase: string
  draft_asset_path: string | null
  planned_angle: string
  selected_candidates: Candidate[]
  criteria: Record<string, 'pass' | 'review' | 'blocked'>
  alt_text: string
  recommendation: string
}

const REPO_ROOT = process.cwd()
const DEFAULT_PACKET_PATH = 'agentified/campaign/portfolio-campaign-packet.json'
const DEFAULT_OUTPUT_DIR = 'docs/agentified-visual-qa'
const DEFAULT_SOURCE_ROOTS = [
  'public',
  'agentified/manuscript/visuals',
  'agentified/source-assets',
  'docs/agentic-content-review-packets',
  'agentified/campaign',
]
const DRIVE_ROOTS = [
  '/Users/vambahsillah/Library/CloudStorage/GoogleDrive-vsillah@gmail.com/My Drive/2. AmaduTown Advisory Solutions',
  '/Users/vambahsillah/Library/CloudStorage/GoogleDrive-vsillah@gmail.com/My Drive/2. AmaduTown Advisory Solutions/Artifacts /Company Materials',
]
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const SUPPORTED_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, '.svg', '.pdf', '.pptx', '.gslides', '.gdoc', '.docx'])
const DEFAULT_ASSET_IDS = ['AGT-LI-01', 'AGT-LI-02', 'AGT-CAR-01', 'AGT-LI-03', 'AGT-LI-04', 'AGT-CAR-02', 'AGT-LI-05', 'AGT-LI-06']

function argValue(name: string) {
  const prefix = `--${name}=`
  const item = process.argv.find((value) => value.startsWith(prefix))
  return item ? item.slice(prefix.length) : undefined
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function relativeOrAbsolute(filePath: string) {
  return filePath.startsWith(REPO_ROOT) ? path.relative(REPO_ROOT, filePath) : filePath
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2)
}

function candidateType(filePath: string): Candidate['type'] {
  const ext = path.extname(filePath).toLowerCase()
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (ext === '.svg') return 'svg'
  if (ext === '.pdf') return 'pdf'
  if (['.pptx', '.gslides', '.gdoc', '.docx'].includes(ext)) return 'document'
  return 'other'
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function walk(root: string, maxDepth: number, depth = 0): Promise<string[]> {
  if (depth > maxDepth || !(await exists(root))) return []
  const entries = await fs.readdir(root, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue
    const fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath, maxDepth, depth + 1))
    } else if (SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath)
    }
  }
  return files
}

async function imageDimensions(filePath: string): Promise<Pick<Candidate, 'width' | 'height'>> {
  if (!IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) return {}
  try {
    const meta = await sharp(filePath).metadata()
    return { width: meta.width, height: meta.height }
  } catch {
    return {}
  }
}

function scoreFile(filePath: string, item: CampaignItem, source: Candidate['source']): Omit<Candidate, 'width' | 'height'> {
  const label = `${item.asset_id} ${item.title} ${item.planned_angle ?? ''}`.toLowerCase()
  const fileLabel = relativeOrAbsolute(filePath).toLowerCase()
  const tokens = tokenize(label)
  let score = source === 'repo' ? 20 : 12
  const reasons: string[] = []

  for (const token of tokens) {
    if (fileLabel.includes(token)) score += 5
  }

  const specificHints: Array<[string, string[]]> = [
    ['AGT-LI-01', ['sam-trust', 'authority', 'receipt', 'cover']],
    ['AGT-LI-02', ['receipt', 'handoff', 'authority', 'portfolio-first']],
    ['AGT-CAR-01', ['amina', 'sam', 'trust-layer']],
    ['AGT-LI-03', ['sam', 'accelerated', 'amina']],
    ['AGT-LI-04', ['cover', 'agentified-cover']],
    ['AGT-CAR-02', ['sam', 'amina', 'accelerated']],
    ['AGT-LI-05', ['workbook', 'portfolio-first', 'receipt']],
    ['AGT-LI-06', ['cover', 'authority', 'trust']],
  ]
  const hints = specificHints.find(([assetId]) => assetId === item.asset_id)?.[1] ?? []
  for (const hint of hints) {
    if (fileLabel.includes(hint)) {
      score += 18
      reasons.push(`matches ${hint}`)
    }
  }

  if (item.metadata?.visual_asset && fileLabel.endsWith(item.metadata.visual_asset.toLowerCase())) {
    score += 45
    reasons.push('explicit packet visual asset')
  }
  if (fileLabel.includes('agentified')) {
    score += 10
    reasons.push('Agentified source')
  }
  if (fileLabel.includes('amadutown')) {
    score += 5
    reasons.push('AmaduTown brand source')
  }
  if (fileLabel.includes('source-assets') || fileLabel.includes('rendered')) {
    score += 8
    reasons.push('approved local visual source')
  }
  if (fileLabel.includes('company materials')) {
    score += 4
    reasons.push('company material provenance')
  }

  return {
    path: relativeOrAbsolute(filePath),
    source,
    type: candidateType(filePath),
    score: Math.min(score, 100),
    reasons: Array.from(new Set(reasons)).slice(0, 5),
  }
}

async function findCandidates(items: CampaignItem[]) {
  const repoFiles = (await Promise.all(DEFAULT_SOURCE_ROOTS.map((root) => walk(path.join(REPO_ROOT, root), 6)))).flat()
  const driveFiles = (await Promise.all(DRIVE_ROOTS.map((root) => walk(root, 5)))).flat()
  const allFiles = [
    ...repoFiles.map((filePath) => ({ filePath, source: 'repo' as const })),
    ...driveFiles.map((filePath) => ({ filePath, source: 'drive' as const })),
  ]

  const byAsset = new Map<string, Candidate[]>()
  for (const item of items) {
    const scored = await Promise.all(allFiles.map(async ({ filePath, source }) => ({
      ...scoreFile(filePath, item, source),
      ...await imageDimensions(filePath),
    })))
    byAsset.set(item.asset_id, scored
      .filter((candidate) => candidate.score >= 35)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5))
  }
  return { byAsset, sourceCounts: { repo: repoFiles.length, drive: driveFiles.length } }
}

function reviewCriteria(candidates: Candidate[], item: CampaignItem): DraftReview['criteria'] {
  const top = candidates[0]
  const hasLocalCandidate = candidates.some((candidate) => candidate.source === 'repo')
  const imageCandidate = candidates.find((candidate) => candidate.type === 'image')
  const highEnough = top && top.score >= 60
  const dimensionsOk = imageCandidate?.width && imageCandidate.height
    ? imageCandidate.width >= 1080 && imageCandidate.height >= 1080
    : false

  return {
    brand_fit: hasLocalCandidate ? 'pass' : 'review',
    message_alignment: highEnough ? 'pass' : 'review',
    copy_consistency: item.metadata?.draft_asset_path ? 'pass' : 'review',
    linkedin_dimensions_mobile: dimensionsOk ? 'pass' : 'review',
    accessibility_alt_text: 'review',
    privacy_and_rights: candidates.every((candidate) => candidate.source === 'repo') ? 'pass' : 'review',
    visual_quality_artifacts: dimensionsOk ? 'pass' : 'review',
    human_review_readiness: highEnough ? 'pass' : 'blocked',
  }
}

function recommendation(criteria: DraftReview['criteria']) {
  if (Object.values(criteria).includes('blocked')) {
    return 'Source candidates are not ready. Generate or revise an internal candidate, then rerun QA before human review.'
  }
  if (Object.values(criteria).includes('review')) {
    return 'Candidate can enter internal visual preparation, but human visual/privacy review remains required before provider handoff.'
  }
  return 'Candidate is ready for human visual/privacy review.'
}

function altText(item: CampaignItem) {
  if (item.asset_id.includes('CAR')) {
    const plannedAngle = (item.planned_angle ?? 'the Agentified operating frame').replace(/[.!?]+$/, '')
    return `${item.title} carousel explaining ${plannedAngle}.`
  }
  return `${item.title} visual for the Agentified launch, showing the trust and operating-system idea behind the post.`
}

function buildMarkdown(input: {
  date: string
  packet: CampaignPacket
  reviews: DraftReview[]
  sourceCounts: { repo: number; drive: number }
}) {
  const lines: string[] = []
  lines.push('# Agentified Visual Source Audit')
  lines.push('')
  lines.push(`Date: ${input.date}`)
  lines.push(`Campaign: \`${input.packet.campaign?.slug ?? 'unknown'}\``)
  lines.push('Status: internal visual preparation only')
  lines.push('')
  lines.push('## Boundaries')
  lines.push('')
  lines.push('- No publishing, scheduling, provider draft creation, media upload, or production setting change is authorized by this packet.')
  lines.push('- Passing this packet means a visual candidate is ready for human visual/privacy review only.')
  lines.push('- Failed candidates must loop through revision or generation and receive a fresh QA pass.')
  lines.push('')
  lines.push('## Source Roots Searched')
  lines.push('')
  lines.push(`- Repo files scanned: ${input.sourceCounts.repo}`)
  lines.push(`- Drive files scanned: ${input.sourceCounts.drive}`)
  for (const root of DEFAULT_SOURCE_ROOTS) lines.push(`- \`${root}\``)
  for (const root of DRIVE_ROOTS) lines.push(`- \`${root}\``)
  lines.push('')
  lines.push('## Draft QA Findings')
  lines.push('')

  for (const review of input.reviews) {
    lines.push(`### ${review.asset_id}: ${review.title}`)
    lines.push('')
    lines.push(`- Channel: \`${review.channel}\``)
    lines.push(`- Phase: \`${review.phase}\``)
    lines.push(`- Draft source: ${review.draft_asset_path ? `\`${review.draft_asset_path}\`` : 'not listed'}`)
    lines.push(`- Planned angle: ${review.planned_angle}`)
    lines.push(`- Alt-text draft: ${review.alt_text}`)
    lines.push(`- Recommendation: ${review.recommendation}`)
    lines.push('')
    lines.push('| Criterion | Result |')
    lines.push('| --- | --- |')
    for (const [criterion, result] of Object.entries(review.criteria)) {
      lines.push(`| ${criterion.replace(/_/g, ' ')} | ${result} |`)
    }
    lines.push('')
    lines.push('| Candidate | Source | Type | Score | Dimensions | Reasons |')
    lines.push('| --- | --- | --- | ---: | --- | --- |')
    for (const candidate of review.selected_candidates) {
      const dimensions = candidate.width && candidate.height ? `${candidate.width}x${candidate.height}` : 'n/a'
      lines.push(`| \`${candidate.path}\` | ${candidate.source} | ${candidate.type} | ${candidate.score} | ${dimensions} | ${candidate.reasons.join('; ') || 'keyword/provenance match'} |`)
    }
    if (review.selected_candidates.length === 0) {
      lines.push('| none | n/a | n/a | 0 | n/a | no suitable source candidate found |')
    }
    lines.push('')
  }

  lines.push('## Next Gate')
  lines.push('')
  lines.push('Human visual/privacy approval is still required before any provider handoff, LinkedIn upload, scheduling, or publication.')
  lines.push('')
  return `${lines.join('\n')}\n`
}

async function main() {
  const packetPath = argValue('packet') ?? DEFAULT_PACKET_PATH
  const outputDir = argValue('output-dir') ?? DEFAULT_OUTPUT_DIR
  const date = argValue('date') ?? today()
  const assetIds = (argValue('asset-ids') ?? DEFAULT_ASSET_IDS.join(','))
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const packet = JSON.parse(await fs.readFile(path.join(REPO_ROOT, packetPath), 'utf8')) as CampaignPacket
  const items = (packet.calendar_items ?? []).filter((item) => assetIds.includes(item.asset_id))
  if (items.length === 0) throw new Error('No matching Agentified campaign items found')

  const { byAsset, sourceCounts } = await findCandidates(items)
  const reviews: DraftReview[] = items.map((item) => {
    const selected = byAsset.get(item.asset_id) ?? []
    const criteria = reviewCriteria(selected, item)
    return {
      asset_id: item.asset_id,
      title: item.title,
      channel: item.channel,
      phase: item.campaign_phase ?? 'unknown',
      draft_asset_path: item.metadata?.draft_asset_path ?? null,
      planned_angle: item.planned_angle ?? '',
      selected_candidates: selected,
      criteria,
      alt_text: altText(item),
      recommendation: recommendation(criteria),
    }
  })

  const report = {
    version: 'agentified_visual_source_audit_v1',
    date,
    campaign_slug: packet.campaign?.slug ?? null,
    side_effects: {
      publishes_external_posts: false,
      schedules_external_posts: false,
      uploads_media: false,
      creates_provider_drafts: false,
      mutates_database: false,
    },
    source_counts: sourceCounts,
    reviews,
  }

  if (hasFlag('dry-run')) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  const absoluteOutputDir = path.join(REPO_ROOT, outputDir)
  await fs.mkdir(absoluteOutputDir, { recursive: true })
  const base = `agentified-visual-source-audit-${date}`
  await fs.writeFile(path.join(absoluteOutputDir, `${base}.json`), `${JSON.stringify(report, null, 2)}\n`)
  await fs.writeFile(path.join(absoluteOutputDir, `${base}.md`), buildMarkdown({
    date,
    packet,
    reviews,
    sourceCounts,
  }))
  console.log(`Wrote ${path.join(outputDir, `${base}.md`)}`)
  console.log(`Wrote ${path.join(outputDir, `${base}.json`)}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
