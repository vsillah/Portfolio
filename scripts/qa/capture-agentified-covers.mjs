import { chromium } from 'playwright'
import { mkdirSync, copyFileSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const out = path.resolve('docs/qa/agentified-lesson-covers')
mkdirSync(out, { recursive: true })
const revision = process.argv[2]
if (!/^[0-9a-f]{40}$/.test(revision || '')) throw new Error('Pass the exact 40-character review commit')
const url = `http://localhost:3117/agentified/learningplan?lesson=L01&revision=${revision}`
const reps = ['L01', 'L06', 'L11', 'L16']
const browser = await chromium.launch({ headless: true })

async function select(page, id, mobile) {
  if (mobile) await page.getByRole('button', { name: 'Expand lesson navigation' }).click()
  await page.getByRole('button', { name: new RegExp(`^${id} `) }).click()
  const cover = page.getByRole('img', { name: new RegExp(`^${id} .+ lesson cover:`) })
  await cover.waitFor({ state: 'visible' })
  await cover.scrollIntoViewIfNeeded()
  await cover.evaluate((img) => img.decode())
  const state = await cover.evaluate((img) => ({ loaded: img.complete && img.naturalWidth > 0 && Math.abs(img.naturalWidth / img.naturalHeight - 16 / 9) < .01, src: img.currentSrc }))
  if (!state.loaded || !state.src.includes(`l${id.slice(1).toLowerCase()}-poster.webp`)) throw new Error(`${id} cover did not load: ${JSON.stringify(state)}`)
  if (await page.locator('video').count()) throw new Error(`${id} exposed a video without approved media`)
  if (!(await page.getByText('Video locked').isVisible())) throw new Error(`${id} lost the media gate`)
  if (!(await page.getByText(`OPERATING FILE · ${id}`).isVisible())) throw new Error(`${id} lost the Operating File`)
  return cover
}

try {
  for (const [label, width, height] of [['desktop',1440,900],['tablet',820,1180],['mobile',390,844]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto(url)
    for (const id of reps) {
      await select(page,id,width<900)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)
      if (overflow) throw new Error(`${label}/${id} horizontal overflow`)
      await page.screenshot({ path:path.join(out,`${label}-${id.toLowerCase()}.png`) })
    }
    await context.close()
  }
  const context = await browser.newContext({ viewport:{width:1440,height:900}, recordVideo:{dir:out,size:{width:1280,height:800}} })
  const page = await context.newPage()
  await page.goto(url)
  for (const id of reps) {
    await select(page,id,false)
    await page.waitForTimeout(950)
  }
  await page.setViewportSize({width:390,height:844})
  for (const id of reps) {
    await select(page,id,true)
    await page.waitForTimeout(1050)
  }
  const video = page.video()
  await context.close()
  const webm = await video.path()
  copyFileSync(webm,path.join(out,'walkthrough-source.webm'))
  const mp4=path.join(out,'agentified-locked-covers-walkthrough.mp4')
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i',webm,'-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart','-y',mp4])
  unlinkSync(webm)
  const mobileContext = await browser.newContext({ viewport:{width:390,height:844}, recordVideo:{dir:out,size:{width:390,height:844}} })
  const mobilePage = await mobileContext.newPage()
  await mobilePage.goto(url)
  for (const id of reps) {
    await select(mobilePage,id,true)
    await mobilePage.waitForTimeout(1150)
  }
  const mobileVideo = mobilePage.video()
  await mobileContext.close()
  const mobileWebm = await mobileVideo.path()
  const mobileMp4=path.join(out,'agentified-locked-covers-mobile.mp4')
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i',mobileWebm,'-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart','-y',mobileMp4])
  unlinkSync(mobileWebm)
  execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height','-of','default=noprint_wrappers=1',mp4],{stdio:'inherit'})
  execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height','-of','default=noprint_wrappers=1',mobileMp4],{stdio:'inherit'})
  console.log(`Captured four lessons at three widths and two MP4s at ${url}`)
} finally { await browser.close() }
