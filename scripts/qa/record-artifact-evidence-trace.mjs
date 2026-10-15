import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const baseUrl = process.env.QA_BASE_URL || 'http://localhost:5227'
const authStatePath = process.env.PLAYWRIGHT_AUTH_STATE || '/Users/vambahsillah/Projects/Portfolio/.auth/portfolio-admin-storage-state.json'
const outputDir = path.resolve(process.env.QA_OUTPUT_DIR || 'artifacts/human-qa/artifact-evidence-traceability-2026-10-15')
const rawVideoDir = await mkdtemp(path.join(tmpdir(), 'portfolio-artifact-trace-'))
const mp4Path = path.join(outputDir, 'artifact-evidence-trace-walkthrough.mp4')
const route = '/admin/social-content/f966123f-05eb-48ec-a7c2-970afce642ef?step=copy&qa_fixture=channel_native_video_v2&video_package_state=ready'

await mkdir(outputDir, { recursive: true })
const rawStorageState = JSON.parse(await readFile(authStatePath, 'utf8'))
const storageState = {
  ...rawStorageState,
  origins: (rawStorageState.origins || []).map((origin) => ({ ...origin, origin: baseUrl })),
}

async function recordScenario(browser, { label, viewport, colorScheme }) {
  const context = await browser.newContext({
    storageState,
    viewport,
    colorScheme,
    recordVideo: { dir: rawVideoDir, size: viewport },
  })
  const page = await context.newPage()
  const externalRequests = []
  await page.route('https://va.vercel-scripts.com/**', (route) => route.abort('blockedbyclient'))
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin === baseUrl || url.hostname === 'va.vercel-scripts.com' || /\.supabase\.co$/.test(url.hostname) && url.pathname.startsWith('/auth/v1/')) return
    externalRequests.push(request.url())
  })

  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' })
  const trace = page.getByTestId('artifact-evidence-trace')
  await trace.waitFor({ state: 'visible', timeout: 15_000 })
  await trace.scrollIntoViewIfNeeded()
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(outputDir, `${label}-clean.png`) })

  const toggle = trace.getByRole('button', { name: /Trace evidence/i })
  if (await toggle.getAttribute('aria-pressed') !== 'false') throw new Error(`${label} did not start with a clean artifact view.`)
  await toggle.click()
  await trace.getByLabel('Artifact trace list').waitFor({ state: 'visible' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(outputDir, `${label}-trace.png`) })

  const firstRegion = trace.getByRole('button', { name: /Trace 1:/ })
  await firstRegion.focus()
  await firstRegion.press('Enter')
  await trace.getByLabel('Trace 1 evidence detail').waitFor({ state: 'visible' })
  const detail = trace.getByLabel('Trace 1 evidence detail')
  await detail.scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)
  await page.screenshot({ path: path.join(outputDir, `${label}-detail.png`) })

  const sourceSupport = detail.getByText('Source support', { exact: true })
  await sourceSupport.click()
  const numericalEvaluation = detail.getByLabel(/numerical evaluation$/)
  await numericalEvaluation.scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)
  await page.screenshot({ path: path.join(outputDir, `${label}-evaluation.png`) })

  const sourceLink = trace.getByRole('link', { name: 'Open authoritative evidence' })
  const href = await sourceLink.getAttribute('href')
  if (!href?.startsWith('/admin/')) throw new Error(`${label} did not expose a safe authoritative Portfolio deep link.`)
  if (externalRequests.length) throw new Error(`${label} made unexpected external requests: ${externalRequests.join(', ')}`)

  const video = page.video()
  await context.close()
  const rawPath = await video?.path()
  if (!rawPath) throw new Error(`${label} did not produce a video.`)
  const stablePath = path.join(rawVideoDir, `${label}.webm`)
  await rename(rawPath, stablePath)
  return stablePath
}

const browser = await chromium.launch({ headless: true })
const desktop = await recordScenario(browser, { label: 'desktop-1440', viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })
const mobile = await recordScenario(browser, { label: 'mobile-390', viewport: { width: 390, height: 844 }, colorScheme: 'dark' })
await browser.close()

await execFileAsync('ffmpeg', [
  '-y',
  '-i', desktop,
  '-i', mobile,
  '-filter_complex',
  '[0:v]scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v0];[1:v]scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v1];[v0][v1]concat=n=2:v=1:a=0[outv]',
  '-map', '[outv]',
  '-c:v', 'libx264',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  '-an',
  mp4Path,
])
await rm(rawVideoDir, { recursive: true, force: true })

console.log(JSON.stringify({
  route,
  viewports: ['1440x900', '390x844'],
  screenshots: [
    'desktop-1440-clean.png', 'desktop-1440-trace.png', 'desktop-1440-detail.png',
    'desktop-1440-evaluation.png', 'mobile-390-clean.png', 'mobile-390-trace.png',
    'mobile-390-detail.png', 'mobile-390-evaluation.png',
  ].map((file) => path.join(outputDir, file)),
  mp4Path,
  externalRequests: [],
}, null, 2))
