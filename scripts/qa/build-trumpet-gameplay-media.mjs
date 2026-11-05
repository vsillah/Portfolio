import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const commit = 'c19989a3b156ce97326e35b335e169014ca076f3'
const short = commit.slice(0, 8)
const source = path.resolve('docs/qa/trumpet-trainer-gameplay/source')
const publicDir = path.resolve(`public/showcases/trumpet-trainer/${short}`)
const slidesDir = path.resolve('docs/qa/trumpet-trainer-gameplay/social')
const logo = path.resolve('public/amadutown-logo-upscaled.png')
await Promise.all([mkdir(publicDir, { recursive: true }), mkdir(slidesDir, { recursive: true })])

const scenes = [
  { file: '01-home', heading: ['A place to', 'begin'], body: ['A beginner sees the next', 'practice step before', 'choosing a song.'], caption: 'The home screen puts the next beginner step in view.' },
  { file: '02-journey-map', heading: ['A path, one', 'step at a time'], body: ['The journey has 28 steps.', 'The next stop is visible', 'without opening every lesson.'], caption: 'A 28-step journey shows what comes next.' },
  { file: '03-first-lesson', heading: ['The first note', 'has a cue'], body: ['Meet G explains the note', 'and the fingering before', 'practice begins.'], caption: 'The first lesson explains the note and fingering.' },
  { file: '04-no-rush-wait', heading: ['No Rush waits', 'for the learner'], body: ['The note stays in place', 'until the learner is ready', 'to play.'], caption: 'No Rush holds the note while the learner gets ready.' },
  { file: '05-gameplay-guidance', heading: ['Guidance while', 'playing'], body: ['Toot, the note highway,', 'and the fingering cue', 'stay on screen together.'], caption: 'Toot and the fingering cue stay visible during play.' },
  { file: '06-results', heading: ['A next step', 'after practice'], body: ['The result shows what', 'happened in this synthetic', 'test run.'], caption: 'The result shows the score and next step for this synthetic run.' },
  { file: '07-song-builder', heading: ['Build a tune', 'note by note'], body: ['An adult can explore the', 'pilot concept and share', 'non-binding interest.'], caption: 'The song builder lets a player add notes; adults can review pilot interest.' },
]

const xml = (text) => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const sha = async file => createHash('sha256').update(await readFile(file)).digest('hex')
const run = (name, args) => {
  const result = spawnSync(name, args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(`${name} failed: ${result.stderr || result.stdout}`)
  return result.stdout.trim()
}

const logoBuffer = await sharp(logo).resize({ height: 96 }).png().toBuffer()
const imageHashes = {}
const pdf = await PDFDocument.create()

for (const [index, scene] of scenes.entries()) {
  const input = path.join(source, `${scene.file}.png`)
  const webp = path.join(publicDir, `${scene.file}.webp`)
  await sharp(input).webp({ quality: 88 }).toFile(webp)
  imageHashes[scene.file] = await sha(input)

  const screenshot = await sharp(input).resize(590, 1232, { fit: 'fill' }).png().toBuffer()
  const title = scene.heading.map((line, i) => `<text x="58" y="${340 + i * 67}" fill="#f7f5ef" font-family="Georgia" font-size="54">${xml(line)}</text>`).join('')
  const body = scene.body.map((line, i) => `<text x="58" y="${600 + i * 39}" fill="#d7dfeb" font-family="Arial" font-size="27">${xml(line)}</text>`).join('')
  const footer = index === scenes.length - 1
    ? `<text x="58" y="1030" fill="#f5d060" font-family="Arial" font-size="27" font-weight="bold">Adult tester interest</text><text x="58" y="1070" fill="#f5d060" font-family="Arial" font-size="23">amadutown.com/work/</text><text x="58" y="1104" fill="#f5d060" font-family="Arial" font-size="23">trumpet-trainer</text>`
    : `<text x="58" y="1030" fill="#f5d060" font-family="Arial" font-size="25">${String(index + 1).padStart(2, '0')} / 07</text>`
  const svg = `<svg width="1080" height="1350" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1350" fill="#121e31"/>
    <rect x="440" y="32" width="630" height="1272" rx="30" fill="#d4af37"/>
    <text x="58" y="207" fill="#d4af37" font-family="Arial" font-size="22" font-weight="bold" letter-spacing="4">TRUMPET TRAINER</text>
    ${title}${body}${footer}
    <text x="58" y="1250" fill="#b9c7d9" font-family="Arial" font-size="18">Captured from product · synthetic test input</text>
  </svg>`
  const slide = await sharp(Buffer.from(svg)).composite([
    { input: screenshot, left: 456, top: 52 },
    { input: logoBuffer, left: 58, top: 49 },
  ]).png().toBuffer()
  const output = path.join(slidesDir, `slide-${String(index + 1).padStart(2, '0')}.png`)
  await writeFile(output, slide)
  const page = pdf.addPage([1080, 1350])
  const embedded = await pdf.embedPng(slide)
  page.drawImage(embedded, { x: 0, y: 0, width: 1080, height: 1350 })
}
await writeFile(path.join(slidesDir, 'trumpet-trainer-carousel.pdf'), await pdf.save())

const nativeWebm = path.join(source, 'native-gameplay.webm')
const nativeMp4 = path.join(source, 'native-gameplay.mp4')
run('ffmpeg', ['-loglevel', 'error', '-y', '-i', nativeWebm, '-r', '25', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', nativeMp4])
const rawMetadata = JSON.parse(run('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_read_frames:format=duration', '-of', 'json', nativeMp4]))
const trimStartFrame = 100
const trimmedMp4 = path.join(source, 'native-gameplay-trimmed.mp4')
run('ffmpeg', ['-loglevel', 'error', '-y', '-i', nativeMp4, '-vf', `trim=start_frame=${trimStartFrame},setpts=PTS-STARTPTS`, '-r', '25', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', trimmedMp4])
const metadata = JSON.parse(run('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_read_frames:format=duration', '-of', 'json', trimmedMp4]))
const duration = Number(metadata.format.duration)
if (duration < 20 || duration > 25) throw new Error(`Trimmed capture duration ${duration}s is outside 20–25s`)
if (metadata.streams[0].r_frame_rate !== '25/1' || Number(metadata.streams[0].nb_read_frames) !== Number(rawMetadata.streams[0].nb_read_frames) - trimStartFrame) throw new Error('Trimmed capture lost source frames or frame rate')

const videoScenes = [
  { start: 0, end: 2.25, lines: ['A clear place to begin'] },
  { start: 2.25, end: 4.55, lines: ['A 28-step journey'] },
  { start: 4.55, end: 8, lines: ['Meet the first note'] },
  { start: 8, end: 9.5, lines: ['No Rush waits', 'for the learner'] },
  { start: 9.5, end: 14.75, lines: ['Toot and fingering', 'stay in view'] },
  { start: 14.75, end: 17.8, lines: ['Results show', 'the next step'] },
  { start: 17.8, end: duration + 0.1, lines: ['Build a tune', 'note by note'] },
]

async function makeVideo(format) {
  const landscape = format === 'landscape'
  const width = landscape ? 1920 : 1080
  const height = landscape ? 1080 : 1920
  const bgSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#121e31"/><rect x="${landscape ? 120 : 147}" y="${landscape ? 24 : 242}" width="${landscape ? 534 : 786}" height="${landscape ? 1032 : 1560}" rx="28" fill="#d4af37"/><text x="${landscape ? 740 : 260}" y="${landscape ? 190 : 104}" fill="#d4af37" font-family="Arial" font-size="${landscape ? 34 : 38}" font-weight="bold" letter-spacing="5">TRUMPET TRAINER</text><text x="${landscape ? 740 : 230}" y="${landscape ? 955 : 1860}" fill="#cdd7e6" font-family="Arial" font-size="${landscape ? 25 : 30}">Synthetic test input · current product capture</text></svg>`
  const bg = path.join(slidesDir, `video-${format}-background.png`)
  await sharp(Buffer.from(bgSvg)).composite([{ input: await sharp(logo).resize({ height: landscape ? 120 : 90 }).png().toBuffer(), left: landscape ? 1710 : 50, top: landscape ? 46 : 30 }]).png().toFile(bg)
  const captionFiles = []
  for (const [index, scene] of videoScenes.entries()) {
    const lines = scene.lines.map((line, i) => `<text x="${landscape ? 740 : 80}" y="${landscape ? 390 + i * 85 : 158 + i * 59}" fill="#f7f5ef" font-family="Georgia" font-size="${landscape ? 68 : 42}">${xml(line)}</text>`).join('')
    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${lines}</svg>`
    const file = path.join(slidesDir, `video-${format}-caption-${index + 1}.png`)
    await sharp(Buffer.from(svg)).png().toFile(file)
    captionFiles.push(file)
  }
  const args = ['-loglevel', 'error', '-y', '-loop', '1', '-i', bg, '-i', trimmedMp4]
  for (const file of captionFiles) args.push('-loop', '1', '-i', file)
  const gameWidth = landscape ? 474 : 738
  const gameHeight = landscape ? 990 : 1540
  const gameX = landscape ? 150 : 171
  const gameY = landscape ? 45 : 255
  let filters = `[1:v]scale=${gameWidth}:${gameHeight}:flags=lanczos[game];[0:v][game]overlay=${gameX}:${gameY}:shortest=1[base]`
  let previous = 'base'
  videoScenes.forEach((scene, index) => {
    const next = index === videoScenes.length - 1 ? 'final' : `captioned${index}`
    filters += `;[${previous}][${index + 2}:v]overlay=0:0:enable='between(t,${scene.start},${scene.end})'[${next}]`
    previous = next
  })
  const result = path.join(publicDir, `gameplay-${format}.mp4`)
  args.push('-filter_complex', filters, '-map', '[final]', '-an', '-r', '25', '-t', duration.toFixed(2), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', result)
  run('ffmpeg', args)
  const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,r_frame_rate,nb_read_frames:format=duration', '-of', 'json', result]))
  if (probe.streams[0].codec_name !== 'h264' || probe.streams[0].width !== width || probe.streams[0].height !== height || Number(probe.streams[0].nb_read_frames) !== Number(metadata.streams[0].nb_read_frames)) throw new Error(`Video verification failed for ${format}`)
  return { path: path.relative(process.cwd(), result), ...probe.streams[0], duration: probe.format.duration, sha256: await sha(result) }
}

const videos = [await makeVideo('landscape'), await makeVideo('portrait')]
const poster = path.join(publicDir, 'gameplay-poster.jpg')
run('ffmpeg', ['-loglevel', 'error', '-y', '-ss', '12', '-i', path.join(publicDir, 'gameplay-landscape.mp4'), '-frames:v', '1', '-q:v', '3', poster])
const sampledFrames = [0, 60, 115, 205, 242, 369, 452, 508]
const frameAudits = []
for (const format of ['landscape', 'portrait']) {
  const output = path.join(source, `frame-audit-${format}.png`)
  const selection = sampledFrames.map(frame => `eq(n,${frame})`).join('+')
  const size = format === 'landscape' ? '480:270' : '270:480'
  run('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(publicDir, `gameplay-${format}.mp4`), '-vf', `select='${selection}',scale=${size},tile=4x2`, '-frames:v', '1', output])
  frameAudits.push({ path: path.relative(process.cwd(), output), sampledFrames, sha256: await sha(output) })
}
await writeFile(path.join(source, 'capture-manifest.json'), JSON.stringify({ sourceCommit: commit, sourceUrl: 'local build from git archive', audioFixture: 'e2e/make-step-wav.ts synthetic fixture', capturedOn: '2026-11-05', sourceVideo: { path: path.relative(process.cwd(), nativeMp4), duration: Number(rawMetadata.format.duration), frameRate: rawMetadata.streams[0].r_frame_rate, frames: rawMetadata.streams[0].nb_read_frames, sha256: await sha(nativeMp4) }, trimmedVideo: { path: path.relative(process.cwd(), trimmedMp4), startFrame: trimStartFrame, duration, frameRate: metadata.streams[0].r_frame_rate, frames: metadata.streams[0].nb_read_frames, sha256: await sha(trimmedMp4) }, screenshots: imageHashes, videos, poster: { path: path.relative(process.cwd(), poster), sha256: await sha(poster) }, frameAudits }, null, 2))
console.log(JSON.stringify({ sourceCommit: commit, sourceDuration: duration, videos: videos.map(({ path, duration, width, height }) => ({ path, duration, width, height })) }))
