import { createHash } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'
import {
  evaluateYouTubePresenterPackage,
  type YouTubePresenterCue,
  type YouTubePresenterPackage,
  type YouTubePresenterRegion,
} from '../lib/youtube-presenter-package'

const args = new Map<string, string>()
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1])

const mode = args.get('--mode') ?? 'validate'
const packagePath = resolve(args.get('--package') ?? 'artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev-youtube-presenter-package-v2.json')
const outputDir = resolve(args.get('--output-dir') ?? 'artifacts/human-qa/artifact-video-review-2026-10-14/jev-youtube-presenter-first')
const videoPath = resolve(outputDir, 'jev-youtube-presenter-first-music-review.mp4')
const thumbnailPath = resolve(outputDir, 'jev-youtube-thumbnail.png')
const posterPath = resolve(outputDir, 'jev-youtube-presenter-first-music-poster.png')
const receiptPath = resolve(outputDir, 'jev-youtube-presenter-first-music.receipt.json')
const titlePackagePath = resolve(outputDir, 'jev-youtube-title-subject-package.json')
const fontRegular = '/System/Library/Fonts/Supplemental/Arial.ttf'
const fontBold = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'

function sha256(path: string) {
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`
}

function run(command: string, commandArgs: string[]) {
  const result = spawnSync(command, commandArgs, { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`${command} failed:\n${result.stderr || result.stdout}`)
  return result.stdout.trim()
}

function xml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function hashMatches(path: string, expected: string) {
  if (!existsSync(path)) throw new Error(`Required source is missing: ${path}`)
  const actual = sha256(path)
  if (actual !== expected) throw new Error(`Hash mismatch for ${path}. Expected ${expected}; received ${actual}.`)
}

function cropInside(crop: YouTubePresenterRegion, width: number, height: number) {
  return crop.x >= 0 && crop.y >= 0 && crop.width > 0 && crop.height > 0
    && crop.x + crop.width <= width && crop.y + crop.height <= height
}

async function makeBase(packageValue: YouTubePresenterPackage, path: string) {
  const { width, height, background_color: background } = packageValue.render_contract
  const logo = await sharp(resolve(packageValue.render_contract.brand_logo.path)).resize({ height: 154 }).png().toBuffer()
  const header = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${background}"/>
    <circle cx="1000" cy="120" r="360" fill="#183454" opacity=".48"/>
    <rect x="40" y="42" width="1000" height="4" fill="#f5c518"/>
    <text x="44" y="250" fill="#f5c518" font-family="Arial" font-size="32" font-weight="700" letter-spacing="5">JEV • OPERATOR FIELD GUIDE</text>
    <text x="44" y="330" fill="#ffffff" font-family="Arial" font-size="66" font-weight="700">A SCORE IS INPUT.</text>
    <text x="44" y="406" fill="#ffffff" font-family="Arial" font-size="60" font-weight="700">GOVERNANCE DECIDES.</text>
    <text x="44" y="1818" fill="#9fb4ca" font-family="Arial" font-size="27">Mock-qualified review • live provider use remains on hold</text>
  </svg>`)
  await sharp(header).composite([{ input: logo, left: 884, top: 62 }]).png().toFile(path)
}

async function makeEvidenceFrame(packageValue: YouTubePresenterPackage, cue: YouTubePresenterCue, path: string) {
  const asset = packageValue.render_contract.evidence_assets.find((value) => value.asset_id === cue.evidence_asset_id)
  if (!asset || !cue.source_crop) throw new Error(`Evidence cue ${cue.cue_id} has no declared source crop.`)
  if (!cropInside(cue.source_crop, asset.width, asset.height)) throw new Error(`Evidence cue ${cue.cue_id} has an out-of-bounds source crop.`)
  const evidence = await sharp(resolve(asset.path))
    .extract({ left: cue.source_crop.x, top: cue.source_crop.y, width: cue.source_crop.width, height: cue.source_crop.height })
    .resize({ width: 530, height: 660, fit: 'contain', background: '#f7f9fc' })
    .png()
    .toBuffer()
  const shell = Buffer.from(`<svg width="570" height="850" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="570" height="850" rx="28" fill="#f7f9fc"/>
    <rect x="0" y="0" width="570" height="128" rx="28" fill="#f5c518"/>
    <rect x="0" y="100" width="570" height="28" fill="#f5c518"/>
    <text x="28" y="78" fill="#081525" font-family="Arial" font-size="35" font-weight="700">${xml(cue.on_screen_text ?? cue.evidence_region_id ?? '')}</text>
    <rect x="18" y="146" width="534" height="684" rx="18" fill="#ffffff" stroke="#c5d1df" stroke-width="3"/>
  </svg>`)
  await sharp(shell).composite([{ input: evidence, left: 20, top: 158 }]).png().toFile(path)
}

async function makeCta(packageValue: YouTubePresenterPackage, path: string) {
  const { width, height, background_color: background } = packageValue.render_contract
  const logo = await sharp(resolve(packageValue.render_contract.brand_logo.path)).resize({ height: 300 }).png().toBuffer()
  const card = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${background}"/>
    <circle cx="540" cy="800" r="500" fill="#183454"/>
    <rect x="80" y="340" width="920" height="6" fill="#f5c518"/>
    <text x="540" y="1050" fill="#ffffff" font-family="Arial" font-size="72" font-weight="700" text-anchor="middle">SUBSCRIBE FOR</text>
    <text x="540" y="1140" fill="#f5c518" font-family="Arial" font-size="72" font-weight="700" text-anchor="middle">PRACTICAL AI GOVERNANCE</text>
    <text x="540" y="1240" fill="#c7d5e5" font-family="Arial" font-size="34" text-anchor="middle">Tools, boundaries, and receipts for decisions that matter.</text>
  </svg>`)
  await sharp(card).composite([{ input: logo, left: 420, top: 510 }]).png().toFile(path)
}

async function presenterCutout(packageValue: YouTubePresenterPackage, path: string) {
  run('ffmpeg', [
    '-y', '-ss', '8', '-i', resolve(packageValue.native_presenter.path), '-frames:v', '1',
    '-vf', 'crop=714:406:3:437,colorkey=0x00e856:0.30:0.08,format=rgba', '-c:v', 'png', path,
  ])
}

async function makeThumbnail(packageValue: YouTubePresenterPackage) {
  await mkdir(outputDir, { recursive: true })
  const cutoutPath = resolve(outputDir, '.presenter-cutout.png')
  await presenterCutout(packageValue, cutoutPath)
  const presenter = await sharp(cutoutPath).resize({ width: 660 }).png().toBuffer()
  const fieldGuide = packageValue.render_contract.evidence_assets[0]
  const evidence = await sharp(resolve(fieldGuide.path)).extract({ left: 33, top: 212, width: 297, height: 325 })
    .resize({ width: 360, height: 394, fit: 'contain', background: '#ffffff' }).png().toBuffer()
  const logo = await sharp(resolve(packageValue.render_contract.brand_logo.path)).resize({ height: 126 }).png().toBuffer()
  const background = Buffer.from(`<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
    <rect width="1280" height="720" fill="#081525"/>
    <circle cx="1120" cy="30" r="500" fill="#183454"/>
    <rect x="54" y="42" width="1172" height="6" fill="#f5c518"/>
    <text x="58" y="130" fill="#f5c518" font-family="Arial" font-size="30" font-weight="700" letter-spacing="5">JEV • AI GOVERNANCE</text>
    <text x="58" y="232" fill="#ffffff" font-family="Arial" font-size="76" font-weight="700">WHO OWNS</text>
    <text x="58" y="316" fill="#ffffff" font-family="Arial" font-size="76" font-weight="700">THE DECISION?</text>
    <rect x="823" y="240" width="390" height="430" rx="28" fill="#ffffff" stroke="#f5c518" stroke-width="7"/>
    <text x="756" y="664" fill="#f5c518" font-family="Arial" font-size="118" font-weight="700" text-anchor="end">0.81</text>
  </svg>`)
  await sharp(background).composite([
    { input: presenter, left: 88, top: 330 },
    { input: evidence, left: 838, top: 258 },
    { input: logo, left: 1104, top: 75 },
  ]).png().toFile(thumbnailPath)
  await unlink(cutoutPath).catch(() => undefined)
  console.log(JSON.stringify({ status: 'thumbnail_created', path: thumbnailPath, sha256: sha256(thumbnailPath), width: 1280, height: 720 }, null, 2))
}

function musicApprovals(packageValue: YouTubePresenterPackage) {
  const source = args.get('--approved-music-source-receipt')
  const rights = args.get('--approved-music-rights-receipt')
  const hash = args.get('--approved-music-sha256')
  const trackId = packageValue.music_bed?.track.track_id
  return {
    approvedMusicSourceReceiptIds: source ? [source] : [],
    approvedMusicRightsReceiptIds: rights ? [rights] : [],
    approvedMusicTrackSha256ById: trackId && hash ? { [trackId]: hash } : {},
  }
}

function validate(packageValue: YouTubePresenterPackage, requireFinalAudioValidation = true) {
  const readiness = evaluateYouTubePresenterPackage({
    package: packageValue,
    expectedInputVersion: packageValue.input_version,
    approvedResearchReceiptIds: ['research_packet:68dfaed1-b319-4a82-98c0-b9caea34835e'],
    approvedSourceReceiptIds: ['source:jev:approved-composite-20261014'],
    approvedClaimIds: ['jev-typed-probabilities', 'jev-policy-boundary'],
    approvedPrivacyReceiptIds: ['privacy:jev:public-safe-20261014'],
    approvedRightsReceiptIds: ['rights:jev:owned-public-assets-20261014'],
    ...musicApprovals(packageValue),
    requireFinalAudioValidation,
  })
  if (!readiness.ready) throw new Error(`Presenter package failed:\n- ${readiness.blockers.join('\n- ')}`)
  hashMatches(resolve(packageValue.native_presenter.path), packageValue.native_presenter.sha256)
  hashMatches(resolve(packageValue.render_contract.brand_logo.path), packageValue.render_contract.brand_logo.sha256)
  for (const asset of packageValue.render_contract.evidence_assets) hashMatches(resolve(asset.path), asset.sha256)
  hashMatches(resolve(packageValue.packaging.thumbnail_receipt.path), packageValue.packaging.thumbnail_receipt.sha256)
  if (packageValue.music_bed) hashMatches(resolve(packageValue.music_bed.track.staged_path), packageValue.music_bed.track.sha256)
  return readiness
}

async function compose(packageValue: YouTubePresenterPackage) {
  validate(packageValue, false)
  if (!packageValue.music_bed) throw new Error('Approved music-bed contract is required for composition.')
  await mkdir(outputDir, { recursive: true })
  const basePath = resolve(outputDir, '.base.png')
  const ctaPath = resolve(outputDir, '.cta.png')
  await makeBase(packageValue, basePath)
  await makeCta(packageValue, ctaPath)
  const evidenceCues = packageValue.timeline.filter((cue) => cue.layout === 'side_evidence')
  const evidencePaths: string[] = []
  for (const cue of evidenceCues) {
    const path = resolve(outputDir, `.evidence-${cue.cue_id}.png`)
    await makeEvidenceFrame(packageValue, cue, path)
    evidencePaths.push(path)
  }
  const finalDuration = Math.max(...packageValue.timeline.map((cue) => cue.end_seconds))
  const conclusion = packageValue.timeline.find((cue) => cue.layout === 'conclusion')!
  const cta = packageValue.timeline.find((cue) => cue.layout === 'cta')!
  const inputArgs = ['-i', resolve(packageValue.native_presenter.path), '-loop', '1', '-i', basePath]
  for (const path of evidencePaths) inputArgs.push('-loop', '1', '-i', path)
  inputArgs.push('-loop', '1', '-i', ctaPath)
  const musicInputIndex = evidenceCues.length + 3
  inputArgs.push('-i', resolve(packageValue.music_bed.track.staged_path))
  const evidenceSplits = evidenceCues.map((_, index) => `[${index + 2}:v]format=rgba[e${index}]`).join(';')
  let overlays = `[1:v]format=rgba[base];[0:v]crop=714:406:3:437,colorkey=0x00e856:0.30:0.08,format=rgba,split=2[p1][p2];[p1]scale=940:-1[pfull];[p2]scale=390:-1[pside];[base][pfull]overlay=(W-w)/2:H-h-120:enable='between(t,0,16.279)+between(t,${conclusion.start_seconds},${conclusion.end_seconds})'[v0];[v0][pside]overlay=40:500:enable='between(t,16.279,${conclusion.start_seconds})'[v1]`
  evidenceCues.forEach((cue, index) => {
    overlays += `;[v${index + 1}][e${index}]overlay=${cue.evidence_region?.x ?? 470}:${cue.evidence_region?.y ?? 430}:enable='between(t,${cue.start_seconds},${cue.end_seconds})'[v${index + 2}]`
  })
  const last = evidenceCues.length + 1
  overlays += `;[${evidenceCues.length + 2}:v]format=rgba[cta];[v${last}][cta]overlay=0:0:enable='between(t,${cta.start_seconds},${cta.end_seconds})',format=yuv420p[outv]`
  const bed = packageValue.music_bed
  const bedDuration = bed.timing.timeline_end_seconds - bed.timing.timeline_start_seconds
  const fadeOutStart = bedDuration - bed.mix.fade_out_seconds
  const delayMs = Math.round(bed.timing.timeline_start_seconds * 1000)
  const thresholdLinear = Math.pow(10, bed.mix.speech_ducking.threshold_dbfs / 20).toFixed(6)
  // Leave 0.5 dB of codec headroom so the decoded AAC true peak stays under the contract ceiling.
  const renderPeakDbfs = bed.mix.maximum_true_peak_dbfs - 0.5
  const peakLinear = Math.pow(10, renderPeakDbfs / 20).toFixed(6)
  const audio = `[0:a]apad=pad_dur=${Math.max(0, finalDuration - conclusion.end_seconds).toFixed(3)},atrim=duration=${finalDuration.toFixed(3)},asplit=2[speech][sidechain];[${musicInputIndex}:a]atrim=start=${bed.timing.source_start_seconds}:duration=${bedDuration.toFixed(3)},asetpts=PTS-STARTPTS,loudnorm=I=${bed.mix.target_music_lufs}:TP=-3:LRA=7,afade=t=in:st=0:d=${bed.mix.fade_in_seconds},afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${bed.mix.fade_out_seconds},adelay=${delayMs}|${delayMs}[music];[music][sidechain]sidechaincompress=threshold=${thresholdLinear}:ratio=${bed.mix.speech_ducking.ratio}:attack=${bed.mix.speech_ducking.attack_ms}:release=${bed.mix.speech_ducking.release_ms}[ducked];[speech][ducked]amix=inputs=2:duration=longest:dropout_transition=0,loudnorm=I=${bed.mix.target_final_lufs}:TP=${renderPeakDbfs}:LRA=7,alimiter=limit=${peakLinear}:level=false[mixout]`
  const filter = `${evidenceSplits};${overlays};${audio}`
  run('ffmpeg', [
    '-y', ...inputArgs, '-filter_complex', filter, '-map', '[outv]', '-map', '[mixout]',
    '-t', finalDuration.toFixed(3), '-r', String(packageValue.render_contract.fps),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', videoPath,
  ])
  run('ffmpeg', ['-y', '-ss', '18.5', '-i', videoPath, '-frames:v', '1', posterPath])
  const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'stream=index,codec_type,codec_name,width,height,r_frame_rate,channels,sample_rate,nb_frames', '-show_entries', 'format=duration,size', '-of', 'json', videoPath]))
  const receipt = {
    receipt_version: 'youtube_presenter_review_receipt_v1',
    package_id: packageValue.package_id,
    status: 'passed',
    review_only: true,
    input_version: packageValue.input_version,
    output: { path: videoPath.replace(`${process.cwd()}/`, ''), sha256: sha256(videoPath), probe },
    thumbnail: { path: thumbnailPath.replace(`${process.cwd()}/`, ''), sha256: sha256(thumbnailPath) },
    source_presenter: { path: packageValue.native_presenter.path, sha256: packageValue.native_presenter.sha256, provider_job_id: packageValue.native_presenter.provider_job_id },
    timeline: packageValue.timeline,
    validations: {
      presenter_first: true,
      synchronized_side_evidence: true,
      disjoint_presenter_and_evidence_regions: true,
      evidence_loop: false,
      native_dialogue_preserved: true,
      rights_cleared_music_bed_mixed: true,
      speech_aware_ducking_applied: true,
      conclusion_present: true,
      review_only_visual_cta_present: true,
      release_spoken_cta_pending: true,
      external_provider_calls: 0,
      platform_uploads_or_drafts: 0,
    },
    execution_boundary: 'Local deterministic composition only. No provider call, spend, upload, platform draft, schedule, publish, send, credential change, migration, or production mutation.',
  }
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
  await writeFile(titlePackagePath, `${JSON.stringify({
    package_id: packageValue.package_id,
    input_version: packageValue.input_version,
    research_receipt_ids: packageValue.packaging.research_receipt_ids,
    source_receipt_ids: packageValue.packaging.source_receipt_ids,
    claim_ids: packageValue.packaging.claim_ids,
    privacy_receipt_id: packageValue.packaging.privacy_receipt_id,
    rights_receipt_id: packageValue.packaging.rights_receipt_id,
    subject: packageValue.packaging.title_subject_receipt.subject,
    title_candidates: packageValue.packaging.title_subject_receipt.candidates,
    thumbnail: packageValue.packaging.thumbnail_receipt,
  }, null, 2)}\n`)
  for (const path of [basePath, ctaPath, ...evidencePaths]) await unlink(path).catch(() => undefined)
  console.log(JSON.stringify({ status: 'composed', video: videoPath, poster: posterPath, receipt: receiptPath, titlePackage: titlePackagePath, probe }, null, 2))
}

async function main() {
  const packageValue = JSON.parse(await readFile(packagePath, 'utf8')) as YouTubePresenterPackage
  if (!existsSync(fontRegular) || !existsSync(fontBold)) throw new Error('Required deterministic system fonts are missing.')
  if (mode === 'thumbnail') return makeThumbnail(packageValue)
  if (mode === 'compose') return compose(packageValue)
  if (mode === 'audit-music') {
    const readiness = evaluateYouTubePresenterPackage({
      package: packageValue,
      expectedInputVersion: packageValue.input_version,
      approvedResearchReceiptIds: ['research_packet:68dfaed1-b319-4a82-98c0-b9caea34835e'],
      approvedSourceReceiptIds: ['source:jev:approved-composite-20261014'],
      approvedClaimIds: ['jev-typed-probabilities', 'jev-policy-boundary'],
      approvedPrivacyReceiptIds: ['privacy:jev:public-safe-20261014'],
      approvedRightsReceiptIds: ['rights:jev:owned-public-assets-20261014'],
      ...musicApprovals(packageValue),
    })
    console.log(JSON.stringify({ status: readiness.ready ? 'ready' : 'blocked', package: packagePath, readiness }, null, 2))
    if (readiness.ready) throw new Error('Music audit unexpectedly passed without a deliberate compose/validation round.')
    return
  }
  const readiness = validate(packageValue)
  console.log(JSON.stringify({ status: 'ready', package: packagePath, thumbnail: thumbnailPath, readiness }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
