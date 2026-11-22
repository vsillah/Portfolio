import { chromium } from 'playwright'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const out = 'agentified/workshop/l07-07-detail-stop'
const binding = JSON.parse(await readFile('lib/agentified-illustrated-bindings.json', 'utf8')).bindings.L07
const digest = async (path) => createHash('sha256').update(await readFile(path)).digest('hex')
if (await digest(`public${binding.video}`) !== binding.compositeSha256 || await digest(`public${binding.captions}`) !== binding.captionsSha256) throw Error('L07 QA source drifted')
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const states = []
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } })
    const route = `http://127.0.0.1:3137/agentified/learningplan?lesson=L07&stop=detail-window-b11360d1`
    await page.goto(route, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
    for (const [label, time] of [['before', 188.514], ['inside', 188.515], ['end', 233.515]]) {
      await page.locator('video').evaluate((v, t) => { v.currentTime = t; v.dispatchEvent(new Event('timeupdate', { bubbles: true })) }, time)
      await page.waitForFunction((t) => Math.abs(document.querySelector('video').currentTime - t) < .01, time)
      await page.waitForTimeout(200)
      const state = await page.evaluate(() => ({ time: document.querySelector('video').currentTime, detailCount: document.querySelectorAll('[aria-label="L07-07 Human review remains the gate. source wording"]').length, detailText: document.querySelector('[aria-label="L07-07 Human review remains the gate. source wording"]')?.textContent ?? null }))
      await page.screenshot({ path: `${out}/L07-07-${width}-${label}.png`, fullPage: false })
      states.push({ width, label, expectedTime: time, route, ...state })
    }
    await page.close()
  }
} finally { await browser.close() }
await writeFile(`${out}/observed.json`, JSON.stringify({ binding, states }, null, 2) + '\n')
console.log(states)
