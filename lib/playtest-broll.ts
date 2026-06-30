/**
 * Reusable playtest B-roll capture module.
 * Used by the storyboard capture script and the video generation pipeline.
 * Keeps capture logic flexible for presentations, service demos, and other use cases.
 */

import * as fs from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'
import chromiumServerless from '@sparticuz/chromium'
import { chromium } from 'playwright-core'
import type { Page } from 'playwright-core'
import { generateAuthState } from '@/scripts/save-storyboard-auth'

const VIEWPORT = { width: 1920, height: 1080 }
const CLIP_DURATION_MS = 4000
const SERVER_READY_TIMEOUT_MS = 90_000
const SERVER_POLL_MS = 1500
const IS_SERVERLESS_CHROMIUM_RUNTIME = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)

export interface RouteConfig {
  route: string
  filename: string
  description?: string
  /** When set, overrides default full-page rules for this route */
  fullPage?: boolean
  /** Optional per-route viewport for tighter product screenshots */
  viewport?: { width: number; height: number }
  /** Optional browser color scheme for theme-specific captures */
  colorScheme?: 'light' | 'dark' | 'no-preference'
  /** Optional selector to wait for before screenshot capture */
  waitForSelector?: string
  /** Optional selector to screenshot instead of the whole viewport/page */
  screenshotSelector?: string
}

export interface BrollProgressEvent {
  route: string
  filename: string
  step: 'navigating' | 'screenshot' | 'recording' | 'done'
  index: number
  total: number
}

export interface PlaytestConfig {
  routes: RouteConfig[]
  outputDir: string
  recordVideos?: boolean
  baseUrl?: string
  authStatePath?: string
  /** Path to write auto-generated auth state. Default: outputDir/../.storyboard-auth-state.json */
  authStateOutPath?: string
  /** Skip auto-starting dev server; fail if unreachable */
  noStartServer?: boolean
  /** Called per-route with progress updates */
  onProgress?: (event: BrollProgressEvent) => void
}

export interface CaptureResult {
  screenshots: string[]
  clips: string[]
  outputDir: string
}

export const DEFAULT_ROUTES: RouteConfig[] = [
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

/** Keyword → route filename prefix mapping for script-driven route selection */
const SCRIPT_KEYWORDS: Array<{ keyword: string; filenamePrefix: string }> = [
  { keyword: 'store', filenamePrefix: 'screenshot-store' },
  { keyword: 'services', filenamePrefix: 'screenshot-services' },
  { keyword: 'tools', filenamePrefix: 'screenshot-tools-audit' },
  { keyword: 'audit', filenamePrefix: 'screenshot-tools-audit' },
  { keyword: 'resources', filenamePrefix: 'screenshot-resources' },
  { keyword: 'admin', filenamePrefix: 'screenshot-admin' },
  { keyword: 'module', filenamePrefix: 'screenshot-admin-module-sync' },
  { keyword: 'chat eval', filenamePrefix: 'screenshot-admin-chat-eval' },
  { keyword: 'eval', filenamePrefix: 'screenshot-admin-chat-eval' },
  { keyword: 'about', filenamePrefix: 'screenshot-about' },
  { keyword: 'home', filenamePrefix: 'screenshot-home' },
  { keyword: 'hero', filenamePrefix: 'screenshot-home' },
]

/**
 * Select routes to capture based on script text.
 * If script contains keywords, include matching routes; otherwise return all routes.
 */
export function selectRoutesFromScript(scriptText: string, allRoutes: RouteConfig[]): RouteConfig[] {
  const lower = scriptText.toLowerCase()
  const matchedPrefixes = new Set<string>()
  for (const { keyword, filenamePrefix } of SCRIPT_KEYWORDS) {
    if (lower.includes(keyword)) {
      matchedPrefixes.add(filenamePrefix)
    }
  }
  if (matchedPrefixes.size === 0) {
    return allRoutes
  }
  return allRoutes.filter((r) => matchedPrefixes.has(r.filename))
}

async function isServerReachable(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(baseUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
    return res.ok || res.status < 500
  } catch {
    return false
  }
}

/**
 * Ensure the dev server is running at baseUrl.
 * If not, start it and wait. Set noStartServer to skip auto-start.
 */
export async function ensureServerRunning(
  baseUrl: string = process.env.BASE_URL ?? 'http://localhost:3000',
  noStartServer?: boolean
): Promise<void> {
  if (noStartServer) {
    const ok = await isServerReachable(baseUrl)
    if (!ok) {
      throw new Error(
        `Server at ${baseUrl} is not reachable. Start it with "npm run dev" or remove noStartServer to auto-start.`
      )
    }
    return
  }
  if (await isServerReachable(baseUrl)) return

  console.log(`Server at ${baseUrl} not running. Starting dev server...`)
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
    if (await isServerReachable(baseUrl)) {
      console.log('Dev server is ready.')
      return
    }
  }
  dev.kill()
  throw new Error(
    `Dev server did not become ready at ${baseUrl} within ${SERVER_READY_TIMEOUT_MS / 1000}s.`
  )
}

/**
 * Resolve auth state path: explicit env > auto-generate > none.
 */
export async function resolveAuthState(
  baseUrl: string = process.env.BASE_URL ?? 'http://localhost:3000',
  authStateOutPath?: string
): Promise<string | undefined> {
  const explicit = process.env.STORYBOARD_AUTH_STATE
  if (explicit && fs.existsSync(explicit)) {
    if (typeof console !== 'undefined' && console.log) {
      console.log('Using explicit auth state:', explicit)
    }
    return explicit
  }

  if (process.env.ADMIN_E2E_EMAIL && process.env.ADMIN_E2E_PASSWORD) {
    if (typeof console !== 'undefined' && console.log) {
      console.log('Auto-generating auth state from ADMIN_E2E_EMAIL/PASSWORD...')
    }
    const outPath =
      authStateOutPath ?? path.join(process.cwd(), 'design-files', 'broll', '.storyboard-auth-state.json')
    const result = await generateAuthState({ baseUrl, outPath })
    if (result && typeof console !== 'undefined' && console.log) {
      console.log('Auth state generated:', result)
    }
    return result ?? undefined
  }

  if (typeof console !== 'undefined' && console.log) {
    console.log('No auth credentials found — admin routes will show the login page.')
  }
  return undefined
}

async function launchCaptureBrowser() {
  if (!IS_SERVERLESS_CHROMIUM_RUNTIME) {
    return chromium.launch({ headless: true })
  }

  return chromium.launch({
    args: chromiumServerless.args,
    executablePath: await chromiumServerless.executablePath(),
    headless: true,
  })
}

async function forceCaptureTheme(page: Page, colorScheme?: RouteConfig['colorScheme']) {
  if (colorScheme !== 'light' && colorScheme !== 'dark') return
  await page.evaluate((theme) => {
    try {
      window.localStorage.setItem('theme', theme)
    } catch {
      // Capture should still continue when storage is unavailable.
    }

    const isDark = theme === 'dark'
    document.documentElement.classList.toggle('dark', isDark)
    document.documentElement.style.colorScheme = theme
    document.body?.classList.toggle('dark', isDark)

    for (const element of Array.from(document.querySelectorAll<HTMLElement>('.agent-ops-page.dark, .dark.agent-ops-page'))) {
      element.classList.toggle('dark', isDark)
    }

    if (theme !== 'light') return

    for (const element of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
      if (element.classList.contains('bg-black')) {
        element.classList.remove('bg-black')
        element.classList.add('bg-background')
      }
      if (element.classList.contains('text-white')) {
        element.classList.remove('text-white')
        element.classList.add('text-foreground')
      }
      if (element.classList.contains('bg-gray-900')) {
        element.classList.remove('bg-gray-900')
        element.classList.add('bg-card')
      }
      if (element.classList.contains('border-gray-800')) {
        element.classList.remove('border-gray-800')
        element.classList.add('border-border')
      }
      if (element.classList.contains('text-gray-400')) {
        element.classList.remove('text-gray-400')
        element.classList.add('text-muted-foreground')
      }
    }
  }, colorScheme).catch(() => undefined)
}

/**
 * Capture B-roll (screenshots and optional video clips) for the given routes.
 */
export async function captureBroll(config: PlaytestConfig): Promise<CaptureResult> {
  const baseUrl = config.baseUrl ?? process.env.BASE_URL ?? 'http://localhost:3000'
  const outputDir = path.isAbsolute(config.outputDir) ? config.outputDir : path.join(process.cwd(), config.outputDir)

  await ensureServerRunning(baseUrl, config.noStartServer)

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const authStateOutPath = config.authStateOutPath ?? path.join(path.dirname(outputDir), '.storyboard-auth-state.json')
  const authStatePath =
    config.authStatePath ?? (await resolveAuthState(baseUrl, authStateOutPath))

  const screenshots: string[] = []
  const clips: string[] = []

  const browser = await launchCaptureBrowser()

  const total = config.routes.length
  for (let i = 0; i < config.routes.length; i++) {
    const {
      route,
      filename,
      description,
      fullPage: fullPageOverride,
      viewport: routeViewport,
      colorScheme,
      waitForSelector,
      screenshotSelector,
    } = config.routes[i]
    const viewport = routeViewport ?? VIEWPORT
    const videoDir = config.recordVideos ? path.join(outputDir, `_video-${filename}`) : undefined
    if (videoDir && !fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true })

    config.onProgress?.({ route, filename, step: 'navigating', index: i, total })

    const contextOptions: {
      viewport: typeof VIEWPORT
      colorScheme?: 'light' | 'dark' | 'no-preference'
      recordVideo?: { dir: string; size?: { width: number; height: number } }
      storageState?: string
    } = {
      viewport,
    }
    if (colorScheme) {
      contextOptions.colorScheme = colorScheme
    }
    if (config.recordVideos && videoDir) {
      contextOptions.recordVideo = { dir: videoDir, size: { width: viewport.width, height: viewport.height } }
    }
    if (authStatePath) {
      contextOptions.storageState = authStatePath
    }

    const context = await browser.newContext(contextOptions)
    if (colorScheme === 'light' || colorScheme === 'dark') {
      await context.addInitScript((theme) => {
        try {
          window.localStorage.setItem('theme', theme)
        } catch {
          // Ignore storage errors during isolated screenshot capture.
        }
        document.documentElement.classList.toggle('dark', theme === 'dark')
        document.documentElement.style.colorScheme = theme
      }, colorScheme)
    }
    const page = await context.newPage()

    try {
      const url = baseUrl + route
      const label = description ?? filename
      console.log('Capturing', label, '→', filename)
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout: 15000 })
      }
      await forceCaptureTheme(page, colorScheme)
      await page.waitForTimeout(800)

      config.onProgress?.({ route, filename, step: 'screenshot', index: i, total })

      const screenshotPath = path.join(outputDir, `${filename}.png`)
      const fullPage =
        fullPageOverride !== undefined
          ? fullPageOverride
          : route === '/' || route === '/#about'
      if (screenshotSelector) {
        const locator = page.locator(screenshotSelector).first()
        await locator.screenshot({ path: screenshotPath })
      } else {
        await page.screenshot({ path: screenshotPath, fullPage })
      }
      screenshots.push(screenshotPath)

      if (config.recordVideos) {
        config.onProgress?.({ route, filename, step: 'recording', index: i, total })
        await page.waitForTimeout(CLIP_DURATION_MS)
      }
    } catch (e) {
      console.warn('  Failed:', e instanceof Error ? e.message : e)
    } finally {
      await context.close()
      if (config.recordVideos && videoDir && fs.existsSync(videoDir)) {
        const webms = fs.readdirSync(videoDir).filter((f) => f.endsWith('.webm'))
        if (webms[0]) {
          const src = path.join(videoDir, webms[0])
          const dest = path.join(outputDir, `clip-${filename}.webm`)
          fs.renameSync(src, dest)
          clips.push(dest)
        }
        fs.rmSync(videoDir, { recursive: true })
      }
    }

    config.onProgress?.({ route, filename, step: 'done', index: i, total })
  }

  await browser.close()
  return { screenshots, clips, outputDir }
}
