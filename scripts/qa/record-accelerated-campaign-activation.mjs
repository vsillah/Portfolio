import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import calendarPreparationModule from '../../lib/social-calendar-preparation.ts'
import activationModule from '../../lib/accelerated-campaign-activation.ts'

const { projectSocialCalendarPreparation } = calendarPreparationModule
const { evaluateAcceleratedActivation, ACCELERATED_ACTIVATION_SCOPE, ACCELERATED_CAMPAIGN_ID } = activationModule

config({ path: '.env.local', quiet: true })

const baseUrl = process.env.QA_BASE_URL || 'http://localhost:4271'
const outputDir = join(process.cwd(), 'docs', 'qa', 'accelerated-campaign-activation')
const rawDir = join(outputDir, 'raw')
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const records = [
  { id: '20d09867-24ce-4849-b03d-f877d7114d6a', calendarId: '796d6523-d600-45cf-96bb-541058af5817', label: 'Nov 18 LinkedIn', kind: 'single_image', frames: 1 },
  { id: 'd0046271-92ba-4c7f-a009-197b44562f48', calendarId: 'af8ed285-69f4-4036-8201-1aa66827bb48', label: 'Nov 19 X', kind: 'text_only', frames: 0 },
  { id: '9499ecbf-0349-472a-9b12-b6d987d1939d', calendarId: '07fa29e5-40dc-4b86-9871-a49be6349613', label: 'Nov 20 LinkedIn', kind: 'carousel', frames: 8 },
  { id: '34471e82-2cb4-4e06-b3ec-d48f9739bb0f', calendarId: 'fc23411f-f756-4ed8-8e5b-40ff26cf144e', label: 'Nov 20 Instagram', kind: 'carousel', frames: 8 },
]

if (!process.env.PROD_SUPABASE_URL || !process.env.PROD_SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Read-only production-row QA connection is unavailable.')
}

const production = createClient(process.env.PROD_SUPABASE_URL, process.env.PROD_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function loadRows() {
  const rows = new Map()
  const activations = new Map()
  for (const record of records) {
    const [{ data: item, error: itemError }, { data: calendar, error: calendarError }, { data: publishes, error: publishesError }, { data: config, error: configError }] = await Promise.all([
      production.from('social_content_queue').select('*').eq('id', record.id).single(),
      production.from('social_content_calendar_items').select('*').eq('id', record.calendarId).single(),
      production.from('social_content_publishes').select('*').eq('content_id', record.id),
      production.from('social_content_config').select('*').eq('platform', record.label.endsWith('X') ? 'x' : record.label.endsWith('Instagram') ? 'instagram' : 'linkedin').single(),
    ])
    if (itemError || calendarError || publishesError || configError || !item || !calendar || !config) throw new Error(`Production review row unavailable: ${record.label}`)
    if (item.status !== 'draft' || item.rag_context?.external_execution_enabled !== false) {
      throw new Error(`Campaign execution lock changed: ${record.label}`)
    }
    rows.set(record.id, {
      ...item,
      calendar_preparation: projectSocialCalendarPreparation(calendar, record.id),
      publishes: [],
    })
    const activation = await evaluateAcceleratedActivation({ id: record.id, item, calendar, publishes: publishes ?? [], config })
    activations.set(record.id, { ...activation, ready: false, blockers: [...activation.blockers, 'Campaign activation is disabled in this deployment.'], scope: ACCELERATED_ACTIVATION_SCOPE, campaignId: ACCELERATED_CAMPAIGN_ID })
  }
  return { rows, activations }
}

async function authenticatedState(browser) {
  const context = await browser.newContext()
  try {
    const page = await context.newPage()
    await page.goto(`${baseUrl}/admin/social-content`, { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/auth\/login/, { timeout: 20_000 })
    if (new URL(page.url()).pathname === '/auth/login') {
      if (!process.env.ADMIN_E2E_EMAIL || !process.env.ADMIN_E2E_PASSWORD) throw new Error('Local admin QA login is unavailable.')
      await page.getByLabel('Email').fill(process.env.ADMIN_E2E_EMAIL)
      await page.getByLabel('Password').fill(process.env.ADMIN_E2E_PASSWORD)
      await page.getByRole('button', { name: 'Sign In' }).click()
      await page.waitForURL(/\/admin\/social-content(?:\?|$)/, { timeout: 20_000 })
    }
    if (new URL(page.url()).pathname !== '/admin/social-content') throw new Error('Local admin QA sign-in did not reach Social Content.')
    return await context.storageState()
  } finally { await context.close() }
}

async function capture(browser, storageState, rows, activations, label, viewport) {
  const context = await browser.newContext({
    storageState,
    viewport,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    recordVideo: { dir: rawDir, size: viewport },
  })
  const page = await context.newPage()
  const productWrites = []
  page.on('request', request => {
    const url = request.url()
    if (!url.startsWith(baseUrl)) return
    if (/\/auth\/v1\//.test(url)) return
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) productWrites.push(`${request.method()} ${new URL(url).pathname}`)
  })
  await page.route(/\/api\/admin\/social-content\/([0-9a-f-]{36})(?:\?.*)?$/, async route => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1)
    if (!rows.has(id)) return route.continue()
    if (route.request().method() !== 'GET') return route.fulfill({ status: 409, json: { error: 'Read-only QA projection', blocked: true } })
    return route.fulfill({ status: 200, json: { item: rows.get(id), fixture: false, fixture_state: 'production_row_read_only_qa' } })
  })
  await page.route(/\/api\/admin\/social-content\/([0-9a-f-]{36})\/accelerated-activation(?:\?.*)?$/, async route => {
    const id = new URL(route.request().url()).pathname.split('/').at(-2)
    if (!activations.has(id)) return route.continue()
    if (route.request().method() !== 'GET') return route.fulfill({ status: 409, json: { error: 'Read-only QA projection', blocked: true } })
    return route.fulfill({ status: 200, json: activations.get(id) })
  })

  const results = []
  for (const record of records) {
    const url = `${baseUrl}/admin/social-content/${record.id}?step=copy&rev=${commit.slice(0, 10)}`
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    const panel = page.getByRole('region', { name: 'Accelerated campaign review' })
    await panel.waitFor({ state: 'visible', timeout: 20_000 }).catch(async () => {
      await page.screenshot({ path: join(rawDir, 'debug-panel-unavailable.png') })
      throw new Error(`Campaign panel unavailable at ${page.url()}`)
    })
    if (page.url() !== url) throw new Error(`Exact QA route changed: ${record.label}`)
    if (await page.getByText(/practitioner-content blocker|practitioner evidence packet/i).count()) {
      throw new Error(`Practitioner gate appeared: ${record.label}`)
    }
    if (!(await panel.getByText('Internal packet ready for Human QA').isVisible())) {
      await panel.getByText('Internal packet ready for Human QA').waitFor({ state: 'visible', timeout: 20_000 })
    }
    const images = panel.getByRole('img')
    if (await images.count() !== record.frames) throw new Error(`Approved frame count mismatch: ${record.label}`)
    if (record.kind === 'text_only' && !(await panel.getByText(/Intentional text-only treatment/).isVisible())) {
      throw new Error('Intentional text-only treatment is missing.')
    }
    if (!(await panel.getByText(/External actions remain locked/).isVisible())) throw new Error(`External lock missing: ${record.label}`)
    if (await panel.getByText(/Approved visual binding is unavailable/).count()) throw new Error(`Approved visual unavailable: ${record.label}`)
    if (!(await panel.getByText(/Approved CTA:.*https:\/\/amadutown\.com\/accelerated/).isVisible())) throw new Error(`Approved CTA missing: ${record.label}`)
    if (!(await panel.getByText(/JIT packet SHA-256:/).isVisible())) throw new Error(`JIT receipt missing: ${record.label}`)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    if (overflow) throw new Error(`Horizontal overflow at ${viewport.width}px: ${record.label}`)
    const externalButtons = await page.getByRole('button').evaluateAll(buttons => buttons
      .filter(button => /^(save draft|upload|schedule|publish|post now|provider generation|send outreach|approve & (publish|schedule))\b/i.test((button.textContent || '').trim()))
      .filter(button => button.getClientRects().length > 0)
      .map(button => ({ label: (button.textContent || '').trim().replace(/\s+/g, ' '), enabled: !button.hasAttribute('disabled') })))
    if (externalButtons.some(button => button.enabled)) throw new Error(`External action enabled: ${record.label}: ${JSON.stringify(externalButtons)}`)
    await panel.scrollIntoViewIfNeeded()
    await page.mouse.wheel(0, -650)
    await page.waitForTimeout(700)
    const overviewScreenshot = join(outputDir, `${label}-${record.id}-overview.png`)
    await page.screenshot({ path: overviewScreenshot })
    let assetScreenshot = null
    if (record.frames) {
      for (let index = 0; index < record.frames; index++) {
        await images.nth(index).scrollIntoViewIfNeeded()
        await page.waitForTimeout(record.kind === 'carousel' ? 220 : 650)
        if (index === 0) {
          assetScreenshot = join(outputDir, `${label}-${record.id}-asset.png`)
          await page.screenshot({ path: assetScreenshot })
        }
      }
    }
    const activationPanel = page.getByRole('region', { name: 'Accelerated campaign activation' })
    await activationPanel.scrollIntoViewIfNeeded()
    await activationPanel.getByText(/A verified \$0, no-spend execution path is unavailable/).waitFor()
    if (await activationPanel.getByRole('button', { name: 'Schedule approved record' }).isEnabled()) throw new Error(`Schedule unexpectedly enabled: ${record.label}`)
    await page.waitForTimeout(650)
    const activationScreenshot = join(outputDir, `${label}-${record.id}-activation.png`)
    await page.screenshot({ path: activationScreenshot })
    results.push({ label: record.label, url, frames: record.frames, overviewScreenshot: overviewScreenshot.split('/').at(-1), assetScreenshot: assetScreenshot?.split('/').at(-1) ?? null, activationScreenshot: activationScreenshot.split('/').at(-1), horizontalOverflow: false, enabledExternalActions: 0, activationBlockers: activations.get(record.id).blockers })
  }

  if (productWrites.length) throw new Error(`Product write requests observed: ${productWrites.join(', ')}`)
  const video = page.video()
  await context.close()
  if (!video) throw new Error(`${label} recording missing.`)
  return { results, rawVideo: await video.path(), productWrites: 0 }
}

async function main() {
  mkdirSync(outputDir, { recursive: true })
  mkdirSync(rawDir, { recursive: true })
  const { rows, activations } = await loadRows()
  const browser = await chromium.launch({ headless: true })
  try {
    const storageState = await authenticatedState(browser)
    const runs = []
    for (const [label, viewport] of [
      ['desktop-1440x900', { width: 1440, height: 900 }],
      ['mobile-390x844', { width: 390, height: 844 }],
    ]) {
      const run = await capture(browser, storageState, rows, activations, label, viewport)
      const mp4 = join(outputDir, `${label}.mp4`)
      execFileSync('ffmpeg', ['-y', '-i', run.rawVideo, '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { stdio: 'ignore' })
      runs.push({ viewport, video: mp4.split('/').at(-1), productWrites: run.productWrites, routes: run.results })
    }
    writeFileSync(join(outputDir, 'receipt.json'), JSON.stringify({
      generated_at: new Date().toISOString(), commit, base_url: baseUrl,
      source: 'read-only projection from exact persisted production Social Content, linked calendar, publish receipts, and channel configuration',
      authorization: 'localhost admin storage state; no credential value persisted in receipt',
      campaign_status: 'draft',
      runs,
    }, null, 2) + '\n')
    console.log(JSON.stringify({ receipt: join(outputDir, 'receipt.json'), runs: runs.map(run => ({ viewport: run.viewport, video: run.video, routes: run.routes.map(route => ({ label: route.label, frames: route.frames })) })) }))
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1) })
