import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { chromium, type Page } from 'playwright'
import { getVercelAutomationBypassSecretForBaseUrl } from './vercel-validation-env'

const baseUrl = process.argv[2]
if (!baseUrl) {
  throw new Error('Usage: npx tsx scripts/record-social-visual-source-trace-qa.ts <preview-base-url>')
}

const route = '/admin/social-content/deterministic-visual-binding-qa?step=visuals&qa=visual-source-trace-129073e7&qa_state=lineage_missing#social-visual-assets-gate'
const outputDir = join(process.cwd(), 'docs', 'qa', 'social-visual-source-trace')
const rawDir = join(outputDir, 'raw')
const bypassSecret = getVercelAutomationBypassSecretForBaseUrl(baseUrl)
const authStorageKey = 'sb-byoriebhtbysanjhimlu-auth-token'
const syntheticUser = {
  id: '00000000-0000-4000-8000-000000000099',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'qa-fixture@amadutown.invalid',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Synthetic QA Operator' },
  created_at: '2026-10-11T00:00:00.000Z',
}
const syntheticJwt = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: syntheticUser.id,
    email: syntheticUser.email,
    role: 'authenticated',
  })).toString('base64url'),
  'synthetic-signature',
].join('.')
const syntheticSession = {
  access_token: syntheticJwt,
  refresh_token: 'synthetic-fixture-refresh',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: syntheticUser,
  weak_password: null,
}

rmSync(rawDir, { recursive: true, force: true })
mkdirSync(rawDir, { recursive: true })

async function openTrace(page: Page) {
  await page.goto(new URL(route, baseUrl).toString(), { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle').catch(() => undefined)
  if (!page.url().includes('/admin/social-content/deterministic-visual-binding-qa')) {
    throw new Error(`Authenticated source-trace route was not reached: ${page.url()}`)
  }
  await page.getByText('Trace this visual', { exact: true }).waitFor({ state: 'visible' })
  await page.getByText(/customer-facing visual fields lack approved source proof/i).waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Approve Visuals' }).waitFor({ state: 'visible' })
  if (await page.getByRole('button', { name: 'Approve Visuals' }).isEnabled()) {
    throw new Error('Approve Visuals must remain disabled while source proof is blocked.')
  }
}

async function record(width: number, height: number, name: string) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: 'reduce',
    extraHTTPHeaders: bypassSecret ? {
      'x-vercel-protection-bypass': bypassSecret,
      'x-vercel-set-bypass-cookie': 'true',
    } : undefined,
    recordVideo: { dir: rawDir, size: { width, height } },
  })
  await context.addInitScript(({ key, session }) => {
    window.localStorage.setItem(key, JSON.stringify(session))
  }, { key: authStorageKey, session: syntheticSession })
  const page = await context.newPage()
  await page.route('**/auth/v1/user', async (request) => {
    await request.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(syntheticUser) })
  })
  await page.route('**/api/user/profile**', async (request) => {
    await request.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ profile: { id: syntheticUser.id, email: syntheticUser.email, role: 'admin' } }),
    })
  })
  await openTrace(page)
  await page.getByRole('button', { name: 'Trace Headline' }).click()
  await page.waitForTimeout(1100)
  await page.getByRole('button', { name: /Blocked 3\. Evidence 1/ }).click()
  await page.waitForTimeout(1100)
  await page.getByRole('button', { name: /Verified 10\. result label/ }).click()
  await page.waitForTimeout(1100)
  await page.getByRole('button', { name: /Blocked 11\. Bounded result text/ }).click()
  await page.waitForTimeout(1400)
  await page.screenshot({ path: join(outputDir, `${name}.png`), fullPage: false })
  const video = page.video()
  await context.close()
  if (!video) throw new Error(`${name} recording was not created.`)
  return video.path()
}

let browser: Awaited<ReturnType<typeof chromium.launch>>

async function main() {
  mkdirSync(outputDir, { recursive: true })
  browser = await chromium.launch({ headless: true })
  let desktopRaw = ''
  let mobileRaw = ''
  try {
    desktopRaw = await record(1440, 900, 'desktop-source-trace')
    mobileRaw = await record(390, 844, 'mobile-source-trace')
  } finally {
    await browser.close()
  }

  const output = join(outputDir, 'social-visual-source-trace-walkthrough.mp4')
  execFileSync('ffmpeg', [
    '-y',
    '-i', desktopRaw,
    '-i', mobileRaw,
    '-filter_complex',
    '[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x080b12,setsar=1[d];[1:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x080b12,setsar=1[m];[d][m]concat=n=2:v=1:a=0[out]',
    '-map', '[out]',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '22',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    output,
  ], { stdio: 'ignore' })

  writeFileSync(join(outputDir, 'results.json'), JSON.stringify({
    generated_at: new Date().toISOString(),
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    base_url: baseUrl,
    route,
    viewports: [{ width: 1440, height: 900 }, { width: 390, height: 844 }],
    record: 'deterministic-visual-binding-qa',
    data_scope: 'privacy-safe synthetic production-equivalent fixture',
    writes: 0,
    actions_withheld: ['render visual', 'approve visuals', 'reject visuals', 'publish', 'schedule', 'provider calls'],
    output: basename(output),
  }, null, 2) + '\n')

  console.log(output)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
