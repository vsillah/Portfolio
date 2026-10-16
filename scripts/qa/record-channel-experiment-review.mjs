import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const root = process.cwd()
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3107'
const revision = process.env.QA_REVISION || 'working-tree'
const outputDir = path.join(root, 'artifacts', 'human-qa', 'channel-experiments-2026-10-16')
const rawDir = path.join(root, 'test-results', 'channel-experiment-review-video')
const finalMp4 = path.join(outputDir, 'channel-experiment-review-walkthrough.mp4')
const packets = [
  { id: '407df879-a539-40a1-a20e-75de31b9c494', title: 'Stop Counting AI Licenses', youtubeB: 'Your AI Pilot Worked. Then the Handoff Broke.' },
  { id: '61d0ab8a-29fa-40de-aa7a-49b15c74cafa', title: "The Product Manager's New Operating System", youtubeB: 'I Built the Product Brief With AI. Then I Audited Every Decision.' },
  { id: '048a80bb-bcfa-48d7-9d90-ce66d36f4523', title: 'The Agent Harness Is the Product', youtubeB: 'Can You Reconstruct What Your AI Agent Did? A Receipt Test' },
]

mkdirSync(outputDir, { recursive: true })
rmSync(rawDir, { recursive: true, force: true })
mkdirSync(rawDir, { recursive: true })

function route(packetId) {
  return `${baseUrl}/admin/agents/content-intelligence?section=research&packet=${packetId}&qa_fixture=channel_experiments_v1&rev=${revision}`
}

async function preparePage(context) {
  const page = await context.newPage()
  const externalRequests = []
  const blockedExpectedRequests = []
  await page.route('**/*', async requestRoute => {
    const url = new URL(requestRoute.request().url())
    if (url.origin === baseUrl) return requestRoute.continue()
    if (url.hostname === 'va.vercel-scripts.com') {
      blockedExpectedRequests.push(requestRoute.request().url())
      return requestRoute.abort('blockedbyclient')
    }
    externalRequests.push(requestRoute.request().url())
    return requestRoute.abort('blockedbyclient')
  })
  return { page, externalRequests, blockedExpectedRequests }
}

async function openPacket(page, packet) {
  await page.goto(route(packet.id), { waitUntil: 'domcontentloaded' })
  await page.getByText('Privacy-safe local QA fixture', { exact: true }).waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByRole('region', { name: `Channel experiments for ${packet.title}` }).waitFor({ state: 'visible' })
}

async function navigateToPacket(page, packet) {
  await Promise.all([
    page.waitForURL(route(packet.id)),
    page.getByRole('link', { name: packet.title, exact: true }).click(),
  ])
  await page.getByRole('region', { name: `Channel experiments for ${packet.title}` }).waitFor({ state: 'visible' })
}

async function recordScenario(browser, { label, viewport }) {
  const videoDir = path.join(rawDir, label)
  mkdirSync(videoDir, { recursive: true })
  const context = await browser.newContext({
    viewport,
    colorScheme: 'dark',
    recordVideo: { dir: videoDir, size: viewport },
  })
  await context.addInitScript(() => window.localStorage.setItem('theme', 'dark'))
  const { page, externalRequests, blockedExpectedRequests } = await preparePage(context)

  for (const [index, packet] of packets.entries()) {
    if (index === 0) await openPacket(page, packet)
    else await navigateToPacket(page, packet)
    if (index === 0) await page.screenshot({ path: path.join(outputDir, `${label}-linkedin-dark.png`), fullPage: false })
    await page.getByRole('button', { name: 'youtube', exact: true }).click()
    await page.getByRole('button', { name: /Variant B/ }).click()
    await page.getByText(packet.youtubeB, { exact: true }).scrollIntoViewIfNeeded()
    await page.waitForTimeout(600)
    if (index === 0) await page.screenshot({ path: path.join(outputDir, `${label}-youtube-b-dark.png`), fullPage: false })
    if (index === 1) await page.screenshot({ path: path.join(outputDir, `${label}-product-manager-youtube-b-dark.png`), fullPage: false })
  }

  const video = page.video()
  await context.close()
  const videoPath = await video.path()
  if (!videoPath) throw new Error(`No video was recorded for ${label}.`)
  if (externalRequests.length) throw new Error(`${label} made unexpected external requests: ${externalRequests.join(', ')}`)
  return { videoPath, blockedExpectedRequests }
}

async function captureLight(browser, { label, viewport }) {
  const context = await browser.newContext({ viewport, colorScheme: 'light' })
  await context.addInitScript(() => window.localStorage.setItem('theme', 'light'))
  const { page, externalRequests, blockedExpectedRequests } = await preparePage(context)
  await openPacket(page, packets[0])
  await page.screenshot({ path: path.join(outputDir, `${label}-linkedin-light.png`), fullPage: false })
  await context.close()
  if (externalRequests.length) throw new Error(`${label} light capture made unexpected external requests: ${externalRequests.join(', ')}`)
  return blockedExpectedRequests
}

const browser = await chromium.launch({ headless: true })
let desktopCapture
let mobileCapture
let desktopLightBlocked
let mobileLightBlocked
try {
  desktopCapture = await recordScenario(browser, { label: 'desktop-1440', viewport: { width: 1440, height: 900 } })
  mobileCapture = await recordScenario(browser, { label: 'mobile-390', viewport: { width: 390, height: 844 } })
  desktopLightBlocked = await captureLight(browser, { label: 'desktop-1440', viewport: { width: 1440, height: 900 } })
  mobileLightBlocked = await captureLight(browser, { label: 'mobile-390', viewport: { width: 390, height: 844 } })
} finally {
  await browser.close()
}

execFileSync('ffmpeg', [
  '-y',
  '-i', desktopCapture.videoPath,
  '-i', mobileCapture.videoPath,
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

const screenshots = [
  'desktop-1440-linkedin-dark.png',
  'desktop-1440-youtube-b-dark.png',
  'desktop-1440-product-manager-youtube-b-dark.png',
  'desktop-1440-linkedin-light.png',
  'mobile-390-linkedin-dark.png',
  'mobile-390-youtube-b-dark.png',
  'mobile-390-product-manager-youtube-b-dark.png',
  'mobile-390-linkedin-light.png',
]
for (const screenshot of screenshots) {
  if (!existsSync(path.join(outputDir, screenshot))) throw new Error(`Missing screenshot ${screenshot}.`)
}

const receipt = {
  revision,
  route: route(packets[0].id),
  packet_ids: packets.map(packet => packet.id),
  viewports: ['1440x900', '390x844'],
  themes: ['dark', 'light'],
  interactions: ['campaign navigation', 'LinkedIn variant A', 'YouTube channel switch', 'YouTube variant B'],
  screenshots,
  side_effects: {
    production_reads: false,
    production_writes: false,
    provider_calls: false,
    media_render: false,
    upload: false,
    platform_draft: false,
    schedule: false,
    publish: false,
    external_send: false,
  },
  network: {
    completed_external_requests: 0,
    blocked_expected_analytics_requests: [
      ...desktopCapture.blockedExpectedRequests,
      ...mobileCapture.blockedExpectedRequests,
      ...desktopLightBlocked,
      ...mobileLightBlocked,
    ].length,
    blocked_expected_hosts: ['va.vercel-scripts.com'],
  },
  mp4: path.relative(root, finalMp4),
  mp4_sha256: createHash('sha256').update(readFileSync(finalMp4)).digest('hex'),
  probe,
}
writeFileSync(path.join(outputDir, 'qa-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`)
console.log(JSON.stringify(receipt, null, 2))
