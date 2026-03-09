/**
 * Capture screenshots and short video clips for the about-page video storyboard.
 * Writes to design-files/about-page-video/.
 *
 * If the dev server is not running at BASE_URL, the script will start it (npm run dev) and wait
 * for it to be ready before capturing. Set BASE_URL to use a different origin (e.g. production).
 *
 * Usage: npx tsx scripts/capture-storyboard-assets.ts [--videos] [--no-start-server]
 *   --videos          Also record a short (4s) clip per route (WebM).
 *   --no-start-server Do not auto-start the dev server; fail if BASE_URL is unreachable.
 */

import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const OUT_DIR = path.join(process.cwd(), 'design-files', 'about-page-video')
const VIEWPORT = { width: 1920, height: 1080 }
const CLIP_DURATION_MS = 4000
const SERVER_READY_TIMEOUT_MS = 90_000
const SERVER_POLL_MS = 1500

async function isServerReachable(): Promise<boolean> {
  try {
    const res = await fetch(BASE_URL, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
    return res.ok || res.status < 500
  } catch {
    return false
  }
}

async function ensureServerRunning(): Promise<void> {
  if (process.argv.includes('--no-start-server')) {
    const ok = await isServerReachable()
    if (!ok) {
      throw new Error(`Server at ${BASE_URL} is not reachable. Start it with "npm run dev" or remove --no-start-server to auto-start.`)
    }
    return
  }
  if (await isServerReachable()) return

  console.log(`Server at ${BASE_URL} not running. Starting dev server...`)
  const dev = spawn('npm', ['run', 'dev'], {
    cwd: process.cwd(),
    stdio: 'ignore',
    detached: true,
    shell: false,
  })
  dev.unref()
  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, SERVER_POLL_MS))
    if (await isServerReachable()) {
      console.log('Dev server is ready.')
      return
    }
  }
  dev.kill()
  throw new Error(`Dev server did not become ready at ${BASE_URL} within ${SERVER_READY_TIMEOUT_MS / 1000}s.`)
}

const ROUTES: { route: string; filename: string; description: string }[] = [
  { route: '/', filename: 'screenshot-home', description: 'Home / hero' },
  { route: '/store', filename: 'screenshot-store', description: 'Store' },
  { route: '/services', filename: 'screenshot-services', description: 'Services' },
  { route: '/tools/audit', filename: 'screenshot-tools-audit', description: 'Tools (audit)' },
  { route: '/resources', filename: 'screenshot-resources', description: 'Resources' },
  { route: '/admin', filename: 'screenshot-admin', description: 'Admin dashboard (or login)' },
  { route: '/admin/module-sync', filename: 'screenshot-admin-module-sync', description: 'Module Sync' },
  { route: '/admin/chat-eval', filename: 'screenshot-admin-chat-eval', description: 'Chat Eval' },
  { route: '/#about', filename: 'screenshot-about', description: 'About section' },
]

async function main() {
  const recordVideos = process.argv.includes('--videos')

  await ensureServerRunning()

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true })
    console.log('Created', OUT_DIR)
  }

  const browser = await chromium.launch({ headless: true })

  for (const { route, filename, description } of ROUTES) {
    const videoDir = recordVideos ? path.join(OUT_DIR, `_video-${filename}`) : undefined
    if (videoDir && !fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true })

    const contextOptions: { viewport: typeof VIEWPORT; recordVideo?: { dir: string } } = {
      viewport: VIEWPORT,
    }
    if (recordVideos && videoDir) contextOptions.recordVideo = { dir: videoDir }

    const context = await browser.newContext(contextOptions)
    const page = await context.newPage()

    try {
      const url = BASE_URL + route
      console.log('Capturing', description, '→', filename)
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(800)

      const screenshotPath = path.join(OUT_DIR, `${filename}.png`)
      await page.screenshot({ path: screenshotPath, fullPage: route === '/' || route === '/#about' })
      console.log('  Screenshot:', screenshotPath)

      if (recordVideos) {
        await page.waitForTimeout(CLIP_DURATION_MS)
      }
    } catch (e) {
      console.warn('  Failed:', e instanceof Error ? e.message : e)
    } finally {
      await context.close()
      if (recordVideos && videoDir && fs.existsSync(videoDir)) {
        const webms = fs.readdirSync(videoDir).filter((f) => f.endsWith('.webm'))
        if (webms[0]) {
          const src = path.join(videoDir, webms[0])
          const dest = path.join(OUT_DIR, `clip-${filename}.webm`)
          fs.renameSync(src, dest)
          console.log('  Clip:', dest)
        }
        fs.rmSync(videoDir, { recursive: true })
      }
    }
  }

  await browser.close()
  console.log('Done. Assets in', OUT_DIR)
  if (recordVideos) {
    console.log('Videos are in the same dir (Playwright names them by context). Rename to clip-*.webm if desired.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
