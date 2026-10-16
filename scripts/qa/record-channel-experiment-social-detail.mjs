import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const root = process.cwd()
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:3107'
const revision = process.env.QA_REVISION || 'working-tree'
const authStatePath = process.env.PLAYWRIGHT_AUTH_STATE || '/Users/vambahsillah/Projects/Portfolio/.auth/portfolio-admin-storage-state.json'
const outputDir = path.resolve(process.env.QA_OUTPUT_DIR || 'artifacts/human-qa/channel-experiment-social-detail-2026-10-16')
const rawDir = path.join(root, 'test-results', 'channel-experiment-social-detail-video')
const finalMp4 = path.join(outputDir, 'channel-experiment-social-detail-walkthrough.mp4')
const records = [
  { id: '26a4a7c9-2325-4ef7-a2ee-a83a366d4146', variant: 'licenses-li-b', channel: 'linkedin', expectedText: 'Monday morning. The AI pilot is live. Nobody can explain what happens when the agent is wrong.' },
  { id: '1f3cec8c-afcb-4551-90fa-b8d4f9dabe2f', variant: 'licenses-yt-a', channel: 'youtube', expectedText: 'Stop Counting AI Licenses: Build a Readiness Scorecard That Shows the Work' },
  { id: '6b499ed2-edcb-4782-98c8-d59be644df50', variant: 'pm-os-li-b', channel: 'linkedin', expectedText: 'I can move from an idea to a working product before the meeting that requested it ends. That speed changes the PM job.' },
  { id: 'e06ab168-56aa-45f5-9672-619215df3ce7', variant: 'pm-os-yt-b', channel: 'youtube', expectedText: 'I Built the Product Brief With AI. Then I Audited Every Decision.' },
  { id: '03f9e0ed-3fee-4d5b-815c-602b6e0e917b', variant: 'harness-li-b', channel: 'linkedin', expectedText: 'I trust an agent more when I can see what it was forbidden to do.' },
  { id: '2d96e662-5e7e-4761-8a87-85128e20a559', variant: 'harness-yt-b', channel: 'youtube', expectedText: 'Can You Reconstruct What Your AI Agent Did? A Receipt Test' },
]

mkdirSync(outputDir, { recursive: true })
rmSync(rawDir, { recursive: true, force: true })
mkdirSync(rawDir, { recursive: true })

const rawStorageState = JSON.parse(readFileSync(authStatePath, 'utf8'))
const storageState = {
  ...rawStorageState,
  origins: (rawStorageState.origins || []).map(origin => ({ ...origin, origin: baseUrl })),
}

function route(record) {
  const params = new URLSearchParams({
    step: 'copy',
    qa_fixture: 'channel_experiment_social_detail_v1',
    rev: revision,
  })
  return `${baseUrl}/admin/social-content/${record.id}?${params.toString()}`
}

async function createPage(context) {
  const page = await context.newPage()
  const externalRequests = []
  const allowedAuthRequests = []
  const blockedExpectedRequests = []
  await page.route('**/*', async requestRoute => {
    const url = new URL(requestRoute.request().url())
    if (url.origin === baseUrl) return requestRoute.continue()
    if (/\.supabase\.co$/.test(url.hostname) && url.pathname.startsWith('/auth/v1/')) {
      allowedAuthRequests.push(requestRoute.request().url())
      return requestRoute.continue()
    }
    if (url.hostname === 'va.vercel-scripts.com') {
      blockedExpectedRequests.push(requestRoute.request().url())
      return requestRoute.abort('blockedbyclient')
    }
    externalRequests.push(requestRoute.request().url())
    return requestRoute.abort('blockedbyclient')
  })
  return { page, externalRequests, allowedAuthRequests, blockedExpectedRequests }
}

async function recordViewport(browser, { label, viewport }) {
  const videoDir = path.join(rawDir, label)
  mkdirSync(videoDir, { recursive: true })
  const context = await browser.newContext({
    storageState,
    viewport,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    recordVideo: { dir: videoDir, size: viewport },
  })
  await context.addInitScript(() => window.localStorage.setItem('theme', 'dark'))
  const { page, externalRequests, allowedAuthRequests, blockedExpectedRequests } = await createPage(context)
  const routeReceipts = []

  for (const record of records) {
    const url = route(record)
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    let surface
    if (record.channel === 'youtube') {
      surface = page.getByRole('region', { name: `YouTube experiment review: ${record.expectedText}` })
      await surface.waitFor({ state: 'visible', timeout: 30_000 })
      await surface.getByText(record.expectedText, { exact: true }).waitFor({ state: 'visible' })
      for (const heading of ['Opening hook', 'Episode outline', 'Thumbnail brief', 'Evidence lineage', 'Product-proof requirements']) {
        await surface.getByText(heading, { exact: true }).waitFor({ state: 'visible' })
      }
      if (await page.getByText('LinkedIn Preview', { exact: true }).count()) throw new Error(`${label} ${record.id} rendered LinkedIn preview guidance.`)
      if (await page.getByText('LinkedIn optimal: 150-300 words', { exact: true }).count()) throw new Error(`${label} ${record.id} rendered LinkedIn copy guidance.`)
      if (await page.getByRole('region', { name: 'Copy review decision gate' }).count()) throw new Error(`${label} ${record.id} rendered the generic copy approval gate.`)
      if (await page.getByRole('button', { name: /Approve Copy/i }).count()) throw new Error(`${label} ${record.id} exposed a copy approval action.`)
      if (await page.getByRole('button', { name: /Save Draft/i }).count()) throw new Error(`${label} ${record.id} exposed a draft mutation action.`)
      if (!await surface.getByText('Unscored', { exact: true }).count()) throw new Error(`${label} ${record.id} did not expose the Unscored state.`)
      if (!await page.getByText('Privacy-safe channel-native YouTube experiment fixture. Review only.', { exact: true }).count()) throw new Error(`${label} ${record.id} did not expose the YouTube read-only fixture notice.`)
    } else {
      const preview = page.getByLabel('LinkedIn post preview')
      await preview.waitFor({ state: 'visible', timeout: 30_000 })
      const previewText = await preview.innerText()
      if (!previewText.includes(record.expectedText)) throw new Error(`${label} ${record.id} did not render the expected LinkedIn ${record.variant} copy.`)
      const copyGate = page.getByRole('region', { name: 'Copy review decision gate' })
      await copyGate.waitFor({ state: 'visible', timeout: 30_000 })
      surface = preview
      if (await page.locator('[data-theme-surface="linkedin-preview-chrome"]').count() !== 1) throw new Error(`${label} ${record.id} did not render the ordinary LinkedIn preview chrome.`)
      if (!await page.getByText('LinkedIn optimal: 150-300 words', { exact: true }).count()) throw new Error(`${label} ${record.id} did not preserve LinkedIn copy guidance.`)
      if (await page.getByTestId('channel-experiment-social-review').count()) throw new Error(`${label} ${record.id} incorrectly rendered the specialized YouTube review.`)
      if (!await page.getByText('Privacy-safe LinkedIn control fixture. Review only.', { exact: true }).count()) throw new Error(`${label} ${record.id} did not expose the LinkedIn control notice.`)
    }

    const routeScreenshot = `${label}-${record.variant}-${record.id}-route.png`
    const reviewScreenshot = `${label}-${record.variant}-${record.id}-review.png`
    await page.screenshot({ path: path.join(outputDir, routeScreenshot), fullPage: false })

    await page.locator('[data-social-detail-header]').evaluate(element => {
      element.style.position = 'relative'
      element.style.maxHeight = 'none'
    })
    await surface.evaluate(element => {
      const scroller = document.querySelector('#admin-main')
      if (!(scroller instanceof HTMLElement)) throw new Error('Admin scroll container is missing.')
      const top = element.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12
      scroller.scrollTo({ top: Math.max(0, top), behavior: 'instant' })
    })
    await page.waitForTimeout(350)
    await page.screenshot({ path: path.join(outputDir, reviewScreenshot), fullPage: false })

    if (record.channel === 'youtube') {
      await surface.getByText('Score inputs and Unscored evidence', { exact: true }).scrollIntoViewIfNeeded()
      await page.waitForTimeout(250)
      await surface.getByText('Evidence boundaries and execution gates', { exact: true }).scrollIntoViewIfNeeded()
      await page.waitForTimeout(250)
    } else {
      await page.getByLabel('LinkedIn post preview').scrollIntoViewIfNeeded()
      await page.waitForTimeout(500)
    }

    routeReceipts.push({ id: record.id, variant: record.variant, channel: record.channel, url, screenshots: [routeScreenshot, reviewScreenshot] })
  }

  const video = page.video()
  await context.close()
  const rawVideoPath = await video?.path()
  if (!rawVideoPath) throw new Error(`${label} did not produce a walkthrough recording.`)
  const stableVideoPath = path.join(rawDir, `${label}.webm`)
  renameSync(rawVideoPath, stableVideoPath)
  if (externalRequests.length) throw new Error(`${label} made unexpected external requests: ${externalRequests.join(', ')}`)

  return { stableVideoPath, routeReceipts, allowedAuthRequests, blockedExpectedRequests }
}

const browser = await chromium.launch({ headless: true })
let desktop
let mobile
try {
  desktop = await recordViewport(browser, { label: 'desktop-1440', viewport: { width: 1440, height: 900 } })
  mobile = await recordViewport(browser, { label: 'mobile-390', viewport: { width: 390, height: 844 } })
} finally {
  await browser.close()
}

execFileSync('ffmpeg', [
  '-y',
  '-i', desktop.stableVideoPath,
  '-i', mobile.stableVideoPath,
  '-filter_complex',
  '[0:v]scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2:color=0x020617,setsar=1[v0];[1:v]scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2:color=0x020617,setsar=1[v1];[v0][v1]concat=n=2:v=1:a=0[outv]',
  '-map', '[outv]',
  '-c:v', 'libx264',
  '-preset', 'medium',
  '-crf', '20',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  '-an',
  finalMp4,
], { stdio: 'ignore' })

const probe = JSON.parse(execFileSync('ffprobe', [
  '-v', 'error',
  '-select_streams', 'v:0',
  '-show_entries', 'stream=codec_name,width,height,avg_frame_rate,nb_frames:format=duration,size',
  '-of', 'json',
  finalMp4,
], { encoding: 'utf8' }))

for (const receipt of [...desktop.routeReceipts, ...mobile.routeReceipts]) {
  for (const screenshot of receipt.screenshots) {
    if (!existsSync(path.join(outputDir, screenshot))) throw new Error(`Missing screenshot ${screenshot}.`)
  }
}

const receipt = {
  revision,
  fixture: 'channel_experiment_social_detail_v1',
  record_ids: records.map(record => record.id),
  record_variants: records.map(record => ({ id: record.id, variant: record.variant, channel: record.channel })),
  exact_routes: desktop.routeReceipts.map(item => item.url),
  viewports: ['1440x900', '390x844'],
  routes_reviewed: desktop.routeReceipts.length + mobile.routeReceipts.length,
  screenshots: [...desktop.routeReceipts, ...mobile.routeReceipts].flatMap(item => item.screenshots),
  assertions: [
    'title',
    'description',
    'opening hook',
    'episode outline',
    'thumbnail brief',
    'evidence lineage',
    'product-proof requirements',
    'Unscored state',
    'no LinkedIn preview guidance',
    'no generic copy approval gate',
    'no draft mutation actions',
    'ordinary LinkedIn preview and copy guidance preserved for LinkedIn controls',
    'specialized YouTube review withheld from LinkedIn controls',
    'channel-specific read-only notice',
  ],
  side_effects: {
    production_social_content_reads: false,
    production_writes: false,
    provider_calls: false,
    rendering: false,
    upload: false,
    platform_draft: false,
    schedule: false,
    publish: false,
    external_send: false,
  },
  network: {
    unexpected_external_requests: 0,
    allowed_auth_requests: desktop.allowedAuthRequests.length + mobile.allowedAuthRequests.length,
    blocked_expected_analytics_requests: desktop.blockedExpectedRequests.length + mobile.blockedExpectedRequests.length,
  },
  mp4: path.relative(root, finalMp4),
  mp4_sha256: createHash('sha256').update(readFileSync(finalMp4)).digest('hex'),
  probe,
}
writeFileSync(path.join(outputDir, 'qa-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`)
console.log(JSON.stringify(receipt, null, 2))
