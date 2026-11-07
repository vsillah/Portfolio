import { chromium } from 'playwright'
import { mkdir, readdir, rename } from 'node:fs/promises'
import { join } from 'node:path'

const commit = process.argv[2]
const base = process.argv[3] || 'http://localhost:3287'
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Pass the exact review commit.')
const directory = new URL(`./${commit.slice(0, 8)}/`, import.meta.url).pathname
await mkdir(directory, { recursive: true })
const browser = await chromium.launch({ headless: true })

async function record(name, viewport, theme) {
  const videoDir = join(directory, `${name}-source`)
  await mkdir(videoDir, { recursive: true })
  const context = await browser.newContext({ viewport, recordVideo: { dir: videoDir, size: viewport }, colorScheme: theme })
  const page = await context.newPage()
  await page.goto(`${base}/work/trumpet-trainer?revision=${commit}#interest`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('link', { name: 'Review adult interest and consent' }).waitFor()
  await page.getByRole('link', { name: 'Review adult interest and consent' }).click()
  await page.waitForURL('**/activate/trumpet-trainer')
  await page.getByRole('heading', { name: 'Explore the Trumpet Trainer pilot.' }).waitFor()
  await page.waitForTimeout(700)
  await page.getByRole('heading', { name: 'Adult tester interest and contact consent' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(900)
  const adultConfirmation = page.getByRole('checkbox', { name: 'I confirm I am an adult.' })
  await adultConfirmation.scrollIntoViewIfNeeded()
  if (await adultConfirmation.isEnabled()) throw new Error('Adult confirmation unexpectedly enabled.')
  await page.getByRole('heading', { name: 'Express adult interest' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(900)
  if (await page.getByRole('button', { name: 'Send interest for review' }).isEnabled()) throw new Error('Intake unexpectedly enabled.')
  await page.getByRole('heading', { name: 'Have an invitation?' }).scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: 'Continue to app' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(1100)
  if (await page.getByRole('button', { name: 'Accept invitation' }).isEnabled()) throw new Error('Redemption unexpectedly enabled.')
  if (await page.getByRole('button', { name: 'Continue to app' }).isEnabled()) throw new Error('Handoff unexpectedly enabled.')
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error('Horizontal overflow.')
  await page.screenshot({ path: join(directory, `${name}-final.png`) })
  await context.close()
  const files = await readdir(videoDir)
  if (files.length !== 1 || !files[0].endsWith('.webm')) throw new Error(`Unexpected ${name} recording output.`)
  await rename(join(videoDir, files[0]), join(directory, `${name}-source.webm`))
}

try {
  await record('desktop-dark', { width: 1280, height: 900 }, 'dark')
  await record('mobile-light', { width: 360, height: 800 }, 'light')
} finally { await browser.close() }
console.log(directory)
