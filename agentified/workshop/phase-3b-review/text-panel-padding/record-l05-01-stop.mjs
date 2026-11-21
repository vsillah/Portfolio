import { chromium } from 'playwright'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const here='agentified/workshop/phase-3b-review/text-panel-padding'
const head='55ebd09cba902ccc681a1289601e8f8c773d38a8'
execFileSync('git',['merge-base','--is-ancestor',head,'HEAD'])
const scene='L05-01',layout='desktop'
const browser=await chromium.launch({headless:true})
const page=await browser.newPage({viewport:{width:1280,height:720}})
const route=`http://127.0.0.1:8768/review.html?scene=${scene}&layout=${layout}&revision=${head}`
await page.goto(route,{waitUntil:'domcontentloaded'})
const video=page.locator('video')
await page.waitForFunction(()=>document.querySelector('video')?.readyState>=3 && document.querySelector('video')?.textTracks[0]?.cues?.length>0)
await video.evaluate(async v=>{v.muted=true;await v.play()})
await page.waitForFunction(()=>document.querySelector('video')?.currentTime>=6.8)
await video.evaluate(v=>v.pause())
const state=await page.evaluate(()=>{const v=document.querySelector('video');return {time:v.currentTime,mode:v.textTracks[0].mode,activeCue:[...v.textTracks[0].activeCues].map(c=>c.text),controls:v.controls}})
const screenshot=`${here}/checks/lesson-order/L05-01-desktop-caption-panel-overlap.png`
await page.screenshot({path:screenshot})
await browser.close()
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex')
const source=JSON.parse(readFileSync('docs/agentified-distribution-readiness/phase-3b/source-map-v1.json'))
const record=source.records.find(r=>r.lessonId==='L05')
const receipt={status:'STOP',scene,layout,baseHead:head,captionCodeHead:'b93450a8d98f1d325dd5914b5a4c2f50df640099',route,sourceVideo:record.currentVideo,sourceCaption:record.currentCaption,candidateFrame:{path:`${here}/frames/illustrated/${scene}.png`,sha256:sha(`${here}/frames/illustrated/${scene}.png`)},reviewClip:{path:`${here}/checks/lesson-order/${scene}-${layout}.mp4`,sha256:sha(`${here}/checks/lesson-order/${scene}-${layout}.mp4`),startSeconds:12.5},screenshot:{path:screenshot,sha256:sha(screenshot)},state,finding:'Native desktop caption crosses the fitted headline panel bottom border. Review-only and unbound.'}
writeFileSync(`${here}/l05-01-stop-receipt.json`,JSON.stringify(receipt,null,2)+'\n')
console.log(JSON.stringify({status:receipt.status,scene,time:state.time,cue:state.activeCue,screenshot:receipt.screenshot}))
