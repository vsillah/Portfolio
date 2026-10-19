import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.env.YOUTUBE_THUMBNAIL_QA_ROOT ? path.resolve(process.env.YOUTUBE_THUMBNAIL_QA_ROOT) : process.cwd()
const targets = [
  {
    name: 'dark-castle',
    directory: 'artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18',
    selection: 'dark-castle-thumbnail-selection-receipt.json',
    output: 'public/review-assets/social-content/youtube-packaging/dark-castle-remember-the-why-v6.png',
    feed: 'public/review-assets/social-content/youtube-packaging/dark-castle-remember-the-why-v6-feed-320x180.png',
  },
  {
    name: 'ai-audit',
    directory: 'artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18',
    selection: 'ai-audit-thumbnail-selection-receipt.json',
    output: 'public/review-assets/social-content/youtube-packaging/ai-audit-who-owns-the-cleanup-v6.png',
    feed: 'public/review-assets/social-content/youtube-packaging/ai-audit-who-owns-the-cleanup-v6-feed-320x180.png',
  },
]

const digest = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`

for (const target of targets) {
  const directory = path.join(root, target.directory)
  const quality = JSON.parse(await readFile(path.join(directory, 'thumbnail-final-quality-v6.json'), 'utf8'))
  const inspection = JSON.parse(await readFile(path.join(directory, 'thumbnail-post-generation-inspection-v6.json'), 'utf8'))
  const selection = JSON.parse(await readFile(path.join(directory, target.selection), 'utf8'))
  const outputSha = digest(await readFile(path.join(root, target.output)))
  const feedSha = digest(await readFile(path.join(root, target.feed)))
  const failures = []
  if (quality.status !== 'passed' || quality.human_qa_artifact_generation_allowed !== true) failures.push('final quality receipt is not passed')
  if (inspection.status !== 'passed' || quality.post_generation_inspection_receipt_id !== inspection.receipt_id) failures.push('inspection receipt is missing or stale')
  if (quality.output_sha256 !== outputSha || inspection.final_output_sha256 !== outputSha || selection.output.sha256 !== outputSha) failures.push('final output hash binding is stale')
  if (quality.feed_preview_sha256 !== feedSha || inspection.feed_preview_sha256 !== feedSha || selection.feed_size_preview.sha256 !== feedSha) failures.push('feed preview hash binding is stale')
  if (selection.version !== 'youtube-thumbnail-selection/v6' || selection.final_quality_gate?.status !== 'passed') failures.push('selection receipt is not v6-passed')
  if (inspection.cohesive_composition_assessment?.status !== 'passed' || inspection.typography_polish_assessment?.status !== 'passed') failures.push('cohesion or typography gate is not passed')
  if (quality.color_polish?.text_panel_contrast_ratio < 4.5 || quality.color_polish?.background_edge_density > 0.035) failures.push('color-polish gate is not passed')
  if (failures.length) throw new Error(`${target.name}: Human-QA evidence generation blocked: ${failures.join('; ')}`)
}

console.log('YouTube thumbnail Human-QA evidence gate: PASSED')
