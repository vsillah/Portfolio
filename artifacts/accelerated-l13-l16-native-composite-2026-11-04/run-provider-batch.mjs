import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, open, readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()
const OUTPUT_ROOT = resolve(ROOT, 'artifacts/accelerated-l13-l16-native-composite-2026-11-04')
const REQUEST_ROOT = resolve(ROOT, 'docs/accelerated-course-modules/l13-l16-guided-video')
const SCRIPT_ROOT = resolve(ROOT, 'docs/accelerated-course-modules/curriculum/scripts')
const API = 'https://api.heygen.com'
const LOOK_ID = '329ae68b92d342f6a4362cc656d486a0'
const VOICE_ID = '14b592b937744404a4fa7c01aafd7dbe'
const EXPECTED_HEAD = 'cdcb9adbfd109584ea5bcb4f6eb7e2c02d8a3ea2'
const AUTHORITY_COMMIT = '63103bac7bd2598988674d6f48fc9d70bdbabd2f'
const AGGREGATE_CAP_USD = 36.56
const USD_PER_CREDIT = 1 / 60

const LESSONS = {
  L13: {
    capUsd: 9.08,
    scriptSha256: '3acceee930227d5584d97ef236f04265e17cd3722e12836d60ef55ed17f0d63a',
    requestSha256: 'db52f7b8ca79afc37dd80a698b160bc9543111cc2f9fcf5c09077a743e7aa055',
    packetSha256: 'cdd1168caa00ae43615268158bd2fa9c3e1b86092a4a2ce602880844e96a811e',
    assetMapSha256: '02d147c82162bc9d76065f54eb640b1b28200eac276f2ced975b97249c008c4e',
    audioMapSha256: '02a5f949a5966e68a0abcf3be670404888411d14e425f4e2ec569df4adc59a91',
  },
  L14: {
    capUsd: 8.75,
    scriptSha256: '5ea7d162d96416f328cc74ad70260065ea874fe4314a4529874fd4d543a39643',
    requestSha256: 'f7677ae063c6641838eec81f644ccc5f6f214c37ccea99d3e9cf3e828ebcc20a',
    packetSha256: '7020af28aa300f8ecdf4acea37fef70befc9a72d4b122b46e55bd920b0c9cb9f',
    assetMapSha256: 'f8475a00a80a071ba02f77711476793046380f9cf4a3ee2c3b639fbcf58e64c9',
    audioMapSha256: 'a70dea06d31233cfbe8026febb8d19f91c6ed9002dd7546ce60ed83ee2696a96',
  },
  L15: {
    capUsd: 9.15,
    scriptSha256: '64a2691ab3c66962b4c8906c833cd145345ec7f53adc325f18064e421503d6c0',
    requestSha256: 'e8b72fc0535603209ab8c1fa6fa7e060942104199737a10a2b4aac2876aec79f',
    packetSha256: '39c9fe61885dea3535308efe1a8ba52087d6fc753c395eef35badf91ffc5ec0f',
    assetMapSha256: 'faba0261ba58b48236bb4ffa7a8d93f5823223302a9364db2041d4266500fb5b',
    audioMapSha256: '7e2c7e91aa94883ff674ff15b2590274ba1f754376f8ff31c5fe6cba78ad9570',
  },
  L16: {
    capUsd: 9.58,
    scriptSha256: 'aef51b9f3fce4210afd5f01cb0fdc8001bebd835e27e1ae257958a5b0864135d',
    requestSha256: 'fced240c2e105b21b2feca5648cf41cb6d53dafc0774626663945f31284f8a25',
    packetSha256: '2b603f8d02c77884c998c4698c5b610d1535b25621530de3e22a8be19349f6fc',
    assetMapSha256: '9bab7e83437f54776cf028c94cd7bb6af05cd97def46fa6745cda55ff7493a1f',
    audioMapSha256: '34808777d1a90630a294b35d29cd75cf3aa3142d39a50a7a121a8cc7d7e2b332',
  },
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function sha256Text(value) {
  return createHash('sha256').update(value).digest('hex')
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`)
  return result.stdout.trim()
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      accept: 'application/json',
      'x-api-key': process.env.HEYGEN_API_KEY ?? '',
      ...options.headers,
    },
    signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.error) {
    const message = body?.error?.message ?? body?.message ?? `HTTP ${response.status}`
    throw new Error(`HeyGen ${path} failed: ${message}`)
  }
  return body
}

async function remainingQuota() {
  const body = await api('/v2/user/remaining_quota')
  const quota = body?.data?.remaining_quota
  if (typeof quota !== 'number') throw new Error('HeyGen remaining quota is unavailable.')
  return quota
}

function lessonPaths(lesson) {
  const lower = lesson.toLowerCase()
  return {
    script: resolve(SCRIPT_ROOT, `${lesson}.md`),
    request: resolve(REQUEST_ROOT, `${lower}-heygen-request.json`),
    packet: resolve(REQUEST_ROOT, `${lower}-packet.json`),
    assetMap: resolve(REQUEST_ROOT, `${lower}-asset-map.json`),
    audioMap: resolve(REQUEST_ROOT, `${lower}-audio-map.json`),
    outputDir: resolve(OUTPUT_ROOT, lower),
  }
}

function validateLesson(lesson, expected) {
  const paths = lessonPaths(lesson)
  const actual = {
    scriptSha256: sha256File(paths.script),
    requestSha256: sha256File(paths.request),
    packetSha256: sha256File(paths.packet),
    assetMapSha256: sha256File(paths.assetMap),
    audioMapSha256: sha256File(paths.audioMap),
  }
  for (const [key, value] of Object.entries(actual)) {
    if (value !== expected[key]) throw new Error(`${lesson} ${key} drifted.`)
  }
  const request = JSON.parse(readFileSync(paths.request, 'utf8'))
  const passages = request.segments?.map((segment) => segment.id)
  if (JSON.stringify(passages) !== JSON.stringify(['A01', 'A02', 'A03', 'A04'])) {
    throw new Error(`${lesson} does not bind exactly A01-A04.`)
  }
  const script = request.segments.map((segment) => segment.narration_text).join('\n\n')
  const estimatedSeconds = request.segments.reduce((sum, segment) => sum + segment.duration_seconds, 0)
  const projectedCostUsd = estimatedSeconds * 0.0805
  if (projectedCostUsd > expected.capUsd) throw new Error(`${lesson} projected cost exceeds its cap.`)
  return { paths, request, script, estimatedSeconds, projectedCostUsd, actual }
}

async function reserveState(path, state) {
  const handle = await open(path, 'wx')
  try {
    await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`)
  } finally {
    await handle.close()
  }
}

async function writeState(path, state) {
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`)
}

async function download(url, path) {
  const response = await fetch(url, { signal: AbortSignal.timeout(180_000) })
  if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}.`)
  await writeFile(path, Buffer.from(await response.arrayBuffer()))
}

function probe(path) {
  return JSON.parse(run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=index,codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,channels,sample_rate,nb_frames',
    '-show_entries', 'format=duration,size',
    '-of', 'json',
    path,
  ]))
}

async function pollVideo(videoId, state, statePath) {
  const started = Date.now()
  while (Date.now() - started < 20 * 60_000) {
    const body = await api(`/v3/videos/${encodeURIComponent(videoId)}`)
    const data = body.data ?? body
    console.log(JSON.stringify({ lesson: state.lesson, videoId, status: data.status ?? 'unknown', elapsedSeconds: Math.round((Date.now() - started) / 1000) }))
    if (data.status === 'failed') {
      state.status = 'failed'
      state.failure = data.error?.message ?? data.failure_message ?? 'Provider job failed.'
      await writeState(statePath, state)
      throw new Error(`${state.lesson} failed: ${state.failure}`)
    }
    if (data.status === 'completed' && data.video_url) return data
    await new Promise((resolveWait) => setTimeout(resolveWait, 15_000))
  }
  throw new Error(`${state.lesson} remains unresolved; preserve job ${videoId} and do not retry.`)
}

async function main() {
  if (!process.env.HEYGEN_API_KEY) throw new Error('HEYGEN_API_KEY is required.')
  const head = run('git', ['rev-parse', 'HEAD'])
  if (head !== EXPECTED_HEAD) throw new Error(`Portfolio head drifted: ${head}`)

  const validated = Object.fromEntries(Object.entries(LESSONS).map(([lesson, expected]) => [lesson, validateLesson(lesson, expected)]))
  const aggregateProjected = Object.values(validated).reduce((sum, value) => sum + value.projectedCostUsd, 0)
  if (aggregateProjected > AGGREGATE_CAP_USD) throw new Error('Projected batch cost exceeds the aggregate cap.')

  const [lookBody, voiceBody, videosBody] = await Promise.all([
    api(`/v3/avatars/looks/${LOOK_ID}`),
    api('/v3/voices?type=private&limit=100'),
    api('/v3/videos?limit=100'),
  ])
  const look = lookBody.data ?? lookBody
  if ((look.id ?? look.look_id) !== LOOK_ID || look.status !== 'completed' || !look.supported_api_engines?.includes('avatar_iv')) {
    throw new Error('Approved look identity or Avatar IV support does not match.')
  }
  const voiceRows = Array.isArray(voiceBody.data) ? voiceBody.data : voiceBody.data?.voices ?? []
  const voice = voiceRows.find((row) => (row.id ?? row.voice_id) === VOICE_ID)
  if (!voice || (voice.status && !['ready', 'completed', 'active'].includes(voice.status))) throw new Error('Approved voice identity is unavailable.')

  const existingRows = Array.isArray(videosBody.data) ? videosBody.data : videosBody.data?.videos ?? []
  const firstStatePath = resolve(lessonPaths('L13').outputDir, 'provider-state.json')
  let quotaBeforeBatch = existsSync(firstStatePath)
    ? JSON.parse(await readFile(firstStatePath, 'utf8')).quota_before
    : await remainingQuota()
  if (!existsSync(firstStatePath) && quotaBeforeBatch * USD_PER_CREDIT < AGGREGATE_CAP_USD) {
    throw new Error('Wallet balance is below the authorized aggregate cap.')
  }
  let aggregateCostUsd = 0

  for (const [lesson, expected] of Object.entries(LESSONS)) {
    const data = validated[lesson]
    await mkdir(data.paths.outputDir, { recursive: true })
    const statePath = resolve(data.paths.outputDir, 'provider-state.json')
    const idempotencyKey = sha256Text(JSON.stringify({
      batch: 'accelerated-l13-l16-2026-11-04',
      authorityCommit: AUTHORITY_COMMIT,
      sourceCommit: EXPECTED_HEAD,
      lesson,
      requestSha256: expected.requestSha256,
      avatarId: LOOK_ID,
      voiceId: VOICE_ID,
    }))
    const providerRow = existingRows.find((row) => row.title === `Accelerated ${lesson} review-only source`)
    let state
    let quotaBefore
    let videoId

    if (existsSync(statePath)) {
      state = JSON.parse(await readFile(statePath, 'utf8'))
      if (state.idempotency_key !== idempotencyKey || state.lesson !== lesson || state.retry_count !== 0) {
        throw new Error(`${lesson} persisted state identity does not match the approved request.`)
      }
      if (state.status === 'completed' && state.provider_receipt) {
        const nativePath = resolve(data.paths.outputDir, `accelerated-${lesson.toLowerCase()}-heygen-native.mp4`)
        if (!existsSync(nativePath) || sha256File(nativePath) !== state.provider_receipt.artifact.sha256) {
          throw new Error(`${lesson} completed native source does not match its receipt.`)
        }
        aggregateCostUsd = Number((aggregateCostUsd + state.provider_receipt.billing.cost_usd).toFixed(2))
        console.log(JSON.stringify({ lesson, status: 'reused_completed', videoId: state.provider_job_id, aggregateCostUsd }))
        continue
      }
      if (state.status !== 'submitted' || !state.provider_job_id || state.submitted_once !== true) {
        throw new Error(`${lesson} persisted state is not safely reconcilable.`)
      }
      if (providerRow && (providerRow.id ?? providerRow.video_id) !== state.provider_job_id) {
        throw new Error(`${lesson} provider identity differs from the persisted job.`)
      }
      quotaBefore = state.quota_before
      videoId = state.provider_job_id
      console.log(JSON.stringify({ lesson, status: 'reconciling_existing', videoId, retryCount: 0 }))
    } else {
      if (providerRow) throw new Error(`${lesson} already has an unbound provider job; reconcile it instead of submitting.`)
      quotaBefore = await remainingQuota()
      if (quotaBefore * USD_PER_CREDIT < expected.capUsd) throw new Error(`${lesson} wallet balance is below its authorized cap.`)
      state = {
        schema_version: '1.0',
        lesson,
        idempotency_key: idempotencyKey,
        status: 'reserved',
        reserved_at: new Date().toISOString(),
        submitted_once: false,
        retry_count: 0,
        quota_before: quotaBefore,
        request: {
          source_commit: EXPECTED_HEAD,
          script_source_commit: '932870eccabd393fa7401145b2e38db142891133',
          request_source_commit: '211ab30eaf537c1688828de6c5c0f5206e6c9535',
          authority_source_commit: AUTHORITY_COMMIT,
          ...data.actual,
          passages: ['A01', 'A02', 'A03', 'A04'],
          look_id: LOOK_ID,
          voice_id: VOICE_ID,
          engine: 'avatar_iv',
          aspect_ratio: '16:9',
          resolution: '1080p',
          output_format: 'mp4',
        },
        caps: { lesson_usd: expected.capUsd, aggregate_usd: AGGREGATE_CAP_USD },
      }
      await reserveState(statePath, state)

      let body
      try {
        body = await api('/v3/videos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            type: 'avatar',
            avatar_id: LOOK_ID,
            title: `Accelerated ${lesson} review-only source`,
            aspect_ratio: '16:9',
            output_format: 'mp4',
            resolution: '1080p',
            script: data.script,
            voice_id: VOICE_ID,
            voice_settings: { speed: 1, engine_settings: { engine_type: 'elevenlabs' } },
            engine: { type: 'avatar_iv' },
          }),
        })
      } catch (error) {
        state.status = 'submission_failed'
        state.failure = error instanceof Error ? error.message : String(error)
        await writeState(statePath, state)
        throw error
      }
      videoId = body?.data?.video_id ?? body?.video_id
      if (!videoId) {
        state.status = 'uncertain'
        state.failure = 'Provider response did not contain a video ID.'
        await writeState(statePath, state)
        throw new Error(`${lesson} submission outcome is uncertain; do not retry.`)
      }
      state.status = 'submitted'
      state.submitted_once = true
      state.provider_job_id = videoId
      state.submitted_at = new Date().toISOString()
      await writeState(statePath, state)
      console.log(JSON.stringify({ lesson, status: 'submitted', videoId, idempotencyKey }))
    }

    const completed = await pollVideo(videoId, state, statePath)
    const nativePath = resolve(data.paths.outputDir, `accelerated-${lesson.toLowerCase()}-heygen-native.mp4`)
    await download(completed.video_url, nativePath)
    const mediaProbe = probe(nativePath)
    const durationSeconds = Number(mediaProbe.format.duration)
    const video = mediaProbe.streams.find((stream) => stream.codec_type === 'video')
    const audio = mediaProbe.streams.find((stream) => stream.codec_type === 'audio')
    if (!(durationSeconds > 0) || !video || !audio) throw new Error(`${lesson} native source is not a playable audio/video MP4.`)
    if (Number(video.width) !== 1920 || Number(video.height) !== 1080) throw new Error(`${lesson} native source is not 1920x1080.`)

    const quotaAfter = await remainingQuota()
    const costUsd = Number(((quotaBefore - quotaAfter) * USD_PER_CREDIT).toFixed(2))
    aggregateCostUsd = Number((aggregateCostUsd + costUsd).toFixed(2))
    if (costUsd > expected.capUsd) throw new Error(`${lesson} observed cost ${costUsd} exceeds cap ${expected.capUsd}.`)
    if (aggregateCostUsd > AGGREGATE_CAP_USD) throw new Error(`Observed aggregate cost ${aggregateCostUsd} exceeds cap ${AGGREGATE_CAP_USD}.`)

    const providerReceipt = {
      schema_version: '1.0',
      lesson,
      video_id: videoId,
      title: `Accelerated ${lesson} review-only source`,
      status: 'completed',
      submitted_once: true,
      retry_count: 0,
      idempotency_key: idempotencyKey,
      request: state.request,
      billing: {
        quota_before: quotaBefore,
        quota_after: quotaAfter,
        quota_delta: quotaBefore - quotaAfter,
        cost_usd: costUsd,
        per_job_cap_usd: expected.capUsd,
        aggregate_cost_usd: aggregateCostUsd,
        aggregate_cap_usd: AGGREGATE_CAP_USD,
        cap_result: 'pass',
        auto_reload: 'off',
        purchase_made_for_job: false,
      },
      artifact: {
        filename: basename(nativePath),
        sha256: sha256File(nativePath),
        duration_seconds: durationSeconds,
        width: Number(video.width),
        height: Number(video.height),
        frame_rate: String(video.r_frame_rate),
        video_frames: Number(video.nb_frames),
        video_codec: String(video.codec_name),
        audio_codec: String(audio.codec_name),
        audio_sample_rate_hz: Number(audio.sample_rate),
        audio_channels: Number(audio.channels),
      },
      external_actions: { uploaded: false, published: false, distributed: false, sent_externally: false },
      human_qa: 'pending',
    }
    await writeFile(resolve(data.paths.outputDir, 'provider-receipt.json'), `${JSON.stringify(providerReceipt, null, 2)}\n`)
    state.status = 'completed'
    state.completed_at = new Date().toISOString()
    state.quota_after = quotaAfter
    state.provider_receipt = providerReceipt
    await writeState(statePath, state)
    console.log(JSON.stringify({ lesson, status: 'completed', videoId, costUsd, aggregateCostUsd, sha256: providerReceipt.artifact.sha256 }))
  }

  const quotaAfterBatch = await remainingQuota()
  await writeFile(resolve(OUTPUT_ROOT, 'provider-batch-receipt.json'), `${JSON.stringify({
    schema_version: '1.0',
    status: 'completed',
    lessons: Object.keys(LESSONS),
    source_commit: EXPECTED_HEAD,
    quota_before: quotaBeforeBatch,
    quota_after: quotaAfterBatch,
    aggregate_cost_usd: aggregateCostUsd,
    aggregate_cap_usd: AGGREGATE_CAP_USD,
    auto_reload: 'off',
    retry_count: 0,
    external_actions: { uploaded: false, published: false, distributed: false, sent_externally: false },
  }, null, 2)}\n`)
  console.log(JSON.stringify({ status: 'batch_completed', aggregateCostUsd, quotaBeforeBatch, quotaAfterBatch }))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
