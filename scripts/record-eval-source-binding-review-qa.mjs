import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { chromium, expect } from '@playwright/test'

const root = process.cwd()
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:3217'
const origin = new URL(baseUrl).origin
const routePath = `/admin/model-ops/eval-source-bindings?rev=${commit}`
const outputDir = path.join(root, 'test-results', 'eval-source-binding-review', commit.slice(0, 8))
const rawDir = path.join(outputDir, 'raw')

function readEnvValue(key) {
  for (const file of ['.env.local', '.env']) {
    const filePath = path.join(root, file)
    if (!fs.existsSync(filePath)) continue
    const match = fs.readFileSync(filePath, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'))
    if (match) return match[1].trim().replace(/^['"]|['"]$/g, '')
  }
  return process.env[key] || ''
}

const supabaseUrl = readEnvValue('NEXT_PUBLIC_SUPABASE_URL')
if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required for synthetic local auth.')
const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
const user = {
  id: 'eval-review-qa-admin', aud: 'authenticated', role: 'authenticated',
  email: 'eval-review-qa@example.test', app_metadata: {}, user_metadata: {},
  created_at: '2026-11-02T00:00:00.000Z',
}
const session = {
  access_token: 'synthetic-local-eval-review-token', refresh_token: 'synthetic-local-refresh-token',
  expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer', user,
}

async function record(browser, name, viewport) {
  const externalAttempts = []
  const mutationAttempts = []
  const context = await browser.newContext({ viewport, recordVideo: { dir: rawDir, size: viewport } })
  await context.addInitScript(({ expectedOrigin, key, activeSession }) => {
    if (location.origin === expectedOrigin) localStorage.setItem(key, JSON.stringify(activeSession))
    // Suppress Portfolio's optional Speed Insights script before it attempts an external load.
    // The QA page remains the exact product route; only analytics is absent in this fixture.
    for (const method of ['appendChild', 'insertBefore']) {
      const original = Node.prototype[method]
      Node.prototype[method] = function (node, ...rest) {
        if (node instanceof HTMLScriptElement && node.src.startsWith('https://va.vercel-scripts.com/')) return node
        return original.call(this, node, ...rest)
      }
    }
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const url = new URL(rawUrl, location.href)
      if (url.pathname.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ user: activeSession.user }), { status: 200, headers: { 'content-type': 'application/json' } })
      if (url.pathname.endsWith('/auth/v1/token')) return new Response(JSON.stringify(activeSession), { status: 200, headers: { 'content-type': 'application/json' } })
      return originalFetch(input, init)
    }
  }, { expectedOrigin: origin, key: storageKey, activeSession: session })
  await context.route('**/*', async intercepted => {
    const request = intercepted.request()
    const url = new URL(request.url())
    if (url.origin !== origin && url.protocol !== 'data:') {
      externalAttempts.push({ method: request.method(), host: url.hostname })
      await intercepted.abort()
      return
    }
    if (!['GET', 'HEAD'].includes(request.method())) {
      mutationAttempts.push({ method: request.method(), path: url.pathname })
      await intercepted.abort()
      return
    }
    if (url.pathname === '/api/user/profile') {
      await intercepted.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ profile: { id: user.id, email: user.email, role: 'admin', created_at: user.created_at, updated_at: user.created_at } }) })
      return
    }
    await intercepted.continue()
  })
  const page = await context.newPage()
  const response = await page.goto(`${baseUrl}${routePath}`, { waitUntil: 'domcontentloaded' })
  if (response?.status() !== 200) throw new Error(`${name}: route returned ${response?.status()}`)
  await expect(page.getByRole('heading', { name: 'Hosted eval source bindings' })).toBeVisible()
  await expect(page.getByText('4 blocked')).toBeVisible()
  await expect(page.getByText(/Current model: 4 evaluations/)).toBeVisible()
  await expect(page.getByText(/Seven-record mixed-model history/)).toBeVisible()
  await expect(page.getByText(/Framework approval does not equal template approval/)).toBeVisible()
  const disclosures = page.locator('details')
  await expect(disclosures).toHaveCount(4)
  const setupScreenshot = path.join(outputDir, `${name}-setup.png`)
  await page.screenshot({ path: setupScreenshot, fullPage: true })
  for (let index = 0; index < 4; index += 1) {
    await disclosures.nth(index).locator('summary').click()
    await expect(disclosures.nth(index)).toHaveAttribute('open', '')
    await page.waitForTimeout(200)
  }
  await expect(page.getByText('73f377361c97ffcf0acc8b228b22624005562248068bc7f40247023642c00e40')).toBeVisible()
  await expect(page.getByText('e9afc7b763a8bd69c63d99ce8b69386444b9acf27bbd12574a646a4177b6efb7')).toBeVisible()
  const controls = await page.locator('main button, main input, main textarea, main form').count()
  if (controls !== 0) throw new Error(`${name}: unexpected mutation controls: ${controls}`)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 2) throw new Error(`${name}: horizontal overflow ${overflow}px`)
  const auditScreenshot = path.join(outputDir, `${name}-audit.png`)
  await page.screenshot({ path: auditScreenshot, fullPage: true })
  await page.waitForTimeout(400)
  const video = page.video()
  await page.close()
  await context.close()
  const webm = await video.path()
  const mp4 = path.join(outputDir, `${name}-walkthrough.mp4`)
  execFileSync('ffmpeg', ['-y', '-i', webm, '-movflags', '+faststart', '-pix_fmt', 'yuv420p', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', mp4], { stdio: 'pipe' })
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', mp4], { encoding: 'utf8' }))
  if (!(Number(probe.format.duration) > 0)) throw new Error(`${name}: MP4 is not playable`)
  if (mutationAttempts.length) throw new Error(`${name}: mutation requests attempted: ${JSON.stringify(mutationAttempts)}`)
  return { name, viewport, route: `${baseUrl}${routePath}`, commit, setupScreenshot, auditScreenshot, mp4, durationSeconds: Number(probe.format.duration), externalAttempts, mutationAttempts, overflow }
}

async function main() {
  fs.mkdirSync(rawDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  let results
  try {
    results = [
      await record(browser, 'desktop', { width: 1440, height: 900 }),
      await record(browser, 'mobile', { width: 390, height: 844 }),
    ]
  } finally {
    await browser.close()
  }
  fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2))
  console.log(JSON.stringify({ outputDir, results }, null, 2))
  if (results.some(result => result.externalAttempts.length)) throw new Error('External requests were attempted and blocked. Inspect the manifest before accepting the capture.')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
