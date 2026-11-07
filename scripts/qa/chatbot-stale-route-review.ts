/** Local fixture-only review of the public chat interruption and retry path. */
import { chromium, expect } from '@playwright/test'
import { mkdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

async function main() {
const base = 'http://127.0.0.1:5317'
const output = join(process.cwd(), 'docs/qa/chatbot-stale-route-recovery')
mkdirSync(output, { recursive: true })

process.env.MOCK_N8N = 'false'
process.env.N8N_DISABLE_OUTBOUND = 'false'
process.env.N8N_WEBHOOK_URL = 'fixture-only-route'
process.env.NEXT_PUBLIC_SITE_URL = base
const { sendToN8n } = await import('../../lib/n8n')
const nativeFetch = globalThis.fetch
globalThis.fetch = async () => new Response('<title>Cloudflare Error 1033</title>', { status: 530 })
const fallback = await sendToN8n({
  message: 'What chatbot services does AmaduTown offer?',
  sessionId: 'fixture-only',
})
globalThis.fetch = nativeFetch

const browser = await chromium.launch({ headless: true })
const sourceVideos: string[] = []
try {
  for (const [name, width, height] of [
    ['desktop', 1440, 900],
    ['mobile', 390, 844],
  ] as const) {
    const context = await browser.newContext({
      viewport: { width, height },
      recordVideo: { dir: output, size: { width, height } },
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    page.on('pageerror', error => console.log(name, 'page error:', error.message))
    let chatRequests = 0
    await page.route('**/*', async route => {
      const url = route.request().url()
      if (url.startsWith(base)) return route.continue()
      return route.abort()
    })
    await page.route('**/api/chat/history?*', route => route.fulfill({ json: { messages: [] } }))
    await page.route('**/api/chat/diagnostic?*', route => route.fulfill({ json: { audit: null } }))
    await page.route('**/api/chat', route => {
      chatRequests += 1
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(chatRequests === 1
          ? { ...fallback, sessionId: 'fixture-only' }
          : { response: 'The chat is responding again.', escalated: false, metadata: {}, sessionId: 'fixture-only' }),
      })
    })

    await page.goto(`${base}/#contact`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Chat Now' }).click()
    await page.getByRole('button', { name: 'Chat with AI Assistant' }).click()
    await page.getByPlaceholder('Ask me anything...').fill('What chatbot services does AmaduTown offer?')
    await page.getByPlaceholder('Ask me anything...').press('Enter')
    await expect(page.getByText('Our chat service is temporarily unavailable', { exact: false })).toBeVisible()
    await expect(page.getByText('AI Customer Support Chatbot', { exact: false })).toBeVisible()
    await expect(page.getByText('AI Inbound Lead Chatbot', { exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    await expect(page.locator('a[href*="/services/1313650b-1afb-44f7-8118-21f05b1ae8a0"]')).toHaveCount(1)
    await expect(page.locator('a[href*="/services/a479ce70-4856-4d3f-917b-c37bfff1f0a2"]')).toHaveCount(1)
    const panel = page.locator('div.overflow-hidden.rounded-xl').filter({ has: page.getByPlaceholder('Ask me anything...') }).first()
    await page.getByText('Our chat service is temporarily unavailable', { exact: false }).scrollIntoViewIfNeeded()
    await panel.screenshot({ path: join(output, `${name}-fallback-top.png`) })
    await page.getByRole('button', { name: 'Try again' }).scrollIntoViewIfNeeded()
    await panel.screenshot({ path: join(output, `${name}-fallback-bottom.png`) })
    await page.waitForTimeout(1200)
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByText('The chat is responding again.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)
    await page.waitForTimeout(400)
    await panel.screenshot({ path: join(output, `${name}-retry.png`) })
    if (chatRequests !== 2) throw new Error(`${name}: expected initial request and retry; got ${chatRequests}`)
    const video = page.video()
    await context.close()
    const videoPath = await video?.path()
    if (!videoPath) throw new Error(`${name}: Playwright did not save video`)
    sourceVideos.push(videoPath)
  }
} finally {
  await browser.close()
}

// The phone MP4 is continuous screen capture. The desktop MP4 uses three
// captured panel states because Chromium's 1440px recorder scales that viewport
// into a small corner on this host; the screenshots retain readable pixels.
await execFileAsync('ffmpeg', [
  '-y', '-v', 'error', '-i', sourceVideos[1], '-vf', 'crop=370:500:10:70',
  '-c:v', 'libx264', '-crf', '22', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart', join(output, 'mobile-walkthrough.mp4'),
])
await execFileAsync('ffmpeg', [
  '-y', '-v', 'error',
  '-loop', '1', '-t', '2.5', '-i', join(output, 'desktop-fallback-top.png'),
  '-loop', '1', '-t', '2.5', '-i', join(output, 'desktop-fallback-bottom.png'),
  '-loop', '1', '-t', '2.5', '-i', join(output, 'desktop-retry.png'),
  '-filter_complex', '[0:v][1:v][2:v]concat=n=3:v=1:a=0,pad=590:524:0:0,format=yuv420p[v]',
  '-map', '[v]', '-c:v', 'libx264', '-r', '25', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart', join(output, 'desktop-walkthrough.mp4'),
])
for (const videoPath of sourceVideos) unlinkSync(videoPath)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
