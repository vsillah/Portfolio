import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const here = path.dirname(fileURLToPath(import.meta.url))
const url = process.argv[2] || 'http://127.0.0.1:4173/agentified/workshop/scene-production/review.html'
const revision = process.argv[3] || 'local'
const output = path.join(here, 'qa')
mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const errors = []
const viewports = [['desktop', 1440, 900], ['tablet', 820, 1000], ['mobile', 390, 844]]

for (const [name, width, height] of viewports) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  const page = await context.newPage()
  for (let number = 1; number <= 16; number++) {
    const lesson = `L${String(number).padStart(2, '0')}`
    await page.goto(`${url}?lesson=${lesson}&rev=${revision}`)
    await page.waitForFunction((id) => document.querySelector('#scene-label')?.textContent?.startsWith(id), lesson)
    await page.locator('#cover').evaluate((img) => img.decode())
    const packet = await page.evaluate(async (id) => (await (await fetch(`packets/${id}.json`)).json()), lesson)
    for (const beat of [0, 1, 2, 3, 4, 6, 7]) {
      await page.locator('#seek').fill(String(packet.scenes[beat].start_seconds))
      if (await page.locator('#visual img').count()) await page.locator('#visual img').evaluate((img) => img.decode())
      const state = await page.evaluate(() => {
        const stage = document.querySelector('#stage'), visual = document.querySelector('#visual'), teaching = document.querySelector('.teaching'), img = visual.querySelector('img'), cover = document.querySelector('#cover')
        const rect = (element) => element.getBoundingClientRect()
        const imgBox = img && rect(img), visualBox = rect(visual)
        const stageBox = rect(stage), teachingBox = rect(teaching)
        return {
          documentOverflow: document.documentElement.scrollWidth > innerWidth + 2,
          stageOverflow: stage.scrollHeight > stage.clientHeight + 2 || stage.scrollWidth > stage.clientWidth + 2,
          teachingOverflow: teaching.scrollHeight > teaching.clientHeight + 2,
          visualOverflow: visual.scrollHeight > visual.clientHeight + 2,
          coverInvalid: !cover.complete || !cover.naturalWidth || !cover.naturalHeight || cover.naturalWidth / cover.naturalHeight >= 1 || getComputedStyle(cover).objectFit !== 'contain',
          stageAspectRatio: innerWidth > 600 && Math.abs(stageBox.width / stageBox.height - 16 / 9) > .02,
          contentOverlap: teachingBox.right > visualBox.left + 2 && teachingBox.left < visualBox.right - 2 && teachingBox.bottom > visualBox.top + 2 && teachingBox.top < visualBox.bottom - 2,
          imageInvalid: img && (!img.complete || !img.naturalWidth || getComputedStyle(img).objectFit !== 'contain' || imgBox.right > visualBox.right + 2 || imgBox.bottom > visualBox.bottom + 2),
        }
      })
      if (Object.values(state).some(Boolean)) errors.push(`${name} ${lesson} beat ${beat + 1}: ${JSON.stringify(state)}`)
      if ((name === 'desktop' && lesson === 'L04' && beat === 3) || (name === 'tablet' && lesson === 'L09' && beat === 3) || (name === 'mobile' && lesson === 'L16' && beat === 3)) await page.screenshot({ path: path.join(output, `${name}-${lesson}-beat${beat + 1}.png`), fullPage: true })
    }
  }
  await context.close()
}
await browser.close()
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
else console.log('16 lessons × 3 viewports × 7 beats: no overflow; approved plates loaded, contained, and unobscured.')
