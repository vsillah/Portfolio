import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { chromium, type Page } from 'playwright'
import { defaultAuthStatePath } from './vercel-preview-admin-qa'
import { getVercelAutomationBypassSecretForBaseUrl } from './vercel-validation-env'

const baseUrl = process.argv[2]
if (!baseUrl) throw new Error('Usage: npx tsx scripts/record-practitioner-evidence-authoring-qa.ts <preview-base-url>')

const route = '/admin/agents/content-intelligence?section=research'
const outputDir = join(process.cwd(), 'docs', 'content-intelligence-qa', 'practitioner-evidence-authoring')
const rawDir = join(outputDir, 'raw')
const authState = defaultAuthStatePath(baseUrl)
const bypassSecret = getVercelAutomationBypassSecretForBaseUrl(baseUrl)
if (!bypassSecret) throw new Error('Vercel automation bypass is unavailable for this preview.')

rmSync(rawDir, { recursive: true, force: true })
mkdirSync(rawDir, { recursive: true })

const syntheticEvidence = {
  role: 'Community operations lead',
  situation: 'A recurring handoff was creating avoidable delays for the team.',
  action: 'The practitioner introduced a short evidence review before assignment.',
  outcome: 'The team caught missing context earlier and reduced repeated follow-up.',
  limitations: 'Observed in one bounded workflow; no causal claim is made.',
  redaction: 'Names and unique organizational details were generalized.',
  application: 'Apply the selected structure without using source language or visual identity.',
  revision: 'Added privacy-safe practitioner evidence for review.',
}

async function openResearch(page: Page) {
  await page.goto(new URL(route, baseUrl).toString(), { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle').catch(() => undefined)
  if (!page.url().includes('/admin/agents/content-intelligence?section=research')) {
    throw new Error(`Authenticated preview route was not reached: ${page.url()}`)
  }
  await page.getByRole('button', { name: 'Review packet', exact: true }).first().waitFor({ state: 'visible' })
  const alerts = (await page.locator('[role="alert"]').allTextContents()).map(value => value.trim()).filter(Boolean)
  if (alerts.length) throw new Error(`Preview rendered an alert before QA began: ${alerts.join(' | ')}`)
}

async function recordDesktop() {
  const context = await browser.newContext({
    storageState: authState,
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
    extraHTTPHeaders: {
      'x-vercel-protection-bypass': bypassSecret!,
      'x-vercel-set-bypass-cookie': 'true',
    },
    recordVideo: { dir: rawDir, size: { width: 1440, height: 900 } },
  })
  const page = await context.newPage()
  await openResearch(page)
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: 'Review packet', exact: true }).first().click()
  await page.getByText('Anonymized practitioner evidence', { exact: true }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(900)
  await page.getByLabel('Practitioner role or context').fill(syntheticEvidence.role)
  await page.getByLabel('Situation', { exact: true }).fill(syntheticEvidence.situation)
  await page.getByLabel('Action taken', { exact: true }).fill(syntheticEvidence.action)
  await page.getByLabel('Observed outcome', { exact: true }).fill(syntheticEvidence.outcome)
  await page.getByLabel('Limitations or evidence boundary', { exact: true }).fill(syntheticEvidence.limitations)
  await page.getByLabel(/Public-use boundary/).selectOption('framework_only')
  await page.getByText('Privacy and redaction receipt', { exact: true }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)
  await page.getByText('I removed direct identifiers.', { exact: true }).click()
  await page.getByText('I reviewed indirect identifiers and identifying combinations.', { exact: true }).click()
  await page.getByText('I removed or generalized sensitive details.', { exact: true }).click()
  await page.getByLabel('Redaction receipt note', { exact: true }).fill(syntheticEvidence.redaction)
  await page.getByText('Framework receipt', { exact: true }).scrollIntoViewIfNeeded()
  const frameworkSelect = page.getByLabel(/Selected packet framework/)
  const firstFramework = await frameworkSelect.locator('option:not([value=""])').first().getAttribute('value')
  if (!firstFramework) throw new Error('No framework option was available on the real research packet.')
  await frameworkSelect.selectOption(firstFramework)
  await page.getByLabel('Application note', { exact: true }).fill(syntheticEvidence.application)
  await page.getByText(/I confirm the source is a pattern input/).click()
  await page.getByLabel('Revision note', { exact: true }).fill(syntheticEvidence.revision)
  await page.getByRole('button', { name: 'Save evidence draft', exact: true }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(1400)
  await page.screenshot({ path: join(outputDir, 'desktop-ready-to-save.png'), fullPage: false })
  const video = page.video()
  await context.close()
  if (!video) throw new Error('Desktop recording was not created.')
  return video.path()
}

async function recordMobile() {
  const context = await browser.newContext({
    storageState: authState,
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
    extraHTTPHeaders: {
      'x-vercel-protection-bypass': bypassSecret!,
      'x-vercel-set-bypass-cookie': 'true',
    },
    recordVideo: { dir: rawDir, size: { width: 390, height: 844 } },
  })
  const page = await context.newPage()
  await openResearch(page)
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: 'Review packet', exact: true }).first().click()
  await page.getByText('Anonymized practitioner evidence', { exact: true }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(900)
  await page.getByLabel(/Public-use boundary/).scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)
  await page.getByText('Privacy and redaction receipt', { exact: true }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)
  await page.getByText('Framework receipt', { exact: true }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(1100)
  await page.screenshot({ path: join(outputDir, 'mobile-framework-receipt.png'), fullPage: false })
  const video = page.video()
  await context.close()
  if (!video) throw new Error('Mobile recording was not created.')
  return video.path()
}

async function captureTablet() {
  const context = await browser.newContext({
    storageState: authState,
    viewport: { width: 768, height: 900 },
    reducedMotion: 'reduce',
    extraHTTPHeaders: {
      'x-vercel-protection-bypass': bypassSecret!,
      'x-vercel-set-bypass-cookie': 'true',
    },
  })
  try {
    const page = await context.newPage()
    await openResearch(page)
    await page.getByRole('button', { name: 'Review packet', exact: true }).first().click()
    await page.getByText('Privacy and redaction receipt', { exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: join(outputDir, 'tablet-privacy-review.png'), fullPage: false })
  } finally {
    await context.close()
  }
}

let browser: Awaited<ReturnType<typeof chromium.launch>>

async function main() {
  mkdirSync(outputDir, { recursive: true })
  browser = await chromium.launch({ headless: true })
  let desktopRaw = ''
  let mobileRaw = ''
  try {
    desktopRaw = await recordDesktop()
    await captureTablet()
    mobileRaw = await recordMobile()
  } finally {
    await browser.close()
  }

  const output = join(outputDir, 'practitioner-evidence-authoring-walkthrough.mp4')
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
    viewports: [{ width: 1440, height: 900 }, { width: 768, height: 900 }, { width: 390, height: 844 }],
    packet_source: 'existing public research packet from the authenticated preview',
    synthetic_form_values: true,
    product_writes: 0,
    actions_withheld: ['save evidence draft', 'approve framework', 'reject packet'],
    output: basename(output),
  }, null, 2) + '\n')

  console.log(output)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
