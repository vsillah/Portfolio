import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const expected = {
  composite: 'ded23edb31cd957689617e3d132f1360957ffe3a60bb5274f478f910b09e3af6',
  source: '2beae8254c76a6f8bf168afb8483e83e63c13b621ec3934c81397d3167cd1a3d',
  captions: 'ed1f824f36a64d9b783266c54a9840e2d89a71e1e526bd55efbbea7359d70ca0',
  l01Video: 'ee09bf72887ca7507229b86f89c4b81b21ba4f97f3290b3451ca704506e7991a',
  l01Captions: 'ceb998e79c84eb564548d155602a83b7cc1725d5b764a723ab6cd931b093184f',
}
const compositeDir = path.join(root, 'docs/accelerated-course-modules/l02-native-composite')
const sourceFile = path.join(compositeDir, 'accelerated-l02-heygen-native.mp4')
const compositeFile = path.join(compositeDir, 'accelerated-l02-native-composite.mp4')
const captionsFile = path.join(root, 'docs/accelerated-course-modules/l02-l04-guided-video/l02-storyboard.srt')
const publicDir = path.join(root, 'public/accelerated/lessons/l02/approved-ded23edb')

function hash(file) { return createHash('sha256').update(readFileSync(file)).digest('hex') }
function assertHash(file, value) {
  const actual = hash(file)
  if (actual !== value) throw new Error(`Accelerated media hash mismatch: ${path.relative(root, file)} (${actual})`)
}

export function validateAndStageL02() {
  const manifest = JSON.parse(readFileSync(path.join(compositeDir, 'composite-manifest.json'), 'utf8'))
  const receipt = JSON.parse(readFileSync(path.join(compositeDir, 'composite-receipt.json'), 'utf8'))
  if (manifest.lesson !== 'Accelerated L02' || receipt.lesson !== 'Accelerated L02' ||
      manifest.source_sha256 !== expected.source || receipt.approved_source_sha256 !== expected.source ||
      manifest.output_sha256 !== expected.composite || receipt.composite?.sha256 !== expected.composite ||
      manifest.captions_sha256 !== expected.captions ||
      receipt.composite?.duration_seconds !== 600 || receipt.composite?.video_frames !== 15000) {
    throw new Error('Accelerated L02 identity or source lineage mismatch')
  }
  assertHash(sourceFile, expected.source)
  assertHash(compositeFile, expected.composite)
  assertHash(captionsFile, expected.captions)
  assertHash(path.join(root, 'public/accelerated/lessons/l01/approved-ee09bf72/accelerated-l01-native-composite.mp4'), expected.l01Video)
  assertHash(path.join(root, 'public/accelerated/lessons/l01/approved-ee09bf72/l01-approved-captions.vtt'), expected.l01Captions)

  const srt = readFileSync(captionsFile, 'utf8').trim().replace(/\r\n/g, '\n')
  const cues = srt.split(/\n\n+/).map((block, index) => {
    const lines = block.split('\n')
    const time = lines[1]?.match(/^(\d\d:\d\d:\d\d,\d{3}) --> (\d\d:\d\d:\d\d,\d{3})$/)
    if (Number(lines[0]) !== index + 1 || !time || lines.length < 3) throw new Error(`Invalid L02 caption cue ${index + 1}`)
    return { start: time[1].replace(',', '.'), end: time[2].replace(',', '.'), text: lines.slice(2).join(' ') }
  })
  if (cues.length !== 94 || cues[0].start !== '00:00:00.000' || cues.at(-1).end !== '00:10:00.000') {
    throw new Error('Accelerated L02 captions do not cover the approved lesson')
  }
  const vtt = `WEBVTT\n\n${cues.map((cue) => `${cue.start} --> ${cue.end}\n${cue.text}`).join('\n\n')}\n`
  const transcript = { source_srt_sha256: expected.captions, cues: cues.map((cue) => ({ ...cue, start: cue.start.slice(3), end: cue.end.slice(3) })) }
  mkdirSync(publicDir, { recursive: true })
  copyFileSync(compositeFile, path.join(publicDir, 'accelerated-l02-native-composite.mp4'))
  writeFileSync(path.join(publicDir, 'l02-captions.vtt'), vtt)
  writeFileSync(path.join(compositeDir, 'l02-learner-transcript.json'), `${JSON.stringify(transcript, null, 2)}\n`)
  assertHash(path.join(publicDir, 'accelerated-l02-native-composite.mp4'), expected.composite)
  console.log('Accelerated L02 exact media and captions staged')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) validateAndStageL02()
