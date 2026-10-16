import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { chromium, type Browser, type Page } from 'playwright'

const baseUrl = process.argv[2] ?? 'http://localhost:3000'
const authState = process.env.QA_AUTH_STATE ?? join(process.cwd(), '.auth', 'portfolio-admin-storage-state.json')
if (!existsSync(authState)) throw new Error(`QA auth state is unavailable: ${authState}`)

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const packetId = '407df879-a539-40a1-a20e-75de31b9c494'
const route = `/admin/agents/content-intelligence?section=research&packet=${packetId}&qa=framework-only-public-trend-${commit.slice(0, 8)}`
const outputDir = join(process.cwd(), 'docs', 'content-intelligence-qa', 'framework-only-public-trend')
const rawDir = join(outputDir, 'raw')
const campaignTitle = 'Campaign proposal: Stop counting AI licenses'
const applicationNote = 'Use the approved public trend as a decision framework without copying source language, claims, title, thumbnail, script, or visual identity.'
const revisionNote = 'Bound approved public trend evidence to the framework-only path.'
const packets = [
  {
    id: packetId,
    status: 'review_ready',
    updated_at: '2026-10-16T00:30:56.099Z',
    pattern_status: 'needs_brand_translation',
    source_url: 'https://www.youtube.com/watch?v=C4m8LS2Jzqs',
    platform: 'youtube',
    creator_name: 'Cloud & AI Hub',
    creator_handle: null,
    title: campaignTitle,
    caption: 'Review-only campaign evidence packet.',
    thumbnail_url: null,
    hook_transcript: 'AI adoption should be measured by operating decisions and outcomes, not license counts.',
    outlier_score: 64,
    retrieved_at: '2026-10-16T00:30:56.099Z',
    privacy_notes: 'Approved public-summary evidence only. No private conversation, transcript, or practitioner anecdote.',
    actor_metadata: { provenance: 'approved_public_summary', review_only: true },
    pattern_packet: {
      decision_framework: 'Move from adoption counts to governed operating evidence.',
      audience_tension: 'Executives can see licenses purchased but not whether decisions improved.',
      originality_boundary: 'Use the public trend as evidence; create original AmaduTown framing and examples.',
    },
    metrics: { views: 0, likes: 0, comments: 0 },
  },
]

rmSync(rawDir, { recursive: true, force: true })
mkdirSync(rawDir, { recursive: true })

async function openPacket(page: Page) {
  await page.route('**/api/admin/social-content/intelligence/research-packets?**', route => route.fulfill({ json: { packets } }))
  await page.goto(new URL(route, baseUrl).toString(), { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle').catch(() => undefined)
  if (!page.url().includes('/admin/agents/content-intelligence?section=research')) {
    throw new Error(`Authenticated Content Intelligence route was not reached: ${page.url()}`)
  }
  const reviewButton = page.getByRole('button', { name: 'Review packet', exact: true })
  await reviewButton.waitFor({ state: 'visible', timeout: 15_000 })
  await reviewButton.click()
  await page.getByLabel('Public-use boundary').selectOption('framework_only')
  await page.getByText(/No practitioner anecdote is collected or included/).waitFor({ state: 'visible' })
  if (await page.getByLabel('Practitioner role or context').count()) throw new Error('Framework-only mode still exposes practitioner fields.')
  if (await page.getByText('Privacy and redaction receipt', { exact: true }).count()) throw new Error('Framework-only mode still exposes redaction inputs.')

  const frameworkSelect = page.getByLabel('Selected packet framework')
  const firstFramework = await frameworkSelect.locator('option:not([value=""])').first().getAttribute('value')
  if (!firstFramework) throw new Error('No packet framework is available for review.')
  await frameworkSelect.selectOption(firstFramework)
  await page.getByLabel('Application note').fill(applicationNote)
  await page.getByText(/I confirm the source is a pattern input/).click()
  await page.getByLabel('Revision note').fill(revisionNote)
  await page.getByText('Framework receipt', { exact: true }).click()

  const blockers = await page.getByRole('status').allTextContents()
  const blockerText = blockers.join(' ')
  if (/practitioner role|anonymized situation|redaction receipt|direct identifiers/i.test(blockerText)) {
    throw new Error(`Framework-only mode retained fabricated practitioner blockers: ${blockerText}`)
  }
  if (!/usable framework/i.test(blockerText)) {
    throw new Error('The independent usable-framework approval gate is no longer visible.')
  }
  const saveButton = page.getByRole('button', { name: 'Save evidence draft', exact: true })
  if (!(await saveButton.isEnabled())) throw new Error('The completed framework-only receipt is not ready to save.')
  const approveButton = page.getByRole('button', { name: 'Approve framework', exact: true })
  if (await approveButton.isEnabled()) throw new Error('Approval became available before the usable-framework gate passed.')
}

async function capture(browser: Browser, label: string, viewport: { width: number; height: number }) {
  const context = await browser.newContext({
    storageState: authState,
    viewport,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    recordVideo: { dir: join(rawDir, label), size: viewport },
  })
  const page = await context.newPage()
  const writes: string[] = []
  page.on('request', request => {
    if (/\.supabase\.co\/auth\/v1\//i.test(request.url())) return
    if (request.method() !== 'GET' && request.method() !== 'HEAD' && request.method() !== 'OPTIONS') {
      writes.push(`${request.method()} ${request.url()}`)
    }
  })
  await openPacket(page)
  const boundary = page.getByText(/Public framework path:/)
  await boundary.scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)
  const screenshot = join(outputDir, `${label}.png`)
  await page.screenshot({ path: screenshot, fullPage: false })
  await page.getByText('Framework receipt', { exact: true }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(900)
  await page.getByText('Approval blocked until:', { exact: true }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(1100)
  if (writes.length) throw new Error(`QA caused an unexpected write request: ${writes.join(' | ')}`)
  const video = page.video()
  await context.close()
  if (!video) throw new Error(`No ${label} video was recorded.`)
  return { screenshot, video: await video.path() }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const desktop = await capture(browser, 'desktop-1440x900', { width: 1440, height: 900 })
    const mobile = await capture(browser, 'mobile-390x844', { width: 390, height: 844 })
    const output = join(outputDir, 'framework-only-public-trend-walkthrough.mp4')
    execFileSync('ffmpeg', [
      '-y', '-i', desktop.video, '-i', mobile.video,
      '-filter_complex',
      '[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x080b12,setsar=1[d];[1:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x080b12,setsar=1[m];[d][m]concat=n=2:v=1:a=0[out]',
      '-map', '[out]', '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output,
    ], { stdio: 'ignore' })
    writeFileSync(join(outputDir, 'results.json'), JSON.stringify({
      generated_at: new Date().toISOString(), commit, base_url: baseUrl, route,
      packet: campaignTitle,
      viewports: [{ width: 1440, height: 900 }, { width: 390, height: 844 }],
      product_writes: 0,
      verified: ['framework-only explanation', 'practitioner fields absent', 'redaction inputs absent', 'source originality receipt required', 'usable-framework gate preserved'],
      actions_withheld: ['save evidence draft', 'approve framework', 'reject packet'],
      screenshots: [basename(desktop.screenshot), basename(mobile.screenshot)],
      output: basename(output),
    }, null, 2) + '\n')
    console.log(output)
  } finally {
    await browser.close()
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
