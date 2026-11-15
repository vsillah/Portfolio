import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const {chromium}=require('@playwright/test')
const out=path.resolve('artifacts/accelerated-sam-contextual-review-2026-11-14')
const base='http://127.0.0.1:3109'
const browser=await chromium.launch({headless:true})
const results=[]
try{
 for(const [aspect,width,height] of [['desktop',1280,720],['mobile',390,844]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1})
  await page.goto(base)
  await page.evaluate(({aspect,width,height})=>{
   document.body.style.margin='0'
   const v=document.createElement('video')
   v.src=`/artifacts/accelerated-sam-contextual-review-2026-11-14/accelerated-sam-signals-${aspect}-human-qa-walkthrough-v9-conditional.mp4`
   v.controls=true;v.muted=true;v.preload='auto';v.style.width=`${width}px`;v.style.height=`${height}px`
   document.body.replaceChildren(v);window.__v=v
  },{aspect,width,height})
  await page.waitForFunction(()=>window.__v.readyState>=2,null,{timeout:20000})
  const state=async(label)=>{
   const data=await page.evaluate(()=>{
    const v=window.__v,c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight
    const x=c.getContext('2d');x.drawImage(v,0,0)
    const area=c.width>500?{x:80,y:80,w:650,h:550}:{x:20,y:70,w:350,h:560}
    const p=x.getImageData(area.x,area.y,area.w,area.h).data;let sum=0,bright=0
    for(let i=0;i<p.length;i+=4){const z=(p[i]+p[i+1]+p[i+2])/3;sum+=z;if(z>25)bright++}
    return {time:v.currentTime,duration:v.duration,ready:v.readyState,ended:v.ended,videoWidth:v.videoWidth,videoHeight:v.videoHeight,mean:sum/(p.length/4),brightFraction:bright/(p.length/4),png:c.toDataURL('image/png').split(',')[1]}
   })
   assert(data.ready>=2,`${aspect} ${label}: not decoded`)
   assert(data.mean>10&&data.brightFraction>.05,`${aspect} ${label}: black frame`)
   assert.deepEqual([data.videoWidth,data.videoHeight],[width,height])
   const canvas=path.join(out,`v9-conditional-${aspect}-${label}-canvas.png`)
   await fs.writeFile(canvas,Buffer.from(data.png,'base64'))
   delete data.png
   await page.screenshot({path:path.join(out,`v9-conditional-${aspect}-${label}-chromium.png`)})
   results.push({aspect,label,...data,canvas:path.relative(process.cwd(),canvas)})
  }
  await page.evaluate(()=>window.__v.play())
  await page.waitForFunction(()=>window.__v.currentTime>.5,null,{timeout:10000})
  await state('initial-play')
  for(const second of [1,8,16,24]){
   await page.evaluate(async(second)=>{const v=window.__v;v.pause();await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('seek timeout')),10000);v.addEventListener('seeked',()=>{clearTimeout(timer);resolve()},{once:true});v.currentTime=second})},second)
   await page.waitForTimeout(200)
   assert(Math.abs((await page.evaluate(()=>window.__v.currentTime))-second)<.05)
   await state(`seek-${second}`)
  }
  await page.evaluate(async()=>{const v=window.__v;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('end timeout')),8000);v.addEventListener('ended',()=>{clearTimeout(timer);resolve()},{once:true});v.currentTime=31.6;v.play()})})
  assert.equal(await page.evaluate(()=>window.__v.ended),true)
  await page.evaluate(()=>window.__v.play())
  await page.waitForFunction(()=>window.__v.currentTime>.5&&window.__v.currentTime<2,null,{timeout:10000})
  await state('replay-after-ended')
  await page.close()
 }
 await fs.writeFile(path.join(out,'v9-conditional-browser-review.json'),JSON.stringify({schema:'accelerated_sam_v9_conditional_walkthrough_browser_review',range_base:base,results},null,2)+'\n')
 console.log('PASS: initial playback, four seeks, replay after ended; no black frames')
}catch(e){console.error(e);process.exitCode=1}finally{await browser.close()}
