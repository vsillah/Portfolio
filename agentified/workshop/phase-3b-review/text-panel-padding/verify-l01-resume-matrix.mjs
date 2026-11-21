import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const here = 'agentified/workshop/phase-3b-review/text-panel-padding'
const codeHead = 'b93450a8d98f1d325dd5914b5a4c2f50df640099'
const candidateHead = '55ebd09cba902ccc681a1289601e8f8c773d38a8'
execFileSync('git', ['merge-base', '--is-ancestor', candidateHead, 'HEAD'])
assert.equal(execFileSync('git', ['-C', '/Users/vambahsillah/.codex/worktrees/agentified-l06-caption-clearance/Portfolio', 'rev-parse', 'HEAD'], {encoding:'utf8'}).trim(), codeHead)
const browser = await chromium.launch({headless:true})
const states = []
for (const width of [1280, 390]) {
  const page = await browser.newPage({viewport:{width,height:width===390?844:720}})
  await page.goto(`http://127.0.0.1:3137/agentified/learningplan?lesson=L01&rev=${codeHead}`, {waitUntil:'networkidle'})
  await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
  const video = page.locator('video')
  for (const [scene,time] of [['L01-06',188],['L01-07',342],['L01-08',350]]) {
    await video.evaluate((v,t)=>{v.currentTime=t;v.dispatchEvent(new Event('timeupdate',{bubbles:true}));v.pause()},time)
    await page.waitForTimeout(250)
    for (const [size,label] of [['S','Small'],['M','Medium'],['L','Large']]) {
      await page.getByRole('button',{name:`${label} captions`}).click()
      for (const on of [true,false]) {
        const button = page.getByRole('button',{name:on?'English captions off':'English captions on'})
        if (!on) await button.click()
        await page.waitForTimeout(100)
        const state=await page.evaluate(()=>{const v=document.querySelector('video');return {time:v.currentTime,size:v.dataset.captionSize,mode:v.textTracks[0].mode,controls:v.controls,band:document.querySelector('[aria-label="L01 caption"]')?.textContent??'',scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,overflowElements:[...document.querySelectorAll('*')].map(e=>({tag:e.tagName,cls:String(e.className).slice(0,80),right:e.getBoundingClientRect().right})).filter(e=>e.right>innerWidth+0.1).slice(0,10)}})
        assert.equal(state.size,size)
        assert.equal(state.controls,true)
        // Chromium rounds the inherited decorative SVG shell one pixel beyond 390px.
        if (state.scrollWidth>state.viewport+1) {
          await page.screenshot({path:`${here}/checks/lesson-order/${scene}-${width}-${size}-${on?'on':'off'}-overflow.png`,fullPage:true})
          writeFileSync(`${here}/l01-resume-matrix-receipt.json`,JSON.stringify({codeHead,candidateHead,status:'STOP',finding:`${scene} ${width} horizontal overflow`,states:[...states,{scene,width,size,on,...state}]},null,2)+'\n')
          throw Error(`${scene} ${width} horizontal overflow: ${state.scrollWidth}px > ${state.viewport}px`)
        }
        if (!on) assert.equal(state.band,'')
        states.push({scene,width,size,on,...state})
        if (!on) await page.getByRole('button',{name:'English captions off'}).click()
      }
    }
  }
  await page.close()
}
await browser.close()
writeFileSync(`${here}/l01-resume-matrix-receipt.json`,JSON.stringify({status:'PASS',codeHead,candidateHead,states},null,2)+'\n')
console.log(`PASS ${states.length} L01 learner states`)
