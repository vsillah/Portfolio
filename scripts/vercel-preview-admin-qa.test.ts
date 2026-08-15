import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  chromiumLaunch: vi.fn(),
  getBypass: vi.fn(),
}))

vi.mock('playwright', () => ({
  chromium: {
    launch: mocks.chromiumLaunch,
  },
}))

vi.mock('./vercel-validation-env', () => ({
  getVercelAutomationBypassSecretForBaseUrl: mocks.getBypass,
}))

import {
  buildRouteUrl,
  defaultAuthStatePath,
  parsePreviewAdminQaArgs,
  runPreviewAdminQa,
  sanitizeAuthStateName,
} from './vercel-preview-admin-qa'

describe('vercel preview admin QA helper', () => {
  let tempRoot: string

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-preview-qa-'))
    mocks.chromiumLaunch.mockReset()
    mocks.getBypass.mockReset()
  })

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('parses a preview route and derives a gitignored auth-state path', () => {
    const options = parsePreviewAdminQaArgs([
      '--base-url',
      'https://portfolio-git-example-vsillahs-projects.vercel.app',
      '--route',
      'admin/agents/content-intelligence',
    ], tempRoot)

    expect(options).toEqual({
      baseUrl: 'https://portfolio-git-example-vsillahs-projects.vercel.app',
      route: '/admin/agents/content-intelligence',
      authStatePath: path.join(tempRoot, '.auth', 'portfolio-git-example-vsillahs-projects.vercel.app-admin-storage-state.json'),
      createAuthState: true,
      headless: true,
    })
    expect(sanitizeAuthStateName('https://Portfolio.Example.vercel.app')).toBe('portfolio.example.vercel.app')
    expect(defaultAuthStatePath('https://portfolio.example.vercel.app', tempRoot)).toContain(`${path.sep}.auth${path.sep}`)
  })

  it('requires a base URL and preserves explicit auth-state and headed flags', () => {
    expect(() => parsePreviewAdminQaArgs(['--route', '/admin'], tempRoot)).toThrow('Missing required --base-url')
    expect(() => parsePreviewAdminQaArgs([
      '--base-url',
      'https://portfolio.example.vercel.app',
      '--route',
      '--headed',
    ], tempRoot)).toThrow('--route requires a value.')
    expect(() => parsePreviewAdminQaArgs([
      '--base-url',
      'https://portfolio.example.vercel.app',
      '--auth-state',
      '--no-create-auth',
    ], tempRoot)).toThrow('--auth-state requires a value.')

    const options = parsePreviewAdminQaArgs([
      '--base-url',
      'https://portfolio.example.vercel.app',
      '--route',
      '/admin',
      '--auth-state',
      '.auth/custom.json',
      '--no-create-auth',
      '--headed',
    ], tempRoot)

    expect(options.authStatePath).toBe('.auth/custom.json')
    expect(options.createAuthState).toBe(false)
    expect(options.headless).toBe(false)
  })

  it('verifies a Portfolio route without printing bypass secrets', async () => {
    const authStatePath = path.join(tempRoot, '.auth', 'preview-admin.json')
    fs.mkdirSync(path.dirname(authStatePath), { recursive: true })
    fs.writeFileSync(authStatePath, JSON.stringify({ cookies: [], origins: [] }))

    const innerText = vi.fn(async () => 'Research and Shaka insight queue')
    const page = {
      goto: vi.fn(async () => ({ status: () => 200 })),
      waitForLoadState: vi.fn(async () => undefined),
      url: vi.fn(() => 'https://portfolio.example.vercel.app/admin/agents/content-intelligence'),
      locator: vi.fn(() => ({ innerText })),
    }
    const context = { newPage: vi.fn(async () => page) }
    const browser = {
      newContext: vi.fn(async () => context),
      close: vi.fn(async () => undefined),
    }
    mocks.chromiumLaunch.mockResolvedValue(browser)
    mocks.getBypass.mockReturnValue('secret-bypass-value')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await runPreviewAdminQa({
      baseUrl: 'https://portfolio.example.vercel.app',
      route: '/admin/agents/content-intelligence',
      authStatePath,
      createAuthState: false,
      headless: true,
    })

    expect(buildRouteUrl('https://portfolio.example.vercel.app', '/admin/agents/content-intelligence')).toBe(
      'https://portfolio.example.vercel.app/admin/agents/content-intelligence',
    )
    expect(browser.newContext).toHaveBeenCalledWith(expect.objectContaining({
      storageState: authStatePath,
      extraHTTPHeaders: {
        'x-vercel-protection-bypass': 'secret-bypass-value',
        'x-vercel-set-bypass-cookie': 'true',
      },
    }))
    expect(logSpy.mock.calls.flat().join('\n')).not.toContain('secret-bypass-value')
  })
})
