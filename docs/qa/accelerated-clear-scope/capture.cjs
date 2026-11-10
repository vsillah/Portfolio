const { chromium } = require('playwright')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const reviewedCommit = '96d7a5d3d37c15e886d1ed10ea76234c08229999'
const baseUrl = 'http://localhost:3108'
const reviewUrl = `${baseUrl}/accelerated/learningplan?review=${reviewedCommit}`
const storageKey = 'amadutown:accelerated:decision-file:v1'
const expectedConfirmation = 'Clear only L02 · Prioritize before generating from this device? Your other lesson answers and completion progress will stay. This change will be saved on this device. Any copy already sent for review remains with AmaduTown.'

async function capture(browser, name, viewport) {
  const context = await browser.newContext({ viewport, recordVideo: { dir: __dirname, size: viewport } })
  try {
    const page = await context.newPage()
    const video = page.video()
    await page.goto(reviewUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction((key) => localStorage.getItem(key) !== null, storageKey)
    const answer = page.getByRole('textbox', { name: 'Your response to this lesson' })
    await answer.fill('Synthetic L01 decision to keep')
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) || '{}').answers?.L01 === 'Synthetic L01 decision to keep', storageKey)
    await page.getByRole('button', { name: 'Mark lesson complete' }).click()
    if (name === 'mobile') await page.getByRole('button', { name: 'Expand lesson navigation' }).click()
    await page.getByRole('button', { name: /L02: Prioritize before generating/ }).click()
    await answer.fill('Synthetic L02 decision to clear')
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) || '{}').answers?.L02 === 'Synthetic L02 decision to clear', storageKey)
    await answer.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(1800)

    let confirmationObserved = false
    page.once('dialog', async (dialog) => {
      if (dialog.message() !== expectedConfirmation) {
        await dialog.dismiss()
        throw new Error(`Unexpected confirmation: ${dialog.message()}`)
      }
      confirmationObserved = true
      await dialog.accept()
    })
    await page.getByRole('button', { name: 'Clear worksheet' }).click()
    if (!confirmationObserved) throw new Error('Clear confirmation did not appear')
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) || '{}').answers?.L02 === '', storageKey)
    if (await answer.inputValue() !== '') throw new Error('L02 answer remained')
    await page.waitForTimeout(1800)

    await page.getByRole('button', { name: /L01: Build smarter, stay human/ }).click()
    if (await answer.inputValue() !== 'Synthetic L01 decision to keep') throw new Error('L01 answer changed')
    if (await page.getByRole('progressbar', { name: 'Lessons complete' }).getAttribute('value') !== '1') throw new Error('Completion changed')
    await answer.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(1600)
    await page.screenshot({ path: path.join(__dirname, `${name}.png`) })
    await context.close()

    const rawVideo = await video.path()
    const output = path.join(__dirname, `${name}.mp4`)
    const encoded = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', rawVideo, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output], { encoding: 'utf8' })
    fs.rmSync(rawVideo)
    if (encoded.status !== 0) throw new Error(`MP4 encode failed: ${encoded.stderr}`)
    console.log(`${name}: ${reviewUrl}; exact confirmation asserted; L02 cleared; L01 and completion preserved; ${output}`)
  } finally {
    await context.close().catch(() => {})
  }
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    await capture(browser, 'desktop', { width: 1440, height: 900 })
    await capture(browser, 'mobile', { width: 390, height: 844 })
  } finally {
    await browser.close()
  }
})().catch((error) => { console.error(error); process.exitCode = 1 })
