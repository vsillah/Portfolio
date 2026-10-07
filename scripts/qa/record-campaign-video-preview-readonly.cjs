const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { chromium } = require('@playwright/test')
const { getVercelAutomationBypassSecretForBaseUrl } = require(path.join(process.cwd(), 'scripts', 'vercel-validation-env'))

const root = process.env.CAMPAIGN_VIDEO_QA_ROOT || process.cwd()
const baseUrl = process.env.PLAYWRIGHT_BASE_URL
const authState = process.env.PLAYWRIGHT_AUTH_STATE
const itemId = process.env.CAMPAIGN_VIDEO_QA_ITEM_ID || '317a251e-af97-476d-94c2-bac993c1333d'
const commit = process.env.CAMPAIGN_VIDEO_QA_COMMIT || '45be5cc4'
const bypassSecret = getVercelAutomationBypassSecretForBaseUrl(baseUrl, process.cwd())
const outputDir = path.join(root, 'docs', 'social-content', 'qa', 'campaign-video-eligibility', 'staging')
const rawDir = process.env.CAMPAIGN_VIDEO_QA_RAW_DIR || path.join('/tmp', 'portfolio-campaign-video-qa')

if (!baseUrl || !authState) {
  throw new Error('PLAYWRIGHT_BASE_URL and PLAYWRIGHT_AUTH_STATE are required.')
}
if (!fs.existsSync(authState)) {
  throw new Error(`Auth state not found: ${authState}`)
}

fs.mkdirSync(rawDir, { recursive: true })

function convertToMp4(source, destination) {
  execFileSync('ffmpeg', [
    '-y',
    '-i', source,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2',
    destination,
  ], { stdio: 'pipe' })
}

async function addQaLabel(page, viewportLabel) {
  await page.evaluate(({ viewportLabel, commit }) => {
    const label = document.createElement('aside')
    label.id = 'campaign-video-qa-label'
    label.setAttribute('aria-label', 'Read-only QA evidence label')
    label.innerHTML = `<strong>PR #1030 read-only staging QA</strong><span>${viewportLabel} · ${commit}</span><span>No approval, attachment, render, upload, schedule, or publish action.</span>`
    Object.assign(label.style, {
      position: 'fixed',
      zIndex: '2147483647',
      right: '12px',
      bottom: '12px',
      maxWidth: '330px',
      display: 'grid',
      gap: '3px',
      border: '1px solid #64748b',
      borderRadius: '8px',
      padding: '9px 11px',
      background: 'rgba(2, 6, 23, 0.96)',
      color: '#e2e8f0',
      font: '12px/1.35 ui-sans-serif, system-ui, sans-serif',
      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.45)',
    })
    label.querySelector('strong').style.color = '#facc15'
    document.body.appendChild(label)
  }, { viewportLabel, commit })
}

async function recordScenario(browser, scenario) {
  console.log(`[${scenario.slug}] opening authenticated staging route`)
  const providerRequests = []
  const context = await browser.newContext({
    storageState: authState,
    viewport: scenario.viewport,
    recordVideo: { dir: rawDir, size: scenario.viewport },
    ...(bypassSecret ? { extraHTTPHeaders: {
      'x-vercel-protection-bypass': bypassSecret,
      'x-vercel-set-bypass-cookie': 'true',
    } } : {}),
  })
  const page = await context.newPage()
  page.on('request', (request) => {
    const url = request.url()
    if (/heygen|linkedin\.com|graph\.facebook|api\.x\.com|youtube\.googleapis/i.test(url)) {
      providerRequests.push({ method: request.method(), url: new URL(url).origin })
    }
  })

  const route = `/admin/social-content/${itemId}?returnTo=%2Fadmin%2Fsocial-content&deploy=${commit}&step=copy`
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('region', { name: 'Campaign and video review' }).waitFor({ timeout: 30_000 })
  console.log(`[${scenario.slug}] campaign review surface loaded`)
  await addQaLabel(page, scenario.label)

  await page.getByRole('button', { name: 'Review saved video script' }).click()
  await page.getByText('Production quality: blocked').waitFor()
  await page.getByText('This item has no linked campaign calendar review.').waitFor()
  await page.getByText('Rewrite production requirements and stage directions as audience-facing speech.').waitFor()
  await page.getByRole('button', { name: 'Record editorial review · no render' }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Record editorial review · no render' }).isDisabled(), true)
  console.log(`[${scenario.slug}] editorial blockers verified`)

  const panel = page.getByRole('region', { name: 'Campaign and video review' })
  await panel.scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)
  await page.screenshot({ path: path.join(outputDir, `${scenario.slug}-editorial-blocked.png`), fullPage: false })

  await page.getByRole('button', { name: 'Load completed videos' }).click()
  const candidateSelect = page.getByLabel('Choose a completed video')
  await candidateSelect.waitFor()
  const options = await candidateSelect.locator('option').allTextContents()
  const ineligibleIndex = options.findIndex((option) => option.startsWith('Ineligible · history only'))
  assert.ok(ineligibleIndex > 0, 'Expected at least one ineligible history-only video candidate.')
  assert.equal(options.some((option) => option.startsWith('Eligible ·')), false, 'No staging candidate should be presented as eligible for this unlinked item.')
  await candidateSelect.selectOption({ index: ineligibleIndex })
  await page.getByRole('button', { name: 'Preview completed job' }).click()
  await page.getByText('Render status: completed · Ineligible · history only').waitFor()
  await page.getByText('History only: this render is not linked to this campaign, work item, and Social Content item.').waitFor()
  await page.getByText('The video channel does not match the approved campaign channel.').waitFor()
  const attach = page.getByRole('button', { name: 'Attach this video · reset media approval' })
  assert.equal(await attach.isDisabled(), true)
  console.log(`[${scenario.slug}] history-only candidate and disabled attachment verified`)
  await attach.scrollIntoViewIfNeeded()
  await page.waitForTimeout(900)
  await page.screenshot({ path: path.join(outputDir, `${scenario.slug}-history-only.png`), fullPage: false })

  assert.deepEqual(providerRequests, [])
  const video = page.video()
  await page.close()
  await context.close()
  const rawVideo = await video.path()
  const rawStats = fs.statSync(rawVideo)
  assert.ok(rawStats.size > 0, `Playwright produced an empty video: ${rawVideo}`)
  const mp4 = path.join(outputDir, `${scenario.slug}-walkthrough.mp4`)
  convertToMp4(rawVideo, mp4)
  console.log(`[${scenario.slug}] wrote ${path.relative(root, mp4)}`)

  return {
    viewport: scenario.viewport,
    route,
    assertions: {
      production_quality: 'blocked',
      campaign_linkage: 'missing',
      candidate_label: 'Ineligible · history only',
      attachment_enabled: false,
      provider_requests: providerRequests,
    },
    screenshots: [
      `${scenario.slug}-editorial-blocked.png`,
      `${scenario.slug}-history-only.png`,
    ],
    video: `${scenario.slug}-walkthrough.mp4`,
  }
}

async function main() {
  const browser = await chromium.launch()
  try {
    const results = []
    const scenarios = [{
      slug: '1440-staging',
      label: 'Desktop 1440 × 900',
      viewport: { width: 1440, height: 900 },
    }, {
      slug: '768-staging',
      label: 'Tablet 768 × 1024',
      viewport: { width: 768, height: 1024 },
    }, {
      slug: '390-staging',
      label: 'Mobile 390 × 844',
      viewport: { width: 390, height: 844 },
    }]
    const selected = process.env.CAMPAIGN_VIDEO_QA_SCENARIO
      ? scenarios.filter((scenario) => scenario.slug === process.env.CAMPAIGN_VIDEO_QA_SCENARIO)
      : scenarios
    assert.ok(selected.length > 0, 'CAMPAIGN_VIDEO_QA_SCENARIO did not match a known scenario.')
    for (const scenario of selected) results.push(await recordScenario(browser, scenario))
    const resultsPath = path.join(outputDir, 'results.json')
    const previous = fs.existsSync(resultsPath) ? JSON.parse(fs.readFileSync(resultsPath, 'utf8')) : null
    const priorResults = Array.isArray(previous?.results) ? previous.results : []
    const mergedResults = [
      ...priorResults.filter((prior) => !results.some((current) => current.video === prior.video)),
      ...results,
    ]
    fs.writeFileSync(resultsPath, `${JSON.stringify({
      captured_at: new Date().toISOString(),
      source: 'authenticated_pr_preview',
      base_url: baseUrl,
      item_id: itemId,
      commit,
      mutations: 0,
      provider_calls: 0,
      results: mergedResults,
    }, null, 2)}\n`)
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
