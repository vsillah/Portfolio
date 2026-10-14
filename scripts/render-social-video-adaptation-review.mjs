#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'
import {
  assertSocialVideoClientFacingText,
  buildSocialVideoClientFrameSvg,
} from '../lib/social-video-client-frame.mjs'

const REQUIRED_RECEIPTS = [
  'source',
  'voice',
  'framework',
  'privacy',
  'visual',
  'rights',
  'challenger',
  'script_quality',
]

function argument(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback
}

function fail(message) {
  throw new Error(message)
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function validatePacket(packet, expectedPrefix, target) {
  if (packet.version !== 'social_video_adaptation_v1') fail('Packet version is missing or unsupported.')
  if (packet.status !== 'ready_for_render_approval') fail('Packet has not reached the approved render-review gate.')
  if (!String(packet.input_version ?? '').startsWith(`sha256:${expectedPrefix}`)) fail(`Packet input version does not match expected prefix ${expectedPrefix}.`)
  if (!packet.targets?.includes(target)) fail(`Packet does not approve target ${target}.`)

  const generatedAt = Date.parse(packet.generated_at)
  if (!Number.isFinite(generatedAt)) fail('Packet generated_at is invalid.')
  for (const kind of REQUIRED_RECEIPTS) {
    const receipt = packet.receipts?.[kind]
    if (!receipt || receipt.kind !== kind || !receipt.receipt_id) fail(`Required ${kind} receipt is missing.`)
    if (!['approved', 'passed', 'complete'].includes(receipt.status)) fail(`${kind} receipt has not passed.`)
    if (receipt.input_version !== packet.input_version) fail(`${kind} receipt is stale for this packet.`)
    if (!Number.isFinite(Date.parse(receipt.reviewed_at))) fail(`${kind} receipt review timestamp is invalid.`)
    if (receipt.valid_until && Date.parse(receipt.valid_until) < generatedAt) fail(`${kind} receipt expired before packet generation.`)
  }

  const sideEffects = packet.video_generation_bridge?.side_effects ?? {}
  for (const key of ['provider_generation', 'upload', 'platform_draft', 'schedule', 'publish', 'external_send', 'credential_change', 'spending']) {
    if (sideEffects[key] !== false) fail(`Provider-off boundary is incomplete: ${key} must be false.`)
  }

  const scenes = packet.draft?.scenes?.filter((scene) => scene.target === target) ?? []
  if (!scenes.length) fail(`No ${target} scenes are present.`)
  const sceneIds = new Set(scenes.map((scene) => scene.scene_id))
  const shots = packet.draft?.shot_plan?.filter((shot) => sceneIds.has(shot.scene_id)) ?? []
  for (const scene of scenes) {
    if (!shots.some((shot) => shot.scene_id === scene.scene_id)) fail(`Scene ${scene.scene_id} has no approved shot.`)
  }
  return { scenes, shots }
}

async function renderFrame({ packet, scene, assetPath, framePath, brandLogoPath, index, total }) {
  const source = await sharp(assetPath)
    .rotate()
    .resize({ width: 1136, height: 760, fit: 'contain', background: '#081525' })
    .png()
    .toBuffer()
  const logo = await sharp(brandLogoPath)
    .rotate()
    .resize({ width: 62, height: 72, fit: 'contain' })
    .png()
    .toBuffer()
  const onScreen = scene.on_screen_text?.join(' · ') || scene.purpose
  const title = packet.draft.title_options?.[0]?.title ?? packet.identity.product_id
  assertSocialVideoClientFacingText([title, onScreen, scene.narration])
  const overlay = Buffer.from(buildSocialVideoClientFrameSvg({
    title,
    onScreenText: onScreen,
    narration: scene.narration,
    progress: index + 1,
    total,
  }))

  await sharp(overlay)
    .composite([
      { input: source, left: 52, top: 152 },
      { input: logo, left: 34, top: 18 },
    ])
    .png()
    .toFile(framePath)
}

const packetPath = resolve(argument('packet'))
const assetMapPath = resolve(argument('asset-map'))
const outputPath = resolve(argument('output'))
const expectedPrefix = argument('expected-prefix')
const target = argument('target', 'youtube_shorts')
const frameSeconds = Number(argument('frame-seconds', '4'))
const brandLogoPath = resolve(argument('brand-logo', 'public/amadutown-logo-upscaled.png'))
if (!packetPath || !assetMapPath || !outputPath || !expectedPrefix) fail('Required arguments: --packet, --asset-map, --output, --expected-prefix.')
if (!Number.isFinite(frameSeconds) || frameSeconds < 2 || frameSeconds > 12) fail('frame-seconds must be between 2 and 12.')

const packet = JSON.parse(readFileSync(packetPath, 'utf8'))
const assetMap = JSON.parse(readFileSync(assetMapPath, 'utf8'))
const { scenes, shots } = validatePacket(packet, expectedPrefix, target)
const assets = new Map(packet.evidence_assets.map((asset) => [asset.asset_id, asset]))
const sceneMap = new Map(scenes.map((scene) => [scene.scene_id, scene]))
const orderedShots = scenes.flatMap((scene) => shots.filter((shot) => shot.scene_id === scene.scene_id))
const workDir = `${outputPath}.frames`
rmSync(workDir, { recursive: true, force: true })
mkdirSync(workDir, { recursive: true })
mkdirSync(dirname(outputPath), { recursive: true })

const framePaths = []
for (const [index, shot] of orderedShots.entries()) {
  const scene = sceneMap.get(shot.scene_id)
  const asset = assets.get(shot.artifact_id)
  if (!scene || !asset) fail(`Shot ${shot.shot_id} references an unknown scene or asset.`)
  const mapped = assetMap[shot.artifact_id]
  if (!mapped) fail(`Local asset map is missing ${shot.artifact_id}.`)
  const assetPath = resolve(dirname(assetMapPath), mapped)
  const framePath = resolve(workDir, `${String(index + 1).padStart(2, '0')}-${shot.shot_id}.png`)
  await renderFrame({ packet, scene, assetPath, framePath, brandLogoPath, index, total: orderedShots.length })
  framePaths.push(framePath)
}

const concatPath = resolve(workDir, 'frames.txt')
const concatLines = framePaths.flatMap((path) => [`file '${path.replaceAll("'", "'\\''")}'`, `duration ${frameSeconds}`])
concatLines.push(`file '${framePaths[framePaths.length - 1].replaceAll("'", "'\\''")}'`)
writeFileSync(concatPath, `${concatLines.join('\n')}\n`)

execFileSync('ffmpeg', [
  '-y',
  '-f', 'concat',
  '-safe', '0',
  '-i', concatPath,
  '-f', 'lavfi',
  '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
  '-vf', 'fps=30,format=yuv420p',
  '-c:v', 'libx264',
  '-preset', 'medium',
  '-crf', '20',
  '-c:a', 'aac',
  '-b:a', '128k',
  '-shortest',
  '-movflags', '+faststart',
  outputPath,
], { stdio: 'inherit' })

const probe = JSON.parse(execFileSync('ffprobe', [
  '-v', 'error',
  '-show_entries', 'format=duration,size:stream=codec_name,width,height,r_frame_rate',
  '-of', 'json',
  outputPath,
], { encoding: 'utf8' }))
const receiptPath = outputPath.replace(/\.mp4$/i, '.receipt.json')
const receipt = {
  version: 'social_video_adaptation_local_render_v1',
  rendered_at: new Date().toISOString(),
  packet: packetPath,
  packet_adaptation_id: packet.adaptation_id,
  input_version: packet.input_version,
  expected_input_version_prefix: expectedPrefix,
  target,
  scene_ids: scenes.map((scene) => scene.scene_id),
  shot_ids: orderedShots.map((shot) => shot.shot_id),
  asset_ids: [...new Set(orderedShots.map((shot) => shot.artifact_id))],
  receipt_ids: Object.fromEntries(REQUIRED_RECEIPTS.map((kind) => [kind, packet.receipts[kind].receipt_id])),
  authority: 'Phase 4 delegated local review render only',
  provider: 'none',
  network_calls: 0,
  external_calls: 0,
  side_effects: {
    provider_generation: false,
    upload: false,
    platform_draft: false,
    schedule: false,
    publish: false,
    external_send: false,
    credential_change: false,
    spending: false,
  },
  output: {
    path: outputPath,
    sha256: sha256(outputPath),
    probe,
  },
}
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
rmSync(workDir, { recursive: true, force: true })
console.log(JSON.stringify({ outputPath, receiptPath, duration: probe.format?.duration, sha256: receipt.output.sha256 }, null, 2))
