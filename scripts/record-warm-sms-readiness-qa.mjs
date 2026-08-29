import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { config as loadEnv } from 'dotenv'

const execFileAsync = promisify(execFile)
const root = process.cwd()
loadEnv({ path: path.join(root, '.env.local'), quiet: true })
const outputDir = path.join(root, 'docs', 'warm-outreach-qa')
const qaDir = path.join(root, 'test-results', 'warm-sms-provider-readiness-qa')
const sourceDir = path.join(qaDir, 'source')
const compositeDir = path.join(qaDir, 'composite')
const baseUrl = (process.env.QA_BASE_URL || 'http://127.0.0.1:3027').replace(/\/$/, '')
const contactId = 42
const qaPath = `/admin/outreach?tab=leads&filter=warm&id=${contactId}&contactId=${contactId}&qa=warm-slack-send-approval#warm-sms-readiness`
const qaUrl = new URL(qaPath, baseUrl).toString()
const mp4Path = path.join(outputDir, 'warm-sms-provider-readiness-qa.mp4')
const receiptPath = path.join(outputDir, 'warm-sms-provider-readiness-qa.json')

await mkdir(outputDir, { recursive: true })
await mkdir(sourceDir, { recursive: true })
await mkdir(compositeDir, { recursive: true })

const user = {
  id: 'warm-sms-readiness-qa-admin',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'warm-sms-readiness-qa@example.test',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-08-29T00:00:00.000Z',
}

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

const now = Math.floor(Date.now() / 1000)
const session = {
  access_token: [
    base64Url({ alg: 'none', typ: 'JWT' }),
    base64Url({
      aud: 'authenticated',
      exp: now + 3600,
      iat: now,
      sub: user.id,
      email: user.email,
      role: 'authenticated',
    }),
    'qa-signature',
  ].join('.'),
  refresh_token: 'qa-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: now + 3600,
  user,
}

function authStorageKeys() {
  const urls = [process.env.NEXT_PUBLIC_SUPABASE_URL, 'http://localhost:54321'].filter(Boolean)
  return [...new Set(['sb-127-auth-token', ...urls.map((value) => {
    try {
      return `sb-${new URL(value).hostname.split('.')[0]}-auth-token`
    } catch {
      return null
    }
  }).filter(Boolean)])]
}

async function seedSession(page) {
  await page.addInitScript(({ keys, storedSession }) => {
    for (const key of keys) window.localStorage.setItem(key, JSON.stringify(storedSession))
  }, { keys: authStorageKeys(), storedSession: session })
}

async function installSafeRoutes(page) {
  await page.route('https://va.vercel-scripts.com/**', (route) => route.abort())
  await page.route('**/api/user/profile**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ profile: { ...user, role: 'admin', updated_at: user.created_at } }),
  }))
  await page.route('**/auth/v1/user**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(user),
  }))
  await page.route('**/api/admin/meetings**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ meetings: [], total: 0 }),
  }))
  await page.route('**/api/admin/value-evidence/workflow-status**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ runs: [] }),
  }))
}

function collectUnexpectedRequests(page) {
  const requests = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    const blockedLocalPath =
      /\/api\/admin\/outreach\/[^/]+\/(?:slack-send-approval|gmail-user-draft|gmail-user-send|gmail-draft-canary)\b/i.test(url.pathname) ||
      /\/api\/admin\/outreach\/gmail-response-import\b/i.test(url.pathname) ||
      /\/api\/admin\/outreach\/[^/]+\/(?:sms|text|provider-send|manual-send)\b/i.test(url.pathname)
    const blockedHost = /slack\.com|gmail\.com|googleapis\.com|twilio\.com|telnyx\.com|messagebird\.com|linkedin\.com|facebook\.com|n8n/i.test(url.hostname)
    if (blockedHost || blockedLocalPath) requests.push(request.url())
  })
  return requests
}

async function openQaPage(browser, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
  const page = await context.newPage()
  await seedSession(page)
  await installSafeRoutes(page)
  const unexpectedRequests = collectUnexpectedRequests(page)
  const response = await page.goto(qaUrl, { waitUntil: 'networkidle' })
  if (response && response.status() >= 400) {
    throw new Error(`QA route returned HTTP ${response.status()}: ${qaUrl}`)
  }
  if (!page.url().startsWith(baseUrl)) {
    throw new Error(`QA route left the expected local Portfolio host: ${page.url()}`)
  }
  const overlay = await page.locator('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay').count()
  if (overlay > 0) throw new Error('Framework error overlay is visible on the QA route.')
  await page.locator('#warm-sms-readiness').waitFor({ timeout: 15_000 })
  await page.locator('#warm-sms-provider-readiness').waitFor({ timeout: 15_000 })
  return { context, page, unexpectedRequests }
}

async function viewportEvidence(browser, name, viewport) {
  const qa = await openQaPage(browser, viewport)
  await qa.page.locator('#warm-sms-readiness').scrollIntoViewIfNeeded()
  const contentChecks = await qa.page.evaluate(() => ({
    hasSmsReadiness: /Warm SMS manual readiness/i.test(document.body.innerText),
    hasManualBoundary: /No SMS provider/i.test(document.body.innerText),
    hasApprovalCopy: /Approval records manual.?send readiness only/i.test(document.body.innerText),
    hasManualLoop: /Manual SMS operating loop/i.test(document.body.innerText),
    hasEvidenceCapture: /Manual send evidence/i.test(document.body.innerText),
    hasResponseOutcome: /Manual response outcome/i.test(document.body.innerText),
    hasProviderReadiness: /Warm SMS provider readiness/i.test(document.body.innerText),
    hasProviderDisabled: /SMS provider configured but disabled/i.test(document.body.innerText),
    hasConsentAudit: /Consent audit:/i.test(document.body.innerText),
    hasFutureSendBoundary: /Generic [“\"]proceed[”\"] is not send authority/i.test(document.body.innerText),
    hasManualSeparation: /manual SMS loop below remains a separate local workflow/i.test(document.body.innerText),
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  const smsDraftTextareaStyles = await qa.page.getByLabel('Warm SMS draft text').evaluate((element) => {
    const style = window.getComputedStyle(element)
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
      borderColor: style.borderColor,
      colorScheme: style.colorScheme,
      caretColor: style.caretColor,
      placeholderColor: window.getComputedStyle(element, '::placeholder').color,
    }
  })
  const operatorNoteTextareaStyles = await qa.page.getByLabel('Operator note').evaluate((element) => {
    const style = window.getComputedStyle(element)
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
      borderColor: style.borderColor,
      colorScheme: style.colorScheme,
      caretColor: style.caretColor,
      placeholderColor: window.getComputedStyle(element, '::placeholder').color,
    }
  })
  const responseOutcomeSelectStyles = await qa.page.getByLabel('Manual SMS response outcome').evaluate((element) => {
    const style = window.getComputedStyle(element)
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
      borderColor: style.borderColor,
      colorScheme: style.colorScheme,
      caretColor: style.caretColor,
    }
  })
  const inputUsesDarkMode = (styles) => (
    styles.colorScheme === 'dark' &&
    styles.backgroundColor !== 'rgb(255, 255, 255)' &&
    styles.color !== 'rgb(0, 0, 0)' &&
    styles.borderColor !== 'rgb(255, 255, 255)'
  )
  const screenshotPath = path.join(outputDir, `warm-sms-provider-readiness-${name}.png`)
  await qa.page.screenshot({ path: screenshotPath, fullPage: true })
  await qa.context.close()
  return {
    name,
    viewport,
    screenshotPath,
    hasSmsReadiness: contentChecks.hasSmsReadiness,
    hasManualBoundary: contentChecks.hasManualBoundary,
    hasApprovalCopy: contentChecks.hasApprovalCopy,
    hasManualLoop: contentChecks.hasManualLoop,
    hasEvidenceCapture: contentChecks.hasEvidenceCapture,
    hasResponseOutcome: contentChecks.hasResponseOutcome,
    hasProviderReadiness: contentChecks.hasProviderReadiness,
    hasProviderDisabled: contentChecks.hasProviderDisabled,
    hasConsentAudit: contentChecks.hasConsentAudit,
    hasFutureSendBoundary: contentChecks.hasFutureSendBoundary,
    hasManualSeparation: contentChecks.hasManualSeparation,
    horizontalOverflow: contentChecks.scrollWidth > contentChecks.clientWidth,
    inputStyles: {
      smsDraftTextarea: smsDraftTextareaStyles,
      operatorNoteTextarea: operatorNoteTextareaStyles,
      responseOutcomeSelect: responseOutcomeSelectStyles,
    },
    textareaStyles: smsDraftTextareaStyles,
    textareaUsesDarkMode: inputUsesDarkMode(smsDraftTextareaStyles),
    operatorNoteUsesDarkMode: inputUsesDarkMode(operatorNoteTextareaStyles),
    responseOutcomeUsesDarkMode: inputUsesDarkMode(responseOutcomeSelectStyles),
    allManualInputsUseDarkMode:
      inputUsesDarkMode(smsDraftTextareaStyles) &&
      inputUsesDarkMode(operatorNoteTextareaStyles) &&
      inputUsesDarkMode(responseOutcomeSelectStyles),
    unexpectedRequests: qa.unexpectedRequests,
  }
}

async function smsFrame(browser, fileName, focusSelector, action) {
  const qa = await openQaPage(browser, { width: 390, height: 844 })
  const card = qa.page.locator('#warm-sms-readiness')
  if (action) await action(card)
  const focus = qa.page.locator(focusSelector)
  await focus.scrollIntoViewIfNeeded()
  const screenshotPath = path.join(sourceDir, fileName)
  await focus.screenshot({ path: screenshotPath })
  await qa.context.close()
  return { screenshotPath, unexpectedRequests: qa.unexpectedRequests }
}

const browser = await chromium.launch()
const frameResults = []
frameResults.push(await smsFrame(browser, '01-provider-disabled.png', '#warm-sms-provider-readiness', null))
frameResults.push(await smsFrame(browser, '02-sms-approved-copy.png', '#warm-sms-manual-decision', async (card) => {
  await card.getByRole('button', { name: 'Approve', exact: true }).click()
  await card.getByRole('button', { name: 'Copy approved draft' }).click()
  await card.getByText('Approved for manual use').waitFor({ timeout: 10_000 })
}))
frameResults.push(await smsFrame(browser, '03-sms-prepared-evidence.png', '#warm-sms-manual-evidence', async (card) => {
  await card.getByRole('button', { name: 'Approve', exact: true }).click()
  await card.getByRole('button', { name: 'Prepare manual use' }).click()
  await card.getByLabel('Operator note').fill('Sent manually from phone after reviewing the consent basis.')
  await card.getByRole('button', { name: 'Record manual evidence' }).click()
  await card.getByText(/Evidence: complete at/).waitFor({ timeout: 10_000 })
}))
frameResults.push(await smsFrame(browser, '04-sms-follow-up-needed.png', '#warm-sms-manual-response', async (card) => {
  await card.getByRole('button', { name: 'Approve', exact: true }).click()
  await card.getByRole('button', { name: 'Prepare manual use' }).click()
  await card.getByLabel('Operator note').fill('Contact replied with interest; follow-up needs review.')
  await card.getByRole('button', { name: 'Record manual evidence' }).click()
  await card.getByLabel('Manual SMS response outcome').selectOption('interested')
  await card.getByText('Follow-up draft: needed').waitFor({ timeout: 10_000 })
}))
frameResults.push(await smsFrame(browser, '05-sms-suppressed-stop.png', '#warm-sms-manual-response', async (card) => {
  await card.getByRole('button', { name: 'Approve', exact: true }).click()
  await card.getByRole('button', { name: 'Prepare manual use' }).click()
  await card.getByLabel('Operator note').fill('Contact asked not to receive text messages.')
  await card.getByRole('button', { name: 'Record manual evidence' }).click()
  await card.getByLabel('Manual SMS response outcome').selectOption('stop_opt_out')
  await card.getByText('SMS prompts: suppressed').waitFor({ timeout: 10_000 })
}))
frameResults.push(await smsFrame(browser, '06-sms-revision.png', '#warm-sms-manual-decision', async (card) => {
  await card.getByRole('button', { name: 'Revise' }).click()
  await card.getByLabel('Warm SMS draft text').fill('Hi Amina, quick check on the Portfolio QA follow-up. Is this worth a short look this week?')
  await card.getByText('Revision requested').waitFor({ timeout: 10_000 })
}))
frameResults.push(await smsFrame(browser, '07-sms-rejected.png', '#warm-sms-manual-decision', async (card) => {
  await card.getByRole('button', { name: 'Reject' }).click()
  await card.getByText('Rejected', { exact: true }).waitFor({ timeout: 10_000 })
}))

const viewportResults = []
for (const [name, viewport] of [
  ['mobile-360', { width: 360, height: 800 }],
  ['mobile-390', { width: 390, height: 844 }],
  ['mobile-430', { width: 430, height: 932 }],
  ['tablet-768', { width: 768, height: 1024 }],
  ['desktop-1440', { width: 1440, height: 1000 }],
]) {
  viewportResults.push(await viewportEvidence(browser, name, viewport))
}

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

async function renderComposite(index, frame) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  const imageUrl = `data:image/png;base64,${(await readFile(frame.source)).toString('base64')}`
  await page.setContent(`<!doctype html>
    <html>
      <head>
        <style>
          body {
            margin: 0;
            width: 1280px;
            height: 720px;
            display: grid;
            grid-template-columns: 420px 1fr;
            background: #070b12;
            color: #f8fafc;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          .side {
            padding: 42px 34px;
            border-right: 1px solid rgba(148, 163, 184, 0.25);
            background: #0f172a;
          }
          .eyebrow {
            color: #38bdf8;
            font-size: 13px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0;
          }
          h1 {
            margin: 14px 0 20px;
            font-size: 28px;
            line-height: 1.12;
            letter-spacing: 0;
          }
          p {
            margin: 0 0 14px;
            color: #cbd5e1;
            font-size: 15px;
            line-height: 1.48;
          }
          .gate {
            margin-top: 20px;
            border: 1px solid rgba(251, 191, 36, 0.35);
            background: rgba(251, 191, 36, 0.10);
            color: #fef3c7;
            border-radius: 8px;
            padding: 12px;
            font-size: 14px;
            line-height: 1.45;
          }
          .screen {
            display: grid;
            place-items: center;
            padding: 28px;
          }
          img {
            max-width: 100%;
            max-height: 664px;
            border-radius: 8px;
            border: 1px solid rgba(148, 163, 184, 0.25);
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
          }
        </style>
      </head>
      <body>
        <section class="side">
          <div class="eyebrow">Warm SMS QA</div>
          <h1>${escapeHtml(frame.title)}</h1>
          <p>${escapeHtml(frame.scenario)}</p>
          <p>${escapeHtml(frame.expected)}</p>
          <div class="gate">${escapeHtml(frame.gate)}</div>
        </section>
        <section class="screen">
          <img src="${imageUrl}" alt="Warm SMS readiness product surface" />
        </section>
      </body>
    </html>`, { waitUntil: 'load' })
  await page.locator('img').evaluate((image) => {
    if (!(image instanceof HTMLImageElement) || image.naturalWidth < 1) {
      throw new Error('Composite product screenshot did not load.')
    }
  })
  const output = path.join(compositeDir, `frame-${String(index).padStart(2, '0')}.png`)
  await page.screenshot({ path: output })
  await page.close()
  return output
}

const frames = [
  {
    source: frameResults[0].screenshotPath,
    title: 'Provider configured, still disabled',
    scenario: 'The synthetic contact has a future SMS adapter plus reviewed relationship, phone provenance, permission, cooldown, suppression, and audit evidence.',
    expected: 'Portfolio reports the provider as configured but disabled and gives the exact activation-preparation step. Provider calls and delivery stay off.',
    gate: 'This readiness snapshot is architecture only. It does not create a provider draft or send an SMS.',
  },
  {
    source: frameResults[1].screenshotPath,
    title: 'Manual approval stays separate',
    scenario: 'The operator approves the existing manual SMS text and uses the local copy affordance.',
    expected: 'Manual approval changes only the PR #882 loop. It does not satisfy provider draft approval or future send authorization.',
    gate: 'The copied text is for one-to-one manual use outside Portfolio. Provider execution remains fail-closed.',
  },
  {
    source: frameResults[2].screenshotPath,
    title: 'Manual-send evidence captured',
    scenario: 'After preparing manual use, the operator records timestamp, channel, and a short note.',
    expected: 'Evidence stays minimal and privacy-conscious: no raw SMS body, phone number, screenshot, or private reply content.',
    gate: 'This evidence confirms an outside manual step. It is not provider-draft or provider-send authority.',
  },
  {
    source: frameResults[3].screenshotPath,
    title: 'Response creates manual review work',
    scenario: 'The manual outcome is classified as interested.',
    expected: 'Portfolio marks follow-up draft needed. It does not send a follow-up automatically.',
    gate: 'Next action is another reviewed manual draft, not provider activation or an SMS send.',
  },
  {
    source: frameResults[4].screenshotPath,
    title: 'Stop outcome suppresses SMS',
    scenario: 'The operator records a stop or opt-out outcome from the manual SMS thread.',
    expected: 'The card fails closed and suppresses future SMS prompts for this contact.',
    gate: 'Suppression has precedence. No copy, prepare, provider draft, or future send review should continue after stop evidence.',
  },
  {
    source: frameResults[5].screenshotPath,
    title: 'Revision stays local',
    scenario: 'The operator revises the short draft in the workroom.',
    expected: 'The edited text stays on screen as a review aid. No draft creation, import, or provider write is triggered.',
    gate: 'Next action: approve revised manual text or reject it. Generic proceed is never provider-send authority.',
  },
  {
    source: frameResults[6].screenshotPath,
    title: 'Reject remains fail-closed',
    scenario: 'The operator rejects the SMS draft.',
    expected: 'The card records rejection state and keeps SMS delivery off.',
    gate: 'Recovery requires a better relationship, consent, or draft basis. Provider send still requires a separate current approval and provider flag.',
  },
]

const compositeFrames = []
for (let index = 0; index < frames.length; index += 1) {
  compositeFrames.push(await renderComposite(index + 1, frames[index]))
}
await browser.close()

const repeatedFrames = []
let frameIndex = 1
for (const frame of compositeFrames) {
  for (let copy = 0; copy < 3; copy += 1) {
    const output = path.join(compositeDir, `video-${String(frameIndex).padStart(2, '0')}.png`)
    await copyFile(frame, output)
    repeatedFrames.push(output)
    frameIndex += 1
  }
}

await execFileAsync('ffmpeg', [
  '-y',
  '-framerate',
  '1',
  '-i',
  path.join(compositeDir, 'video-%02d.png'),
  '-r',
  '30',
  '-c:v',
  'libx264',
  '-pix_fmt',
  'yuv420p',
  '-movflags',
  '+faststart',
  mp4Path,
])

const externalRequests = [
  ...frameResults.flatMap((item) => item.unexpectedRequests),
  ...viewportResults.flatMap((item) => item.unexpectedRequests),
]
if (externalRequests.length > 0) {
  throw new Error(`Unexpected external request(s): ${externalRequests.join(', ')}`)
}
if (viewportResults.some((item) => item.horizontalOverflow)) {
  throw new Error(`Horizontal overflow detected: ${viewportResults.filter((item) => item.horizontalOverflow).map((item) => item.name).join(', ')}`)
}
if (viewportResults.some((item) => !item.hasSmsReadiness || !item.hasApprovalCopy || !item.hasManualLoop || !item.hasEvidenceCapture || !item.hasResponseOutcome || !item.hasProviderReadiness || !item.hasProviderDisabled || !item.hasConsentAudit || !item.hasFutureSendBoundary || !item.hasManualSeparation)) {
  throw new Error(`A viewport missed SMS provider readiness, consent/audit, future-send boundary, manual separation, loop, evidence, response, or approval-boundary copy: ${JSON.stringify(viewportResults, null, 2)}`)
}
if (viewportResults.some((item) => !item.allManualInputsUseDarkMode)) {
  throw new Error(`A viewport rendered a manual SMS input with light-mode styling: ${JSON.stringify(viewportResults, null, 2)}`)
}

const receipt = {
  route: qaUrl,
  screenshots: viewportResults,
  sourceFrames: frameResults.map((item) => item.screenshotPath),
  compositeFrames,
  mp4Path,
  externalRequests,
  boundaries: {
    providerConfigured: true,
    providerEnabled: false,
    providerSendRouteImplemented: false,
    separateCurrentSendApprovalRequired: true,
    genericProceedAccepted: false,
    smsDelivery: false,
    smsProviderCalls: false,
    phoneImport: false,
    slackDispatch: false,
    gmailAction: false,
    n8nDispatch: false,
    productionDataMutation: false,
    migration: false,
  },
}

await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
console.log(JSON.stringify({ ok: true, receiptPath, mp4Path, route: qaUrl, externalRequests }, null, 2))
