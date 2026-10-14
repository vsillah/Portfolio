import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, open, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  assertAvatarMotionPacket,
  avatarMotionWorstCaseCostUsd,
  buildAvatarMotionCompositeManifest,
  buildAvatarMotionIdempotencyKey,
  decideAvatarMotionReplay,
  validateCompositeProbe,
  validateHeyGenProviderAssets,
  type AvatarMotionPacket,
  type AvatarMotionProviderReceipt,
} from '../lib/social-avatar-motion-composite'

type RunState = {
  idempotencyKey: string
  status: 'reserved' | 'submitted' | 'completed' | 'failed'
  reservedAt: string
  providerJobId?: string
  quotaBefore?: number
  quotaAfter?: number
  providerReceipt?: AvatarMotionProviderReceipt
  failure?: string
  providerError?: { code?: string; message?: string }
}

const args = new Map<string, string>()
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1])
}

const mode = args.get('--mode') ?? 'validate'
const packetPath = resolve(args.get('--packet') ?? 'artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev-avatar-motion-v1.json')
const outputDir = resolve(args.get('--output-dir') ?? 'artifacts/human-qa/artifact-video-review-2026-10-14/jev-avatar-motion-v1')
const statePath = resolve(outputDir, 'provider-state.json')
const presenterPath = resolve(outputDir, 'jev-heygen-presenter-native.mp4')
const compositePath = resolve(outputDir, 'jev-avatar-motion-review.mp4')
const manifestPath = resolve(outputDir, 'jev-avatar-motion-review.manifest.json')

async function main() {
const packet = JSON.parse(await readFile(packetPath, 'utf8')) as AvatarMotionPacket
assertAvatarMotionPacket(packet)
const motionPath = resolve(packet.motionMaster.path)

function fileSha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function run(command: string, commandArgs: string[]) {
  const result = spawnSync(command, commandArgs, { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`)
  return result.stdout.trim()
}

function probe(path: string) {
  return JSON.parse(run('ffprobe', [
    '-v', 'error', '-show_entries', 'stream=index,codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,channels,sample_rate,nb_frames',
    '-show_entries', 'format=duration,size', '-of', 'json', path,
  ])) as {
    streams: Array<Record<string, string | number>>
    format: { duration: string; size: string }
  }
}

async function heygenGet(path: string) {
  const response = await fetch(`https://api.heygen.com${path}`, {
    headers: { 'x-api-key': process.env.HEYGEN_API_KEY ?? '', accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })
  const body = await response.json() as Record<string, unknown>
  if (!response.ok || body.error) throw new Error(`HeyGen read failed with HTTP ${response.status}.`)
  return body
}

async function remainingQuota() {
  const body = await heygenGet('/v2/user/remaining_quota')
  const value = (body.data as { remaining_quota?: unknown } | undefined)?.remaining_quota
  if (typeof value !== 'number') throw new Error('HeyGen remaining quota is unavailable.')
  return value
}

async function readState(): Promise<RunState | null> {
  if (!existsSync(statePath)) return null
  return JSON.parse(await readFile(statePath, 'utf8')) as RunState
}

async function writeState(state: RunState) {
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`)
}

async function reserveState(idempotencyKey: string): Promise<RunState> {
  await mkdir(outputDir, { recursive: true })
  const handle = await open(statePath, 'wx')
  const state: RunState = { idempotencyKey, status: 'reserved', reservedAt: new Date().toISOString() }
  try { await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`) } finally { await handle.close() }
  return state
}

async function download(url: string, path: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) })
  if (!response.ok) throw new Error(`HeyGen output download failed with HTTP ${response.status}.`)
  await writeFile(path, Buffer.from(await response.arrayBuffer()))
}

if (!process.env.HEYGEN_API_KEY && mode === 'generate') throw new Error('HEYGEN_API_KEY is required for generation.')
if (fileSha256(motionPath) !== packet.motionMaster.sha256) throw new Error('Motion master hash does not match the approved packet.')

const idempotencyKey = buildAvatarMotionIdempotencyKey(packet)
const existing = await readState()
const decision = decideAvatarMotionReplay({
  packet,
  existing: existing ? {
    idempotencyKey: existing.idempotencyKey,
    status: existing.status,
    receipt: existing.providerReceipt ?? null,
  } : null,
})

if (mode === 'validate') {
  console.log(JSON.stringify({
    status: decision.action === 'create' ? 'ready' : decision.action === 'reuse' ? 'completed_reusable' : 'blocked_reconcile',
    packet: packetPath,
    idempotencyKey,
    worstCaseCostUsd: avatarMotionWorstCaseCostUsd(packet),
    maxCostUsd: packet.providerAuthorization.maxCostUsd,
    providerJobsAuthorized: packet.providerAuthorization.maxProviderJobs,
    replay: decision,
    gates: { upload: false, platformDraft: false, schedule: false, publish: false, externalSend: false },
  }, null, 2))
  process.exit(0)
}

if (mode === 'generate') {
  if (decision.action === 'reuse') {
    console.log(JSON.stringify({ status: 'reused', providerReceipt: decision.receipt }, null, 2))
    process.exit(0)
  }
  if (decision.action === 'reconcile') throw new Error(decision.reason)
  const [avatarCatalog, voiceCatalog] = await Promise.all([
    heygenGet('/v2/avatars'),
    heygenGet('/v2/voices'),
  ])
  const avatarData = avatarCatalog.data as {
    avatars?: Array<{ avatar_id?: string; status?: string }>
    talking_photos?: Array<{ talking_photo_id?: string; status?: string }>
  } | undefined
  const voiceData = voiceCatalog.data as {
    voices?: Array<{ voice_id?: string; status?: string }>
  } | undefined
  const providerAssetBlockers = validateHeyGenProviderAssets({
    packet,
    avatars: [
      ...(avatarData?.avatars ?? []).map((value) => ({ id: value.avatar_id ?? '', status: value.status })),
      ...(avatarData?.talking_photos ?? []).map((value) => ({ id: value.talking_photo_id ?? '', status: value.status })),
    ],
    voices: (voiceData?.voices ?? []).map((value) => ({ id: value.voice_id ?? '', status: value.status })),
  })
  if (providerAssetBlockers.length) throw new Error(providerAssetBlockers.join(' '))
  const state = await reserveState(idempotencyKey)
  state.quotaBefore = await remainingQuota()
  await writeState(state)

  const response = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.HEYGEN_API_KEY ?? '',
    },
    body: JSON.stringify({
      title: 'Jev presenter clip - review only',
      callback_id: idempotencyKey,
      dimension: { width: 1080, height: 1920 },
      video_inputs: [{
        character: { type: 'avatar', avatar_id: packet.avatar.id },
        voice: { type: 'text', voice_id: packet.voice.id, input_text: packet.script.text, speed: 1 },
      }],
    }),
    signal: AbortSignal.timeout(60_000),
  })
  const body = await response.json() as { error?: unknown; message?: string; data?: { video_id?: string } }
  const providerJobId = body.data?.video_id
  if (!response.ok || body.error || !providerJobId) {
    state.status = 'failed'
    const providerError = typeof body.error === 'object' && body.error
      ? body.error as { code?: string; message?: string }
      : { message: body.message }
    state.providerError = providerError
    state.failure = providerError.message || `HeyGen generation failed with HTTP ${response.status}.`
    await writeState(state)
    throw new Error(state.failure)
  }
  state.status = 'submitted'
  state.providerJobId = providerJobId
  await writeState(state)
  console.log(JSON.stringify({ status: 'submitted', providerJobId, idempotencyKey }))

  const started = Date.now()
  let completed: { video_url?: string; duration?: number } | null = null
  while (Date.now() - started < 5 * 60_000) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 20_000))
    const statusBody = await heygenGet(`/v1/video_status.get?video_id=${encodeURIComponent(providerJobId)}`)
    const data = statusBody.data as { status?: string; video_url?: string; duration?: number; error?: { code?: string; message?: string } } | undefined
    console.log(JSON.stringify({ status: data?.status ?? 'unknown', elapsedSeconds: Math.round((Date.now() - started) / 1000) }))
    if (data?.status === 'failed') {
      state.status = 'failed'
      state.quotaAfter = await remainingQuota().catch(() => undefined)
      state.providerError = data.error
      state.failure = data.error?.message || 'HeyGen provider job failed.'
      await writeState(state)
      throw new Error(state.failure)
    }
    if (data?.status === 'completed' && data.video_url) {
      completed = data
      break
    }
  }
  if (!completed?.video_url) throw new Error('HeyGen job is still processing; keep this state and reconcile the same provider job later.')
  await download(completed.video_url, presenterPath)
  const presenterProbe = probe(presenterPath)
  const durationSeconds = Number(presenterProbe.format.duration)
  if (!(durationSeconds > 0 && durationSeconds <= packet.providerAuthorization.maxBillableSeconds)) {
    throw new Error('Provider output duration exceeds the authorized billable bound.')
  }
  state.quotaAfter = await remainingQuota()
  const standardRateUsdPerMinute = 1
  const costUsd = Number(((durationSeconds * standardRateUsdPerMinute) / 60).toFixed(4))
  if (costUsd > packet.providerAuthorization.maxCostUsd) throw new Error('Observed provider cost exceeds the authorized cap.')
  const providerReceipt: AvatarMotionProviderReceipt = {
    idempotencyKey,
    provider: 'heygen',
    providerJobId,
    outputSha256: fileSha256(presenterPath),
    durationSeconds,
    costUsd,
    status: 'completed',
  }
  state.status = 'completed'
  state.providerReceipt = providerReceipt
  await writeState(state)
  await writeFile(resolve(outputDir, 'jev-heygen-presenter-native.receipt.json'), `${JSON.stringify({
    ...providerReceipt,
    pricing: {
      apiRateUsdPerMinute: standardRateUsdPerMinute,
      billingBasis: 'actual generated seconds',
      quotaBefore: state.quotaBefore,
      quotaAfter: state.quotaAfter,
      quotaDelta: typeof state.quotaBefore === 'number' && typeof state.quotaAfter === 'number'
        ? Number((state.quotaBefore - state.quotaAfter).toFixed(4))
        : null,
      authorizedMaximumUsd: packet.providerAuthorization.maxCostUsd,
      worstCaseBoundUsd: avatarMotionWorstCaseCostUsd(packet),
    },
    probe: presenterProbe,
  }, null, 2)}\n`)
  console.log(JSON.stringify({ status: 'completed', presenterPath, providerReceipt, quotaBefore: state.quotaBefore, quotaAfter: state.quotaAfter }, null, 2))
  process.exit(0)
}

if (mode === 'compose') {
  if (!existing?.providerReceipt || existing.status !== 'completed' || !existsSync(presenterPath)) {
    throw new Error('A completed, hash-bound native presenter receipt is required before composition.')
  }
  if (fileSha256(presenterPath) !== existing.providerReceipt.outputSha256) throw new Error('Native presenter file does not match its provider receipt.')
  const presenterProbe = probe(presenterPath)
  const duration = Number(presenterProbe.format.duration)
  const firstEnd = Math.min(3.2, duration * 0.28)
  const secondEnd = Math.min(duration - 2.8, firstEnd + 4.8)
  const windows = [
    { sourceStart: 0, sourceEnd: firstEnd, outputStart: 0, x: 650, y: 1080, width: 360, height: 640 },
    { sourceStart: firstEnd, sourceEnd: secondEnd, outputStart: 7.7, x: 650, y: 1080, width: 360, height: 640 },
    { sourceStart: secondEnd, sourceEnd: duration, outputStart: Math.max(17.2, 22 - (duration - secondEnd)), x: 650, y: 1080, width: 360, height: 640 },
  ].filter((window) => window.sourceEnd - window.sourceStart > 0.15)
  if (windows.length < 2) throw new Error('Presenter clip is too short for the required bounded windows.')

  const videoFilters: string[] = [`[1:v]split=${windows.length}${windows.map((_, index) => `[pv${index}]`).join('')}`]
  const audioFilters: string[] = [`[1:a]asplit=${windows.length}${windows.map((_, index) => `[pa${index}]`).join('')}`]
  windows.forEach((window, index) => {
    videoFilters.push(`[pv${index}]trim=start=${window.sourceStart}:end=${window.sourceEnd},setpts=PTS-STARTPTS+${window.outputStart}/TB,scale=${window.width}:-2:force_original_aspect_ratio=decrease,pad=${window.width}:${window.height}:(ow-iw)/2:(oh-ih)/2:color=0x07101b@1[p${index}]`)
    const delayMs = Math.round(window.outputStart * 1000)
    audioFilters.push(`[pa${index}]atrim=start=${window.sourceStart}:end=${window.sourceEnd},asetpts=PTS-STARTPTS,adelay=${delayMs}|${delayMs}[a${index}]`)
  })
  let prior = '[0:v]'
  windows.forEach((window, index) => {
    const end = window.outputStart + (window.sourceEnd - window.sourceStart)
    const next = index === windows.length - 1 ? '[video]' : `[v${index}]`
    videoFilters.push(`${prior}[p${index}]overlay=x=${window.x}:y=${window.y}:enable='between(t,${window.outputStart},${end})'${next}`)
    prior = next
  })
  audioFilters.push(`[0:a]volume=0[basea]`)
  audioFilters.push(`[basea]${windows.map((_, index) => `[a${index}]`).join('')}amix=inputs=${windows.length + 1}:duration=longest:normalize=0[audio]`)
  const filterComplex = [...videoFilters, ...audioFilters].join(';')
  const commandArgs = [
    '-y', '-i', motionPath, '-i', presenterPath,
    '-filter_complex', filterComplex,
    '-map', '[video]', '-map', '[audio]', '-t', String(packet.motionMaster.durationSeconds),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(packet.motionMaster.fps),
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', compositePath,
  ]
  run('ffmpeg', commandArgs)
  const outputProbe = probe(compositePath)
  const probeBlockers = validateCompositeProbe(outputProbe, {
    durationSeconds: packet.motionMaster.durationSeconds,
    width: packet.motionMaster.width,
    height: packet.motionMaster.height,
  })
  if (probeBlockers.length) throw new Error(probeBlockers.join(' '))
  const outputSha256 = fileSha256(compositePath)
  const ffmpegCommand = `ffmpeg ${commandArgs.map((value) => JSON.stringify(value)).join(' ')}`
  const manifest = buildAvatarMotionCompositeManifest({
    packet,
    providerReceipt: existing.providerReceipt,
    presenterSourcePath: presenterPath,
    outputPath: compositePath,
    outputSha256,
    ffmpegCommand,
    presenterWindows: windows,
  })
  await writeFile(manifestPath, `${JSON.stringify({ ...manifest, presenter_probe: presenterProbe, output_probe: outputProbe }, null, 2)}\n`)
  console.log(JSON.stringify({ status: 'composed', compositePath, manifestPath, outputSha256, windows, outputProbe }, null, 2))
  process.exit(0)
}

throw new Error(`Unsupported mode: ${mode}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
