#!/usr/bin/env node
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const audit = JSON.parse(readFileSync(path.join(here,'audit-boundaries.json'),'utf8'))
const visuals = JSON.parse(readFileSync(path.join(here,'visual-receipts.json'),'utf8'))
const composites = JSON.parse(readFileSync(path.join(here,'composite-receipts.json'),'utf8'))
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const probe = file => JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,r_frame_rate:format=duration','-of','json',file],{encoding:'utf8'}))
const streamHash = (file,stream) => execFileSync('ffmpeg',['-v','error','-i',file,'-map',`0:${stream}:0`,'-c','copy','-f','hash','-'],{encoding:'utf8'}).trim()
assert.equal(audit.rows.length,128,'all 128 source scene positions need an audit')
assert.equal(visuals.frames.length,128,'all 128 scene positions need artwork')
assert.equal(composites.composites.length,16,'all 16 bound videos need review composites')
const visualIds = new Set()
for (const frame of visuals.frames) {
  assert(!visualIds.has(frame.scene_id),`${frame.scene_id}: duplicate receipt`)
  visualIds.add(frame.scene_id)
  const image = path.join(root,frame.frame_path)
  assert(existsSync(image),`${frame.scene_id}: missing frame`)
  assert.equal(sha(image),frame.frame_sha256,`${frame.scene_id}: frame hash drift`)
  const dimensions = await sharp(image).metadata()
  assert.equal(dimensions.width,1920,`${frame.scene_id}: frame width`)
  assert.equal(dimensions.height,1080,`${frame.scene_id}: frame height`)
  assert(frame.visual_family && frame.accessibility_text && frame.source_rights,`${frame.scene_id}: missing visual provenance`)
  assert(frame.display_copy?.length,`${frame.scene_id}: missing visible copy receipt`)
  for (const copy of frame.display_copy) {
    assert(!/→|->|≠|`|\b(?:fixture|synthetic|source handling|operator note|qa)\b/i.test(copy),`${frame.scene_id}: internal or code-like copy: ${copy}`)
    assert(copy.length <= 180,`${frame.scene_id}: overlong copy`)
  }
  if (frame.source_path) assert.equal(sha(path.join(root,frame.source_path)),frame.source_sha256,`${frame.scene_id}: source hash drift`)
}
for (const row of audit.rows) {
  assert(visualIds.has(row.scene_id),`${row.scene_id}: no illustrated frame`)
  assert.equal(sha(path.join(root,row.video_path)),row.video_sha256,`${row.scene_id}: bound source changed`)
  if (row.approved_visuals.length) {
    const visual = visuals.frames.find(frame=>frame.scene_id===row.scene_id)
    assert.equal(visual.source_path,row.approved_visuals[0].path,`${row.scene_id}: approved source replaced`)
    assert.equal(visual.source_sha256,row.approved_visuals[0].sha256,`${row.scene_id}: approved source hash mismatch`)
  }
}
let verified = 0
for (let n=1;n<=16 && !process.argv.includes('--frames-only');n++) {
  const id=`L${String(n).padStart(2,'0')}`
  const source=path.join(root,audit.rows.find(row=>row.scene_id===`${id}-01`).video_path)
  const output=path.join(here,'composites',`${id}-illustrated-review.mp4`)
  const receipt=composites.composites.find(item=>item.lesson_id===id)
  assert(receipt,`${id}: missing composite receipt`)
  assert.equal(sha(output),receipt.output_sha256,`${id}: output hash drift`)
  if (!existsSync(output)) continue
  const a=probe(source), b=probe(output)
  assert(Math.abs(Number(a.format.duration)-Number(b.format.duration))<0.04,`${id}: duration changed`)
  assert.equal(a.streams.find(stream=>stream.codec_type==='video').r_frame_rate,b.streams.find(stream=>stream.codec_type==='video').r_frame_rate,`${id}: frame rate changed`)
  for (const kind of ['a','s']) {
    const has=a.streams.some(stream=>stream.codec_type===(kind==='a'?'audio':'subtitle'))
    if (has) assert.equal(streamHash(source,kind),streamHash(output,kind),`${id}: ${kind} stream changed`)
  }
  verified++
}
console.log(`PASS: 128 audited scenes, 128 hashed illustrated frames, ${verified} exact-duration composites with identical audio/caption streams`)
