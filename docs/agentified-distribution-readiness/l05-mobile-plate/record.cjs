const { chromium } = require('playwright')
const { execFileSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const revision = process.argv[2]
if (!/^[a-f0-9]{7,40}$/.test(revision || '')) throw new Error('Pass the code commit SHA')
const root = path.resolve(__dirname, '../../..')
const output = path.join(root, 'agentified/workshop/l05-mobile-plate-review')
fs.mkdirSync(output, { recursive: true })
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const source = 'agentified/manuscript/visuals/rendered/publication-plates/figure-8-1-portfolio-first-stack-publication-plate.png'
const staged = 'public/agentified/lessons/l05/figure-8-1-portfolio-first-stack-publication-plate.png'
const video = 'public/agentified/lessons/l05/illustrated-aa9b234a/agentified-l05-illustrated-composite.mp4'
const captions = 'public/agentified/lessons/l05/continuous-1cd79d31/agentified-l05-continuous-narration-captions.vtt'
if (sha(path.join(root, source)) !== sha(path.join(root, staged))) throw new Error('Approved plate copy changed')

async function run() {
  const browser = await chromium.launch({ headless: true })
  const results = []
  try {
    for (const [name, width, height] of [['desktop', 1280, 720], ['mobile', 390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: output, size: { width, height } } })
      await context.route('**/*', (route) => {
        const url = new URL(route.request().url())
        if (['127.0.0.1', 'localhost'].includes(url.hostname)) return route.continue()
        return route.abort()
      })
      const page = await context.newPage()
      const url = `http://127.0.0.1:3111/agentified/learningplan?lesson=L05&rev=${revision}`
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      const player = page.locator('video')
      await player.waitFor()
      await page.waitForFunction(() => document.querySelector('video')?.duration > 230)
      await player.scrollIntoViewIfNeeded()
      const setTime = async (seconds) => {
        for (let attempt = 0; attempt < 2; attempt++) {
          await player.evaluate((element, time) => { element.pause(); element.currentTime = time }, seconds)
          await page.waitForTimeout(750)
          const state = await player.evaluate((element) => ({ time: element.currentTime, ready: element.readyState, seeking: element.seeking }))
          if (Math.abs(state.time - seconds) < 0.2 && state.ready >= 2 && !state.seeking) return
        }
        throw new Error(`${name}: could not decode scene at ${seconds}`)
      }
      await setTime(75)
      if (await page.locator('figure[aria-label="L05 operating stack diagram details"]').count()) throw new Error(`${name}: diagram visible before cue`)
      await page.screenshot({ path: path.join(output, `${name}-before.png`) })
      await setTime(90)
      const diagram = page.locator('figure[aria-label="L05 operating stack diagram details"]')
      await diagram.waitFor({ state: 'attached' })
      if (name === 'mobile') await page.waitForFunction(() => {
        const image = document.querySelector('figure[aria-label="L05 operating stack diagram details"] img')
        return Boolean(image?.complete && image?.naturalWidth)
      })
      const state = await page.evaluate(() => {
        const player = document.querySelector('video')
        const figure = document.querySelector('figure[aria-label="L05 operating stack diagram details"]')
        const image = figure?.querySelector('img')
        const rect = player.getBoundingClientRect()
        return { player: { width: rect.width, height: rect.height }, figureDisplay: figure && getComputedStyle(figure).display, imageLoaded: Boolean(image?.complete && image?.naturalWidth), exactLabels: figure?.textContent?.includes('Open Brainsources, events, proposals, memoriesHarnessCodex, tools, browser, apps, worktrees'), controls: player?.controls, captions: player?.textTracks?.[0]?.mode }
      })
      if (!state.controls || !state.exactLabels || (name === 'mobile' && !state.imageLoaded)) throw new Error(`${name}: player or approved detail failed ${JSON.stringify(state)}`)
      if (state.figureDisplay !== (name === 'mobile' ? 'block' : 'none')) throw new Error(`${name}: responsive visibility failed ${JSON.stringify(state)}`)
      await page.screenshot({ path: path.join(output, `${name}-teaching-captions-on.png`) })
      if (name === 'mobile') {
        await diagram.evaluate((element) => element.scrollIntoView({ block: 'start' }))
        await page.waitForTimeout(150)
        await page.screenshot({ path: path.join(output, 'mobile-teaching-details.png') })
        await player.scrollIntoViewIfNeeded()
      }
      await player.evaluate((element) => { element.textTracks[0].mode = 'disabled' })
      await page.waitForFunction(() => document.body.textContent.includes('Captions are off.'))
      await page.screenshot({ path: path.join(output, `${name}-teaching-captions-off.png`) })
      await player.evaluate((element) => { element.textTracks[0].mode = 'showing' })
      await page.waitForFunction(() => document.body.textContent.includes('Captions are on.'))
      await setTime(108)
      if (await diagram.count()) throw new Error(`${name}: diagram persisted past cue`)
      await page.screenshot({ path: path.join(output, `${name}-after.png`) })
      results.push({ viewport: `${width}x${height}`, url, cue: [78.582, 105.560], state })
      await context.close()
      const webm = await page.video().path()
      const mp4 = path.join(output, `${name}-walkthrough.mp4`)
      execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])
      fs.unlinkSync(webm)
      execFileSync('ffmpeg', ['-v', 'error', '-i', mp4, '-f', 'null', '-'])
    }
  } finally { await browser.close() }
  const files = fs.readdirSync(output).filter((file) => file.endsWith('.png') || file.endsWith('.mp4')).sort()
  const receipt = { schema_version: 1, code_commit: revision, source: { path: source, sha256: sha(path.join(root, source)) }, staged_copy: { path: staged, sha256: sha(path.join(root, staged)) }, unchanged_media: { video: { path: video, sha256: sha(path.join(root, video)) }, captions: { path: captions, sha256: sha(path.join(root, captions)) } }, results, evidence: files.map((file) => ({ path: path.relative(root, path.join(output, file)), sha256: sha(path.join(output, file)) })) }
  fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
  console.log(`PASS: L05 desktop/mobile cue, controls, captions, source copy and ${files.length} evidence files`)
}

run().catch((error) => { console.error(error); process.exitCode = 1 })
