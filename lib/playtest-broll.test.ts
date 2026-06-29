import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_ROUTES, selectRoutesFromScript } from './playtest-broll'

const mocks = vi.hoisted(() => ({
  chromiumLaunch: vi.fn(),
  serverlessExecutablePath: vi.fn(),
}))

vi.mock('playwright-core', () => ({
  chromium: {
    launch: mocks.chromiumLaunch,
  },
}))

vi.mock('@sparticuz/chromium', () => ({
  default: {
    args: ['--serverless-arg'],
    executablePath: mocks.serverlessExecutablePath,
  },
}))

function createBrowserMock() {
  const page = {
    goto: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(undefined),
    locator: vi.fn(() => ({
      first: vi.fn(() => ({
        screenshot: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  }
  const context = {
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn().mockResolvedValue(undefined),
  }
  const browser = {
    newContext: vi.fn().mockResolvedValue(context),
    close: vi.fn().mockResolvedValue(undefined),
  }

  return { browser, context, page }
}

async function importFreshPlaytestBroll() {
  vi.resetModules()
  return import('./playtest-broll')
}

beforeEach(() => {
  mocks.chromiumLaunch.mockReset()
  mocks.serverlessExecutablePath.mockReset()
  mocks.serverlessExecutablePath.mockResolvedValue('/tmp/serverless-chromium')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('selectRoutesFromScript', () => {
  it('returns all routes when no keywords are present', () => {
    const routes = selectRoutesFromScript(
      'This script covers quarterly revenue forecasting only.',
      DEFAULT_ROUTES
    )
    expect(routes).toEqual(DEFAULT_ROUTES)
  })

  it('matches keywords case-insensitively', () => {
    const routes = selectRoutesFromScript('Show the HOME hero first.', DEFAULT_ROUTES)
    expect(routes.map((r) => r.filename)).toEqual(['screenshot-home'])
  })

  it('returns unique route matches even when overlapping keywords appear', () => {
    const routes = selectRoutesFromScript(
      'Cover admin dashboard, then chat eval and eval recap.',
      DEFAULT_ROUTES
    )
    expect(routes.map((r) => r.filename)).toEqual([
      'screenshot-admin',
      'screenshot-admin-chat-eval',
    ])
  })

  it('preserves route order from the original list', () => {
    const routes = selectRoutesFromScript('Cover store, services, and module sync.', DEFAULT_ROUTES)
    expect(routes.map((r) => r.filename)).toEqual([
      'screenshot-store',
      'screenshot-services',
      'screenshot-admin-module-sync',
    ])
  })
})

describe('captureBroll browser launch', () => {
  it('uses the local Playwright launch path outside serverless runtimes', async () => {
    const { browser } = createBrowserMock()
    mocks.chromiumLaunch.mockResolvedValue(browser)
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playtest-broll-local-'))
    const { captureBroll } = await importFreshPlaytestBroll()

    try {
      await captureBroll({
        routes: [{ route: '/', filename: 'home' }],
        outputDir,
        noStartServer: true,
      })

      expect(mocks.serverlessExecutablePath).not.toHaveBeenCalled()
      expect(mocks.chromiumLaunch).toHaveBeenCalledWith({ headless: true })
      expect(browser.close).toHaveBeenCalled()
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true })
    }
  })

  it('uses @sparticuz/chromium executable settings in Vercel runtimes', async () => {
    vi.stubEnv('VERCEL', '1')
    const { browser } = createBrowserMock()
    mocks.chromiumLaunch.mockResolvedValue(browser)
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playtest-broll-serverless-'))
    const { captureBroll } = await importFreshPlaytestBroll()

    try {
      await captureBroll({
        routes: [{ route: '/store', filename: 'store' }],
        outputDir,
        noStartServer: true,
      })

      expect(mocks.serverlessExecutablePath).toHaveBeenCalledTimes(1)
      expect(mocks.chromiumLaunch).toHaveBeenCalledWith({
        args: ['--serverless-arg'],
        executablePath: '/tmp/serverless-chromium',
        headless: true,
      })
      expect(browser.close).toHaveBeenCalled()
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true })
    }
  })
})
