import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { analyzeSpatialLayout, analyzeThumbnailRaster, sha256 } from '../qa/youtube-thumbnail-quality-contract.mjs'

const root = process.cwd()
const decisionPath = path.resolve(root, 'artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/thumbnail-decision-receipt.json')
const outputRoot = path.resolve(root, 'artifacts/research/youtube-thumbnail-taste-reference-2026-10-18')
const decision = JSON.parse(await readFile(decisionPath, 'utf8'))
const preference = decision.user_preference_signals?.[0]
if (!preference || preference.performance_weight !== 0 || preference.evidence_role !== 'taste_calibration_only' || preference.performance_status !== 'unscored') throw new Error('Curated playlist is not bounded to zero-weight taste calibration.')
await mkdir(outputRoot, { recursive: true })

const references = []
for (const item of preference.item_identities) {
  const artifactPath = path.join(outputRoot, `${item.video_id}.jpg`)
  const sourceUrl = `https://i.ytimg.com/vi/${item.video_id}/hqdefault.jpg`
  let imageBytes
  if (process.env.REUSE_CAPTURE === '1') imageBytes = await readFile(artifactPath)
  else {
    const response = await fetch(sourceUrl)
    if (!response.ok) throw new Error(`${item.video_id}: playlist thumbnail capture failed with ${response.status}`)
    const sourceBytes = Buffer.from(await response.arrayBuffer())
    imageBytes = await sharp(sourceBytes).resize(640, 360, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer()
    await writeFile(artifactPath, imageBytes)
  }
  references.push({
    video_id: item.video_id,
    source_url: item.source_url,
    thumbnail_source_url: sourceUrl,
    artifact_path: path.relative(root, artifactPath),
    sha256: sha256(imageBytes),
    metrics: await analyzeThumbnailRaster(imageBytes),
    spatial_layout: await analyzeSpatialLayout(imageBytes),
  })
}

const observedAt = process.env.OBSERVED_AT ?? new Date().toISOString()
const freshUntil = new Date(Date.parse(observedAt) + (14 * 24 * 60 * 60 * 1000)).toISOString()
const payload = {
  version: 'youtube-thumbnail-taste-reference/v2',
  receipt_id: 'taste:youtube-thumbnail:curated-playlist:20261018:v2',
  source_url: preference.source_url,
  captured_at: observedAt,
  fresh_until: freshUntil,
  status: 'ready',
  evidence_role: 'taste_calibration_only',
  performance_weight: 0,
  performance_status: 'unscored',
  references,
}
payload.input_version = sha256(Buffer.from(JSON.stringify(payload)))
await writeFile(path.join(outputRoot, 'receipt.json'), `${JSON.stringify(payload, null, 2)}\n`)
console.log(JSON.stringify({ receipt_id: payload.receipt_id, input_version: payload.input_version, references: references.length }))
