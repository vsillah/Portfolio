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
const briefs = JSON.parse(readFileSync(path.join(here,'semantic-briefs.json'),'utf8'))
const cropSafety = JSON.parse(readFileSync(path.join(here,'crop-safety.json'),'utf8'))
const safetyById = new Map(cropSafety.scenes.map(scene=>[scene.scene_id,scene]))
const composites = JSON.parse(readFileSync(path.join(here,'composite-receipts.json'),'utf8'))
const framesOnly = process.argv.includes('--frames-only')
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const probe = file => JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,r_frame_rate:format=duration','-of','json',file],{encoding:'utf8'}))
const streamHash = (file,stream) => execFileSync('ffmpeg',['-v','error','-i',file,'-map',`0:${stream}:0`,'-c','copy','-f','hash','-'],{encoding:'utf8'}).trim()
assert.equal(audit.rows.length,128,'all 128 source scene positions need an audit')
assert.equal(visuals.frames.length,128,'all 128 scene positions need artwork')
assert.equal(briefs.scenes.length,128,'all 128 positions need semantic briefs')
assert.equal(visuals.schema_version,2,'semantic visual receipt schema required')
assert.equal(safetyById.size,cropSafety.scenes.length,'duplicate crop-safety receipt')
assert.equal(safetyById.size,briefs.scenes.filter(scene=>scene.approved_plate).length,'every approved plate needs crop-safety review')
assert.deepEqual(cropSafety.rendered_plate_px,[600,130,1280,850],'plate viewport changed without crop-safety review')
assert(cropSafety.feather_px>=40,'plate edge feather reduced')
if (!framesOnly) assert.equal(composites.composites.length,16,'all 16 bound videos need review composites')
const visualIds = new Set()
const briefIds = new Set()
const wordCount = value => value.trim().split(/\s+/).length
for (const brief of briefs.scenes) {
  assert(!briefIds.has(brief.scene_id),`${brief.scene_id}: duplicate brief`)
  briefIds.add(brief.scene_id)
  assert(brief.one_second_read && brief.visual_artifact && brief.accessibility_description,`${brief.scene_id}: missing scene-specific visual plan`)
  assert(brief.visual_artifact.length >= 24,`${brief.scene_id}: visual artifact is too vague`)
  assert(wordCount(brief.headline) <= brief.text_budget.headline_words,`${brief.scene_id}: headline exceeds budget`)
  assert(brief.visible_labels.length <= brief.text_budget.labels,`${brief.scene_id}: too many labels`)
  assert(brief.visible_labels.every(label => wordCount(label) <= brief.text_budget.label_words),`${brief.scene_id}: label exceeds budget`)
  assert(brief.text_budget.min_font_px >= 42,`${brief.scene_id}: mobile text floor fell below 42px`)
  assert.equal(sha(path.join(root,brief.master_source.path)),brief.master_source.sha256,`${brief.scene_id}: master hash drift`)
}
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
  const brief = briefs.scenes.find(item=>item.scene_id===frame.scene_id)
  assert(brief,`${frame.scene_id}: no semantic brief`)
  assert.equal(frame.brief_sha256,createHash('sha256').update(JSON.stringify(brief)).digest('hex'),`${frame.scene_id}: frame and brief drift`)
  assert.equal(frame.continuity.id,brief.continuity.id,`${frame.scene_id}: continuity receipt drift`)
  assert.equal(frame.accessibility_text,brief.accessibility_description,`${frame.scene_id}: accessibility receipt drift`)
  assert.deepEqual(frame.display_copy,frame.scene_id==='L01-01'?['A suggestion needs a source.','Harbor Learning Circle']:[brief.headline,...brief.visible_labels],`${frame.scene_id}: visible copy drift`)
  assert.equal(Boolean(frame.approved_plate_rendered_px),Boolean(brief.approved_plate),`${frame.scene_id}: approved plate presence drift`)
  if (brief.approved_plate) {
    const plate=frame.approved_plate_rendered_px
    const safety=safetyById.get(frame.scene_id)
    assert(safety?.focus&&safety?.edge_risk,`${frame.scene_id}: incomplete crop-safety receipt`)
    assert(plate.width>=1200 && plate.height>=800,`${frame.scene_id}: approved plate reduced below legible size`)
    assert(plate.source_crop_px[2]>=1500 && plate.source_crop_px[3]>=1000,`${frame.scene_id}: approved plate crop too small`)
    assert.deepEqual(plate.source_crop_px,brief.approved_plate.crop_source_px,`${frame.scene_id}: approved plate crop drift`)
    assert.deepEqual(plate.crop_safety?.insets_px,safety.insets_px,`${frame.scene_id}: edge mask drift`)
    assert.equal(plate.crop_safety?.feather_px,cropSafety.feather_px,`${frame.scene_id}: edge feather drift`)
    assert(plate.crop_safety?.mask_sha256,`${frame.scene_id}: missing edge mask hash`)
    const [left,top,right,bottom]=safety.insets_px
    assert([left,top,right,bottom].every(inset=>Number.isInteger(inset)&&inset>=40),`${frame.scene_id}: unsafe plate inset`)
    const samples=[[600+Math.floor(left/2),500],[1880-Math.ceil(right/2),500],[1282,130+Math.floor(top/2)],[1282,980-Math.ceil(bottom/2)]]
    for(const [x,y] of samples){
      const pixel=await sharp(image).extract({left:x,top:y,width:1,height:1}).removeAlpha().raw().toBuffer()
      assert(pixel[0]<26&&pixel[1]<48&&pixel[2]<63,`${frame.scene_id}: unmasked plate edge at ${x},${y}`)
    }
  }
  assert(frame.display_copy?.length,`${frame.scene_id}: missing visible copy receipt`)
  for (const copy of frame.display_copy) {
    assert(!/→|->|≠|`|\b(?:fixture|synthetic|source handling|operator note|qa)\b/i.test(copy),`${frame.scene_id}: internal or code-like copy: ${copy}`)
    assert(copy.length <= 180,`${frame.scene_id}: overlong copy`)
  }
  if (/-08$/.test(frame.scene_id)) {
    assert(!frame.display_copy.some(copy => /operating file v\d+|\bpending\b|human editorial|source review/i.test(copy)),`${frame.scene_id}: internal closing copy returned`)
  }
  if (frame.source_path) assert.equal(sha(path.join(root,frame.source_path)),frame.source_sha256,`${frame.scene_id}: source hash drift`)
}
for (const row of audit.rows) {
  assert(visualIds.has(row.scene_id),`${row.scene_id}: no illustrated frame`)
  assert(briefIds.has(row.scene_id),`${row.scene_id}: no semantic brief`)
  assert.equal(sha(path.join(root,row.video_path)),row.video_sha256,`${row.scene_id}: bound source changed`)
  if (row.approved_visuals.length) {
    const visual = visuals.frames.find(frame=>frame.scene_id===row.scene_id)
    assert.equal(visual.source_path,row.approved_visuals[0].path,`${row.scene_id}: approved source replaced`)
    assert.equal(visual.source_sha256,row.approved_visuals[0].sha256,`${row.scene_id}: approved source hash mismatch`)
  }
}
let verified = 0
for (let n=1;n<=16 && !framesOnly;n++) {
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
