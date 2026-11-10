#!/usr/bin/env node
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..')
const audit=JSON.parse(readFileSync(path.join(here,'audit-boundaries.json'),'utf8'))
let total=0,minimum=Infinity
for(let n=1;n<=16;n++){
  const id=`L${String(n).padStart(2,'0')}`
  const group=n===1?'l01-native-composite':n<=4?'l02-l04-native-composite':n<=8?'l05-l08-native-composite':n<=12?'l09-l12-native-composite':'l13-l16-native-composite'
  let windows=[]
  if(n===1){
    const sourceDuration=Number(audit.rows.find(row=>row.scene_id===`${id}-08`).end_seconds)
    const narrationReceipt=JSON.parse(readFileSync(path.join(root,'agentified/workshop/l01-continuous-narration/validation-receipt.json'),'utf8'))
    windows=narrationReceipt.presenter_source.placements.filter(p=>p.sequence_end<=sourceDuration).map(p=>[p.sequence_start,p.sequence_end,'presenter'])
    const continuityReceipt=JSON.parse(readFileSync(path.join(root,'agentified/workshop/l01-narration-continuity/validation-receipt.json'),'utf8'))
    const endScreen=continuityReceipt.continuity.end_screen
    windows.push([endScreen.start,endScreen.end,'approved branded end screen'])
  }else if(n>=5&&n<=8){
    const receipt=JSON.parse(readFileSync(path.join(root,`agentified/workshop/l05-l08-continuous-narration/${id.toLowerCase()}-validation-receipt.json`),'utf8'))
    windows=receipt.presenter_source.placements.map(p=>[p.sequence_start,p.sequence_end,'presenter'])
    windows.push([receipt.guided_work_window.start,receipt.guided_work_window.end,'countdown'])
  }else{
    const timeline=JSON.parse(readFileSync(path.join(root,'agentified/workshop',group,n===1?'composite-timeline.json':`${id.toLowerCase()}-composite-timeline.json`),'utf8'))
    windows=[...(timeline.presenter_windows||timeline.placements||[]).map(p=>[p.sequence_start,p.sequence_end,'presenter'])]
    if(timeline.guided_work_countdown)windows.push([timeline.guided_work_countdown.sequence_start,timeline.guided_work_countdown.sequence_end,'countdown'])
  }
  const source=path.join(root,audit.rows.find(row=>row.scene_id===`${id}-01`).video_path)
  const output=path.join(here,'composites',`${id}-illustrated-review.mp4`)
  for(const [start,end,kind] of windows){
    const t=((start+end)/2).toFixed(3)
    const result=spawnSync('ffmpeg',['-hide_banner','-ss',t,'-i',source,'-ss',t,'-i',output,'-filter_complex','[0:v][1:v]psnr','-frames:v','1','-f','null','-'],{encoding:'utf8'})
    assert.equal(result.status,0,`${id} ${kind}: ffmpeg failed`)
    const rawScore=/average:([\d.]+|inf)/.exec(result.stderr)?.[1]
    const score=rawScore==='inf'?Number.POSITIVE_INFINITY:Number(rawScore)
    assert((Number.isFinite(score)&&score>=40)||score===Number.POSITIVE_INFINITY,`${id} ${kind}: protected frame PSNR ${score}`)
    minimum=Math.min(minimum,score);total++
  }
}
console.log(`Protected windows checked: ${total}, minimum PSNR ${minimum.toFixed(2)} dB`)
