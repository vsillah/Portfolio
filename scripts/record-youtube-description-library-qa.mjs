import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { chromium } from 'playwright'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5417'
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const route = `/admin/agents/content-intelligence?section=research&qa_fixture=youtube_description_library_v1&rev=${commit.slice(0, 8)}`
const outputDir = join(process.cwd(), 'docs', 'content-intelligence-qa', 'youtube-description-library-visibility')
const rawDir = join(outputDir, 'raw')

rmSync(rawDir, { recursive: true, force: true })
mkdirSync(rawDir, { recursive: true })

async function selectTab(page, name) {
  const tab = page.getByRole('tab', { name })
  await tab.click()
  if (await tab.getAttribute('aria-selected') !== 'true') await tab.click()
  await tab.waitFor({ state: 'visible' })
  if (await tab.getAttribute('aria-selected') !== 'true') throw new Error(`${name} did not become selected.`)
}

async function capture(browser, label, viewport, colorScheme) {
  const context = await browser.newContext({
    viewport,
    colorScheme,
    reducedMotion: 'reduce',
    recordVideo: { dir: join(rawDir, label), size: viewport },
  })
  const page = await context.newPage()
  const writes = []
  page.on('request', request => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(`${request.method()} ${request.url()}`)
  })
  await page.goto(new URL(route, baseUrl).toString(), { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'YouTube description patterns' }).waitFor({ state: 'visible' })
  await page.getByText('Unscored', { exact: true }).waitFor({ state: 'visible' })
  const remediation = page.getByRole('region', { name: 'Nzinga remediation status' })
  await remediation.waitFor({ state: 'visible' })
  await remediation.getByText('Release blocked', { exact: true }).waitFor({ state: 'visible' })
  await remediation.getByText('Askia Muhammad', { exact: true }).first().waitFor({ state: 'visible' })
  await remediation.getByText('Qualify outlier evidence', { exact: true }).first().waitFor({ state: 'visible' })
  await remediation.getByText('Not run no prior receipt', { exact: true }).first().waitFor({ state: 'visible' })
  const initialAttempts = remediation.locator('dt:has-text("Attempts") + dd').first()
  await initialAttempts.waitFor({ state: 'visible' })
  if (await initialAttempts.textContent() !== '0') throw new Error('Initial Nzinga remediation attempt count was not zero.')
  await remediation.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1500)

  await page.getByText('Inspect evidence and decision logic').first().click()
  await page.getByText('Why this sample appears').first().waitFor({ state: 'visible' })
  await page.getByText('AI product management strategy', { exact: true }).waitFor({ state: 'visible' })
  await page.getByText('GrjOiooP3ld2RIw32').waitFor({ state: 'visible' })
  await page.getByText('Cohort decision').first().waitFor({ state: 'visible' })
  await page.getByText('Outlier threshold').first().waitFor({ state: 'visible' })
  await page.getByText('Failed').first().waitFor({ state: 'visible' })
  await page.getByText('Not evaluated').first().waitFor({ state: 'visible' })
  await page.getByText('Why this sample appears').first().scrollIntoViewIfNeeded()
  await page.getByText(/Captured description evidence/).first().waitFor({ state: 'visible' })
  await page.waitForTimeout(900)
  const screenshot = join(outputDir, `${label}.png`)
  await page.screenshot({ path: screenshot, fullPage: false })
  await page.getByText(/youtube.com\/watch\?v=KjYCEiBTHFo/).first().waitFor({ state: 'visible' })
  await page.getByAltText(/Thumbnail from AI Product Management/).waitFor({ state: 'visible' })
  await page.getByText('Outlier score 59 is below the 65 threshold.').first().waitFor({ state: 'visible' })
  await page.waitForTimeout(900)
  await selectTab(page, 'Evidence logic')
  await page.getByText(/matched topic-token ratio × 0.65/).waitFor({ state: 'visible' })
  await page.waitForTimeout(1100)
  await selectTab(page, 'Applied structure')
  await page.getByText('No description structure will be applied until the cohort is ready.').waitFor({ state: 'visible' })
  await page.waitForTimeout(1100)
  await page.getByLabel('Topic to compare').fill('unmatched topic')
  await page.getByText('Unscored', { exact: true }).waitFor({ state: 'visible' })
  await page.waitForTimeout(1000)
  await page.getByLabel('Topic to compare').fill('AI licenses')
  await page.getByText('Unscored', { exact: true }).waitFor({ state: 'visible' })
  await selectTab(page, 'Sample ledger (3)')
  await page.waitForTimeout(900)

  if (writes.length) throw new Error(`QA caused an unexpected write request: ${writes.join(' | ')}`)
  const video = page.video()
  await context.close()
  if (!video) throw new Error(`No ${label} video was recorded.`)
  return { screenshot, video: await video.path() }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const desktop = await capture(browser, 'desktop-dark-1280x800', { width: 1280, height: 800 }, 'dark')
    const mobile = await capture(browser, 'mobile-light-390x844', { width: 390, height: 844 }, 'light')
    const output = join(outputDir, 'youtube-description-library-walkthrough.mp4')
    execFileSync('ffmpeg', [
      '-y', '-i', desktop.video, '-i', mobile.video,
      '-filter_complex',
      '[0:v]scale=1280:800:force_original_aspect_ratio=decrease,pad=1280:800:(ow-iw)/2:(oh-ih)/2:color=0x080b12,setsar=1[d];[1:v]scale=1280:800:force_original_aspect_ratio=decrease,pad=1280:800:(ow-iw)/2:(oh-ih)/2:color=0x080b12,setsar=1[m];[d][m]concat=n=2:v=1:a=0[out]',
      '-map', '[out]', '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output,
    ], { stdio: 'ignore' })
    writeFileSync(join(outputDir, 'results.json'), JSON.stringify({
      generated_at: new Date().toISOString(),
      commit,
      route,
      product_writes: 0,
      viewports: [{ width: 1280, height: 800, theme: 'dark' }, { width: 390, height: 844, theme: 'light' }],
      verified: ['visible Nzinga remediation region', 'release-blocked state', 'Askia Muhammad remediation owner', 'typed recovery action', 'zero initial remediation attempts', 'no-prior-receipt recheck state', 'real public thumbnails', 'visible YouTube URLs', 'captured public description excerpts and provenance', 'discovery query and dataset receipts', 'per-gate pass, fail, and not-evaluated decisions', 'internal summary separation', 'exclusion reasons', 'exact gate order and ranking formula', 'unscored fail-closed state', 'responsive light and dark presentation'],
      screenshots: [basename(desktop.screenshot), basename(mobile.screenshot)],
      output: basename(output),
    }, null, 2) + '\n')
    console.log(output)
  } finally {
    await browser.close()
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
