const { chromium } = require('playwright')
const { createHash } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '../../..')
const map = require(path.join(root, 'app/agentified/mobile-teaching-details.json'))
const output = path.join(root, 'agentified/workshop/mobile-teaching-detail-review')
const revision = process.argv[2]
if (!/^[a-f0-9]{7,40}$/.test(revision || '')) throw new Error('Pass the code commit SHA')
fs.mkdirSync(output, { recursive: true })
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const audit = require(path.join(root, 'agentified/workshop/presentation-illustration-audit/audit-boundaries.json'))
for (const scene of map.scenes) {
  const source = audit.rows.find((row) => row.scene_id === scene.sceneId)
  if (!source || source.start_seconds.toFixed(3) !== scene.startSeconds.toFixed(3) || source.end_seconds.toFixed(3) !== scene.endSeconds.toFixed(3)) throw new Error(`Cue drift: ${scene.sceneId}`)
  if (source.approved_visuals.length !== 1 || source.approved_visuals[0].path !== scene.sourcePath || source.approved_visuals[0].sha256 !== scene.sourceSha256) throw new Error(`Source drift: ${scene.sceneId}`)
  for (const file of [scene.sourcePath, `public${scene.image}`]) if (sha(path.join(root, file)) !== scene.sourceSha256) throw new Error(`Raster drift: ${scene.sceneId} ${file}`)
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const observations = []
  try {
    for (const [viewport, width, height] of [['desktop', 1280, 800], ['mobile', 390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: output, size: { width, height } } })
      await context.route('**/*', (route) => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
      const page = await context.newPage()
      for (const lessonId of [...new Set(map.scenes.map((scene) => scene.lessonId))]) {
        const scenes = map.scenes.filter((scene) => scene.lessonId === lessonId)
        const url = `http://127.0.0.1:3121/agentified/learningplan?lesson=${lessonId}&rev=${revision}`
        await page.goto(url, { waitUntil: 'domcontentloaded' })
        const player = page.locator('video')
        await player.waitFor({ timeout: 15000 })
        await page.waitForFunction((id) => document.querySelector('video')?.getAttribute('aria-label')?.startsWith(id + ' '), lessonId, { timeout: 15000 })
        await page.waitForFunction(() => document.querySelector('video')?.readyState >= 1, { timeout: 15000 })
        await player.scrollIntoViewIfNeeded()
        for (const scene of scenes) {
          await player.scrollIntoViewIfNeeded()
          const read = async (time) => {
            await player.evaluate((element, seconds) => { element.pause(); element.currentTime = seconds; element.dispatchEvent(new Event('seeking')) }, time)
            await page.waitForTimeout(200)
            return page.evaluate(() => {
              const video = document.querySelector('video')
              const detail = document.querySelector('aside[aria-label$="source wording"]')
              const rect = video.getBoundingClientRect()
              return { scene: detail?.getAttribute('aria-label') ?? null, display: detail ? getComputedStyle(detail).display : null, embeddedImages: detail?.querySelectorAll('img').length ?? 0, sourceLink: detail?.querySelector('a')?.getAttribute('href') ?? null, player: [Math.round(rect.width), Math.round(rect.height)], playerVisible: getComputedStyle(video).visibility === 'visible' && getComputedStyle(video).opacity === '1', controls: video.controls, controlsClear: document.elementFromPoint(rect.left + rect.width / 2, rect.bottom - 8) === video, captions: video.textTracks[0]?.mode ?? null }
            })
          }
          const before = await read(Math.max(0, scene.startSeconds - 0.15))
          const during = await read((scene.startSeconds + scene.endSeconds) / 2)
          const after = await read(scene.endSeconds + 0.15)
          if (before.scene?.startsWith(scene.sceneId) || after.scene?.startsWith(scene.sceneId) || !during.scene?.startsWith(scene.sceneId) || during.display !== (viewport === 'mobile' ? 'block' : 'none') || !during.controls || !during.controlsClear || !during.playerVisible || during.embeddedImages !== 0 || during.sourceLink !== scene.image) throw new Error(`${viewport} ${scene.sceneId}: ${JSON.stringify({ before, during, after })}`)
          let captionsOff = null
          if (viewport === 'mobile') {
            await read((scene.startSeconds + scene.endSeconds) / 2)
            await player.evaluate((element) => { element.textTracks[0].mode = 'disabled' })
            await page.waitForFunction(() => document.body.textContent.includes('Captions are off.'))
            captionsOff = await page.evaluate(() => {
              const video = document.querySelector('video')
              const detail = document.querySelector('aside[aria-label$="source wording"]')
              return { captions: video.textTracks[0].mode, scene: detail?.getAttribute('aria-label') ?? null, embeddedImages: detail?.querySelectorAll('img').length ?? 0, controls: video.controls }
            })
            if (!captionsOff.scene?.startsWith(scene.sceneId) || captionsOff.embeddedImages !== 0 || !captionsOff.controls || captionsOff.captions !== 'disabled') throw new Error(`${viewport} ${scene.sceneId}: captions-off state failed`)
            if (scene.sceneId === 'L06-03') {
              await page.evaluate(() => window.scrollTo(0, window.scrollY + document.querySelector('video').getBoundingClientRect().top - 160))
              await page.screenshot({ path: path.join(output, 'mobile-L06-03-captions-off.png') })
            }
            await player.evaluate((element) => { element.textTracks[0].mode = 'showing' })
            await page.waitForFunction(() => document.body.textContent.includes('Captions are on.'))
          }
          observations.push({ viewport, sceneId: scene.sceneId, url, before, during, captionsOff, after })
          if (['L06-03', 'L10-03', 'L16-05'].includes(scene.sceneId)) {
            await read((scene.startSeconds + scene.endSeconds) / 2)
            await page.evaluate(() => window.scrollTo(0, window.scrollY + document.querySelector('video').getBoundingClientRect().top - 160))
            await page.screenshot({ path: path.join(output, `${viewport}-${scene.sceneId}.png`) })
          }
          if (viewport === 'mobile' && scene.sceneId === 'L06-03') {
            const [fullPlate] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: 'Open full plate' }).click()])
            await fullPlate.waitForLoadState('load')
            if (!fullPlate.url().endsWith(scene.image)) throw new Error('Full plate link opened the wrong source')
            const dimensions = await fullPlate.locator('img').evaluate((image) => [image.naturalWidth, image.naturalHeight])
            if (dimensions[0] !== scene.width || dimensions[1] !== scene.height) throw new Error('Full plate link did not load approved raster dimensions')
            if (!await player.evaluate((element) => element.paused)) throw new Error('Full plate link did not pause native playback')
            await fullPlate.close()
          }
          await read((scene.startSeconds + scene.endSeconds) / 2)
          if (viewport === 'mobile') {
            const detail = page.locator(`aside[aria-label^="${scene.sceneId} "]`)
            await detail.scrollIntoViewIfNeeded()
            await page.waitForTimeout(450)
            await detail.locator('div').nth(1).scrollIntoViewIfNeeded()
            await page.waitForTimeout(450)
            await read(scene.endSeconds + 0.15)
            await page.waitForTimeout(250)
          } else {
            await player.scrollIntoViewIfNeeded()
            await page.waitForTimeout(350)
          }
        }
      }
      await context.close()
      const webm = await page.video().path()
      const mp4 = path.join(output, `${viewport}-consolidated.mp4`)
      execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])
      fs.unlinkSync(webm)
      execFileSync('ffmpeg', ['-v', 'error', '-i', mp4, '-f', 'null', '-'])
    }
  } finally { await browser.close() }
  const files = fs.readdirSync(output).filter((file) => /\.(png|mp4)$/.test(file)).sort()
  const receipt = { schemaVersion: 1, codeCommit: revision, mapSha256: sha(path.join(root, 'app/agentified/mobile-teaching-details.json')), auditSha256: sha(path.join(root, 'agentified/workshop/presentation-illustration-audit/audit-boundaries.json')), sceneCount: map.scenes.length, observations, evidence: files.map((file) => ({ path: path.relative(root, path.join(output, file)), sha256: sha(path.join(output, file)) })) }
  fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
  console.log(`PASS: ${map.scenes.length} source-bound scenes at desktop and 390x844; ${files.length} evidence files`)
}

run().catch((error) => { console.error(error); process.exitCode = 1 })
