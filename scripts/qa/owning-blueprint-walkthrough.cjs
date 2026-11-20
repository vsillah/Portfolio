const assert = require('node:assert/strict')
const { mkdirSync, unlinkSync } = require('node:fs')
const { join } = require('node:path')
const { execFileSync } = require('node:child_process')
const { chromium } = require('playwright')

const revision = process.env.REVIEW_REVISION || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const base = process.env.REVIEW_BASE || 'http://127.0.0.1:4173'
const out = join(process.cwd(), 'docs/qa/owning-blueprint-infrastructure')
mkdirSync(out, { recursive: true })
const pause = page => page.waitForTimeout(1250)

async function showFigure(page, mobile) {
  await page.evaluate(() => {
    const frame = document.querySelector('iframe')
    const figure = frame.contentDocument.querySelector('.fig')
    const y = scrollY + frame.getBoundingClientRect().top + figure.getBoundingClientRect().top
    scrollTo(0, Math.max(0, y - 85))
  })
  if (mobile) await page.frameLocator('iframe').locator('.fig').evaluate(el => { el.scrollLeft = 0 })
  await pause(page)
}

async function setTheme(page, name, expected) {
  await page.getByRole('button', { name: 'Toggle menu' }).click()
  const menu = page.getByRole('dialog', { name: 'Site navigation' })
  await menu.getByRole('button', { name: `${name} theme` }).click()
  await menu.waitFor({ state: 'hidden' })
  await page.waitForFunction(value => document.querySelector('iframe')?.contentDocument?.documentElement.dataset.theme === value, expected)
}

async function capture(browser, viewport) {
  const mobile = viewport.width === 390
  const context = await browser.newContext({ viewport, colorScheme: 'dark', recordVideo: { dir: out, size: viewport } })
  await context.addInitScript(() => localStorage.setItem('theme', 'dark'))
  const page = await context.newPage()
  const frame = page.frameLocator('iframe')
  await page.goto(`${base}/insights/owning-the-block?rev=${revision}`, { waitUntil: 'domcontentloaded' })
  await frame.locator('h1').waitFor()
  await frame.locator('#city .u-casing').waitFor()
  await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.documentElement.dataset.theme === 'dark')
  assert.equal(await frame.locator('#nodes .node').count(), 18)
  await pause(page)
  await showFigure(page, mobile)
  await frame.locator('#nodes .node[data-id="commons"]').press('Enter')
  assert.equal(await frame.locator('#nar h2').innerText(), 'Roxbury Commons')
  await pause(page)
  await frame.locator('#uses button[data-use="join"]').click()
  assert.equal(await frame.locator('#nar h2').innerText(), 'A neighbor joins')
  await pause(page)
  await setTheme(page, 'Light', 'light')
  await showFigure(page, mobile)
  if (mobile) {
    await frame.locator('.fig').evaluate(el => { el.scrollLeft = el.scrollWidth - el.clientWidth })
    await pause(page)
    await frame.locator('.fig').evaluate(el => { el.scrollLeft = 0 })
    await pause(page)
    await page.evaluate(() => { const frame = document.querySelector('iframe'); scrollTo(0, scrollY + frame.contentDocument.querySelector('#nar').getBoundingClientRect().top - 100) })
    await pause(page)
  }
  const source = await page.video().path()
  await context.close()
  const target = join(out, mobile ? 'mobile-390x844.mp4' : 'desktop-1440x900.mp4')
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', source, '-c:v', 'libx264', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', target])
  unlinkSync(source)
  execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1', target])
  console.log(target)
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    await capture(browser, { width: 1440, height: 900 })
    await capture(browser, { width: 390, height: 844 })
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
