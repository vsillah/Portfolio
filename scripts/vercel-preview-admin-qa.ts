import * as fs from 'node:fs'
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright'
import { getVercelAutomationBypassSecretForBaseUrl } from './vercel-validation-env'

export type PreviewAdminQaOptions = {
  baseUrl: string
  route: string
  authStatePath: string
  createAuthState: boolean
  headless: boolean
}

export function usage() {
  return [
    'Usage:',
    '  npm run qa:preview-admin -- --base-url <preview-url> --route <admin-route>',
    '',
    'Options:',
    '  --base-url <url>      Required. Vercel preview or production-equivalent URL.',
    '  --route <path>        Route to verify. Defaults to /admin.',
    '  --auth-state <path>   Storage-state path. Defaults to .auth/<host>-admin-storage-state.json.',
    '  --no-create-auth      Use an existing auth-state file instead of running admin:auth:save.',
    '  --headed              Run headed Playwright.',
  ].join('\n')
}

function readArg(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name)
  if (index === -1) return undefined
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value.`)
  }
  return value
}

export function sanitizeAuthStateName(baseUrl: string) {
  const hostname = new URL(baseUrl).hostname
  return hostname.replace(/[^a-z0-9.-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
}

export function defaultAuthStatePath(baseUrl: string, cwd = process.cwd()) {
  return path.join(cwd, '.auth', `${sanitizeAuthStateName(baseUrl)}-admin-storage-state.json`)
}

function normalizeRoute(route: string) {
  return route.startsWith('/') ? route : `/${route}`
}

export function parsePreviewAdminQaArgs(argv = process.argv.slice(2), cwd = process.cwd()): PreviewAdminQaOptions {
  const baseUrl = readArg(argv, '--base-url')
  if (!baseUrl) {
    throw new Error('Missing required --base-url.\n\n' + usage())
  }

  try {
    new URL(baseUrl)
  } catch {
    throw new Error(`Invalid --base-url: ${baseUrl}`)
  }

  const route = normalizeRoute(readArg(argv, '--route') || '/admin')
  const authStatePath = readArg(argv, '--auth-state') || readArg(argv, '--out') || defaultAuthStatePath(baseUrl, cwd)

  return {
    baseUrl,
    route,
    authStatePath,
    createAuthState: !argv.includes('--no-create-auth'),
    headless: !argv.includes('--headed'),
  }
}

export function buildRouteUrl(baseUrl: string, route: string) {
  return new URL(normalizeRoute(route), baseUrl).toString()
}

function ensureAuthState(options: PreviewAdminQaOptions) {
  if (fs.existsSync(options.authStatePath)) return 'existing'
  if (!options.createAuthState) {
    throw new Error(`Auth state not found at ${options.authStatePath}. Remove --no-create-auth or run admin:auth:save first.`)
  }

  fs.mkdirSync(path.dirname(options.authStatePath), { recursive: true })
  execFileSync('npm', [
    'run',
    'admin:auth:save',
    '--',
    '--base-url',
    options.baseUrl,
    '--out',
    options.authStatePath,
  ], {
    cwd: process.cwd(),
    stdio: 'inherit',
  })

  if (!fs.existsSync(options.authStatePath)) {
    throw new Error(`admin:auth:save completed but did not create ${options.authStatePath}.`)
  }

  return 'created'
}

function vercelBypassHeaders(baseUrl: string) {
  const secret = getVercelAutomationBypassSecretForBaseUrl(baseUrl)
  return secret
    ? {
      'x-vercel-protection-bypass': secret,
      'x-vercel-set-bypass-cookie': 'true',
    }
    : undefined
}

function isVercelLoginUrl(value: string) {
  try {
    const url = new URL(value)
    return url.hostname === 'vercel.com' || url.hostname.endsWith('.vercel.com')
  } catch {
    return false
  }
}

async function assertPortfolioRouteReached(baseUrl: string, routeUrl: string, finalUrl: string, bodyText: string, status?: number | null) {
  const expectedHost = new URL(baseUrl).hostname
  const finalHost = new URL(finalUrl).hostname

  if (isVercelLoginUrl(finalUrl)) {
    throw new Error(`Preview QA reached Vercel login/protection instead of Portfolio: ${finalUrl}`)
  }

  if (finalHost !== expectedHost) {
    throw new Error(`Preview QA left expected Portfolio host ${expectedHost} and landed on ${finalHost}.`)
  }

  if (status && status >= 400) {
    throw new Error(`Preview QA route returned HTTP ${status}: ${routeUrl}`)
  }

  if (/vercel\s+(log\s*in|login|deployment protection)/i.test(bodyText)) {
    throw new Error('Preview QA page content still appears to be Vercel login/protection.')
  }
}

export async function runPreviewAdminQa(options: PreviewAdminQaOptions) {
  const authStateStatus = ensureAuthState(options)
  const routeUrl = buildRouteUrl(options.baseUrl, options.route)
  const headers = vercelBypassHeaders(options.baseUrl)

  console.log(`Preview admin QA base URL: ${options.baseUrl}`)
  console.log(`Preview admin QA route: ${options.route}`)
  console.log(`Preview admin QA auth state: ${options.authStatePath} (${authStateStatus})`)
  console.log(`Vercel protection bypass header configured: ${headers ? 'yes' : 'no'}`)

  const browser = await chromium.launch({ headless: options.headless })
  try {
    const context = await browser.newContext({
      storageState: options.authStatePath,
      extraHTTPHeaders: headers,
    })
    const page = await context.newPage()
    const response = await page.goto(routeUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => undefined)
    const finalUrl = page.url()
    const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')

    await assertPortfolioRouteReached(options.baseUrl, routeUrl, finalUrl, bodyText, response?.status())
    console.log(`Preview admin QA reached Portfolio route: ${finalUrl}`)
  } finally {
    await browser.close()
  }
}

async function main() {
  const options = parsePreviewAdminQaArgs()
  await runPreviewAdminQa(options)
}

if (process.argv[1]?.endsWith('vercel-preview-admin-qa.ts')) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
