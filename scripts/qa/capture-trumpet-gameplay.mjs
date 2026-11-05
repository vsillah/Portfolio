import { chromium } from 'playwright-core'
import { mkdir, readFile, rename } from 'node:fs/promises'
import path from 'node:path'

const sourceCommit = 'c19989a3b156ce97326e35b335e169014ca076f3'
const sourceUrl = process.env.TT_URL || 'http://localhost:8123/'
const fixture = process.env.TT_AUDIO_FIXTURE || '/tmp/tt-portfolio-capture-c199/e2e/step.wav'
const output = path.resolve('docs/qa/trumpet-trainer-gameplay/source')
await mkdir(output, { recursive: true })
await readFile(fixture)

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${fixture}%noloop`,
    '--autoplay-policy=no-user-gesture-required',
  ],
})

try {
  const context = await browser.newContext({
    viewport: { width: 412, height: 860 },
    deviceScaleFactor: 2,
    serviceWorkers: 'block',
    recordVideo: { dir: output, size: { width: 412, height: 860 } },
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${sourceUrl}?capture=${sourceCommit.slice(0, 12)}`, { waitUntil: 'domcontentloaded' })
  const html = await page.content()
  if (!html.includes(sourceCommit.slice(0, 12))) throw new Error('Product build is not bound to requested commit')
  await page.getByRole('button', { name: 'Explore the app' }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(output, '01-home.png') })
  await page.waitForTimeout(1800)
  await page.locator('#jMap').click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(output, '02-journey-map.png') })
  await page.waitForTimeout(1800)
  await page.locator('[data-step="0"]').click({ force: true })
  await page.waitForTimeout(350)
  await page.screenshot({ path: path.join(output, '03-first-lesson.png') })
  await page.waitForTimeout(1800)
  await page.locator('#go').click()
  await page.locator('#allowMic').click()
  await page.waitForTimeout(1900)
  await page.screenshot({ path: path.join(output, '04-no-rush-wait.png') })
  await page.waitForTimeout(2100)
  await page.screenshot({ path: path.join(output, '05-gameplay-guidance.png') })
  await page.locator('.results').waitFor({ timeout: 30000 })
  await page.waitForTimeout(700)
  await page.screenshot({ path: path.join(output, '06-results.png') })
  await page.waitForTimeout(1800)
  await page.locator('#home').click()
  await page.waitForTimeout(300)
  await page.locator('#newSong').click()
  await page.waitForTimeout(350)
  await page.locator('#bTitle').fill('Practice tune')
  await page.locator('[data-len="1"]').click()
  await page.locator('[data-note="64"]').click()
  await page.locator('[data-note="62"]').click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(output, '07-song-builder.png') })
  await page.waitForTimeout(1800)
  if (errors.length) throw new Error(errors.join('; '))
  const video = page.video()
  await context.close()
  if (video) await rename(await video.path(), path.join(output, 'native-gameplay.webm'))
  console.log(JSON.stringify({ sourceCommit, sourceUrl, fixture, screenshots: 7, errors }))
} finally {
  await browser.close()
}
