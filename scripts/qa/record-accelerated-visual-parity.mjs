/** Record synthetic, local desktop/mobile review of early, middle, and final lessons. */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const route = process.argv[2]
if (!route?.startsWith('http://localhost:')) throw new Error('Pass the exact local review URL')
const out = path.resolve('artifacts/accelerated-visual-parity-2026-11-10/qa')
fs.mkdirSync(out,{recursive:true})
const browser = await chromium.launch({headless:true})

for (const [label,viewport] of [['desktop',{width:1280,height:800}],['mobile',{width:390,height:844}]]) {
  const context = await browser.newContext({viewport,recordVideo:{dir:out,size:viewport}})
  const page = await context.newPage()
  const stableFrames=[]
  await page.goto(route,{waitUntil:'domcontentloaded'})
  await page.locator('video').waitFor()
  for (const [id,seconds] of [['L01',180],['L08',360],['L11',240],['L15',300],['L16',240]]) {
    if (label==='mobile' && await page.getByRole('button',{name:'Expand lesson navigation'}).count()) {
      await page.getByRole('button',{name:'Expand lesson navigation'}).click()
    }
    await page.getByRole('button',{name:new RegExp(`^${id}:`)}).click()
    const video = page.locator('video')
    await video.scrollIntoViewIfNeeded()
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 1)
    await video.evaluate((node,time)=>new Promise((resolve,reject)=>{
      const limit=setTimeout(()=>reject(new Error('seek timed out')),10000)
      node.addEventListener('seeked',()=>{clearTimeout(limit);node.pause();resolve()}, {once:true})
      node.currentTime=time
    }),seconds)
    await page.waitForTimeout(3000)
    const scenePath=path.join(out,`${label}-${id.toLowerCase()}-scene.png`)
    await page.screenshot({path:scenePath,fullPage:false})
    stableFrames.push(scenePath)
    await page.waitForTimeout(1700)
    if (id==='L16') {
      await video.evaluate((node)=>new Promise((resolve,reject)=>{
        const limit=setTimeout(()=>reject(new Error('end timed out')),10000)
        node.addEventListener('ended',()=>{clearTimeout(limit);resolve()},{once:true})
        node.currentTime=node.duration-0.8
        node.muted=true
        node.play().catch(reject)
      }))
      await page.getByRole('status',{name:'L16 video finished'}).waitFor()
      await page.waitForTimeout(1900)
    }
  }
  const endPath=path.join(out,`${label}-l16-end.png`)
  await page.screenshot({path:endPath,fullPage:false})
  stableFrames.push(endPath)
  const videoPath = await page.video().path()
  await context.close()
  // The browser recording includes transient seek spinners. Encode only the
  // decoded browser frames so the review clip shows the actual lesson states.
  const frameList=path.join(out,`${label}-stable-frames.txt`)
  fs.writeFileSync(frameList,stableFrames.map(file=>`file '${file}'\nduration 2.5`).join('\n')+`\nfile '${stableFrames.at(-1)}'\n`)
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',frameList,'-vf','fps=25','-c:v','libx264','-crf','20','-pix_fmt','yuv420p',path.join(out,`${label}-early-middle-final.mp4`)])
  fs.unlinkSync(frameList)
  fs.unlinkSync(videoPath)
  console.log(label,'recorded')
}
await browser.close()
