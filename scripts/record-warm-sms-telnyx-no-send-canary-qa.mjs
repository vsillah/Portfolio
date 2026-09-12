import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { config as loadEnv } from 'dotenv'

const execFileAsync = promisify(execFile)
const root = process.cwd()
loadEnv({ path: path.join(root, '.env.local'), quiet: true })

const outputDir = path.join(root, 'docs', 'warm-outreach-qa')
const qaDir = path.join(root, 'test-results', 'warm-sms-telnyx-no-send-canary-qa')
const sourceDir = path.join(qaDir, 'source')
const compositeDir = path.join(qaDir, 'composite')
const baseUrl = (process.env.QA_BASE_URL || 'http://127.0.0.1:3027').replace(/\/$/, '')
const contactId = 42
const qaPath = `/admin/outreach?tab=leads&filter=warm&id=${contactId}&contactId=${contactId}&qa=warm-slack-send-approval#warm-sms-readiness`
const qaUrl = new URL(qaPath, baseUrl).toString()
const canaryPath = `/api/admin/outreach/leads/${contactId}/sms-telnyx-no-send-canary`
const mp4Path = path.join(outputDir, 'warm-sms-telnyx-no-send-canary-qa.mp4')
const receiptPath = path.join(outputDir, 'warm-sms-telnyx-no-send-canary-qa.json')

await mkdir(outputDir, { recursive: true })
await mkdir(sourceDir, { recursive: true })
await mkdir(compositeDir, { recursive: true })

const user = {
  id: 'warm-sms-telnyx-no-send-canary-qa-admin',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'warm-sms-telnyx-no-send-canary-qa@example.test',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-08-30T00:00:00.000Z',
}

const canaryResult = {
  version: 'warm-outreach-sms-telnyx-no-send-canary/v1',
  status: 'passed_no_send',
  message: 'No-send Telnyx SMS canary passed. No Telnyx API call ran, no SMS was sent, and provider activation remains disabled.',
  contactId: String(contactId),
  provider: {
    expectedProvider: 'telnyx_messaging',
    selectedProvider: {
      key: 'telnyx_messaging',
      label: 'Telnyx Messaging',
      configured: true,
      enabled: false,
      rawValueReturned: false,
    },
    selectedProviderVerified: true,
    rawAdapterReturned: false,
  },
  noSendCanary: true,
  externalRequests: [],
  providerCallsEnabled: false,
  smsDeliveryEnabled: false,
  providerActivationEnabled: false,
  featureFlagEnabled: false,
  smsDeliveryEnabledReason: 'No-send canary only; live SMS requires later activation and per-recipient approval.',
  readiness: {
    envSetupPresent: true,
    selectedProviderAdapter: 'passed',
    disabledExecutionFlag: 'passed',
    consentSuppressionPrerequisites: 'passed',
    messageVersion: 'passed',
    idempotencyNamespace: 'passed',
    auditKey: 'passed',
    credentialReference: 'passed',
    senderReference: 'passed',
    deliveryCallbackReference: 'passed',
    optOutCallbackReference: 'passed',
    deliveryConfirmationStore: 'passed',
    providerCapabilityEvidence: 'passed',
    liveSmsUnavailable: true,
    providerActivationStillDisabled: true,
    perRecipientSendStillSeparate: true,
  },
  redactedReferences: [
    ['SMS_PROVIDER_ADAPTER', 'SMS provider adapter', 'present_redacted'],
    ['SMS_PROVIDER_CREDENTIAL_REFERENCE', 'Telnyx credential reference', 'present_redacted'],
    ['SMS_PROVIDER_SENDER_REFERENCE', 'Telnyx sender reference', 'present_redacted'],
    ['SMS_PROVIDER_DELIVERY_CALLBACK', 'Delivery callback reference', 'present_redacted'],
    ['SMS_PROVIDER_OPT_OUT_CALLBACK', 'Opt-out callback reference', 'present_redacted'],
    ['WARM_SMS_MESSAGE_VERSION_KEY', 'Message version key', 'present_redacted'],
    ['WARM_SMS_IDEMPOTENCY_NAMESPACE', 'Idempotency namespace', 'present_redacted'],
    ['WARM_SMS_AUDIT_KEY', 'Audit key', 'present_redacted'],
    ['WARM_SMS_DELIVERY_CONFIRMATION_STORE', 'Delivery confirmation store', 'present_redacted'],
    ['ENABLE_WARM_SMS_PROVIDER_EXECUTION', 'Provider execution flag', 'disabled_verified'],
  ].map(([key, label, status]) => ({
    key,
    label,
    status,
    rawValueReturned: false,
  })),
  idempotency: {
    namespace: 'warm-sms-send:v1',
    messageVersionKey: 'warm-sms-message:v1',
    auditKey: 'warm-sms-audit:v1',
    canaryIdempotencyKey: 'warm-sms-send:v1:canary:no-send:qa-stable-42',
    auditEvidenceKey: 'warm-sms-audit:v1:no-send-canary:qa-stable-42',
    duplicatePolicy: 'return_existing_no_send_evidence_without_provider_call',
    stableResult: true,
  },
  deliveryConfirmation: {
    storeMapped: true,
    status: 'placeholder_only',
    providerMessageId: null,
    deliveryStatus: null,
  },
  blockedReasons: [],
  executionBoundary: {
    localRowsOnly: true,
    noSendAuditOnly: true,
    providerCallsEnabled: false,
    smsDeliveryEnabled: false,
    providerActivationEnabled: false,
    featureFlagEnabled: false,
    telnyxApiCalled: false,
    rawCredentialsReturned: false,
    rawPhoneReturned: false,
    rawMessageBodyReturned: false,
    credentialsRead: false,
    secretManagerMutated: false,
    environmentVariablesChanged: false,
    databaseWritesEnabled: false,
    slackDispatchEnabled: false,
    gmailActionEnabled: false,
    n8nDispatchEnabled: false,
    externalRequests: [],
  },
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

async function installSafeRoutes(page, unexpectedRequests, canaryRequests) {
  const localOrigin = new URL(baseUrl).origin
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const requestUrl = request.url()
    const blockedLocalPath =
      /\/api\/admin\/outreach\/(?:gmail-response-import)\b/i.test(url.pathname) ||
      /\/api\/admin\/outreach\/[^/]+\/(?:slack-send-approval|gmail-user-draft|gmail-user-send|gmail-draft-canary)\b/i.test(url.pathname) ||
      (/\/api\/admin\/outreach\/leads\/\d+\/(?:sms|text|provider-send|manual-send)\b/i.test(url.pathname) && url.pathname !== canaryPath)
    const blockedHost = /slack\.com|gmail\.com|googleapis\.com|twilio\.com|telnyx\.com|messagebird\.com|linkedin\.com|facebook\.com|n8n/i.test(url.hostname)

    if (url.origin === localOrigin && url.pathname === canaryPath && request.method() === 'POST') {
      canaryRequests.push({
        url: requestUrl,
        method: request.method(),
        authorizationPresent: Boolean(request.headers().authorization),
      })
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(canaryResult),
      })
      return
    }
    if (blockedHost || blockedLocalPath) {
      unexpectedRequests.push(requestUrl)
      await route.abort('blockedbyclient')
      return
    }
    if (url.hostname === 'va.vercel-scripts.com') {
      await route.abort('blockedbyclient')
      return
    }
    if (/\/api\/user\/profile\b/i.test(url.pathname)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ profile: { ...user, role: 'admin', updated_at: user.created_at } }),
      })
      return
    }
    if (/\/auth\/v1\/user\b/i.test(url.pathname)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(user),
      })
      return
    }
    if (/\/api\/admin\/meetings\b/i.test(url.pathname)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ meetings: [], total: 0 }),
      })
      return
    }
    if (/\/api\/admin\/value-evidence\/workflow-status\b/i.test(url.pathname)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ runs: [] }),
      })
      return
    }
    if (url.origin === localOrigin) {
      await route.continue()
      return
    }

    unexpectedRequests.push(requestUrl)
    await route.abort('blockedbyclient')
  })
}

async function openQaPage(browser, viewport, colorScheme = 'dark') {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme })
  const page = await context.newPage()
  await seedSession(page)
  const unexpectedRequests = []
  const canaryRequests = []
  await installSafeRoutes(page, unexpectedRequests, canaryRequests)
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
  await page.getByRole('button', { name: 'Run SMS no-send canary' }).waitFor({ timeout: 15_000 })
  return { context, page, unexpectedRequests, canaryRequests }
}

async function runCanary(page) {
  await page.getByRole('button', { name: 'Run SMS no-send canary' }).click()
  await page.locator('[data-sms-no-send-canary]').getByText(/No-send Telnyx SMS canary passed/i).waitFor({ timeout: 15_000 })
  await page.locator('[data-sms-no-send-canary]').scrollIntoViewIfNeeded()
}

async function viewportEvidence(browser, name, viewport, colorScheme) {
  const qa = await openQaPage(browser, viewport, colorScheme)
  await runCanary(qa.page)
  const screenshotPath = path.join(sourceDir, `warm-sms-telnyx-no-send-canary-${name}-${colorScheme}.png`)
  const checks = await qa.page.evaluate(() => {
    const canary = document.querySelector('[data-sms-no-send-canary]')
    const readiness = document.querySelector('#warm-sms-readiness')
    const text = document.body.innerText
    const canaryText = canary?.textContent ?? ''
    const canaryRect = canary instanceof HTMLElement ? canary.getBoundingClientRect() : { height: 0, width: 0 }
    return {
      hasExistingSurface: /Warm SMS manual readiness/i.test(text) && /Relationship packet/i.test(text),
      hasManualControls: /Manual SMS operating loop/i.test(text) && /Manual send evidence/i.test(text),
      hasCanaryButton: /Run SMS no-send canary/i.test(text),
      hasPassedResult: /No-send Telnyx SMS canary passed/i.test(canaryText),
      hasEnvSetup: /Env setup: present/i.test(canaryText),
      hasProviderDisabled: /Provider activation: disabled/i.test(canaryText),
      hasLiveSmsUnavailable: /Live SMS: unavailable/i.test(canaryText),
      hasPerRecipientSeparate: /Per-recipient send: separate/i.test(canaryText),
      hasExternalRequestsZero: /External requests: 0/i.test(canaryText),
      hasCanaryKey: /Canary key: warm-sms-send:v1:canary:no-send:qa-stable-42/i.test(canaryText),
      hasDeliveryStoreReference: /WARM_SMS_DELIVERY_CONFIRMATION_STORE: present redacted/i.test(canaryText),
      hasExecutionFlagDisabled: /ENABLE_WARM_SMS_PROVIDER_EXECUTION: disabled verified/i.test(canaryText),
      hasBoundary:
        /Provider calls: off/i.test(canaryText) &&
        /SMS delivery: off/i.test(canaryText) &&
        /Provider activation: off/i.test(canaryText) &&
        /Feature flag enabled: no/i.test(canaryText) &&
        /Telnyx API called: no/i.test(canaryText) &&
        /Raw phone\/message: no/i.test(canaryText),
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      pageHeight: document.documentElement.scrollHeight,
      readinessHeight: readiness instanceof HTMLElement ? readiness.getBoundingClientRect().height : 0,
      canaryHeight: canaryRect.height,
      canaryWidth: canaryRect.width,
    }
  })
  await qa.page.screenshot({ path: screenshotPath, fullPage: true })
  await qa.context.close()
  return {
    name,
    viewport,
    colorScheme,
    screenshotPath,
    horizontalOverflow: checks.scrollWidth > checks.clientWidth,
    unexpectedRequests: qa.unexpectedRequests,
    canaryRequests: qa.canaryRequests,
    ...checks,
  }
}

async function captureFrame(browser, fileName, selector, viewport = { width: 390, height: 844 }) {
  const qa = await openQaPage(browser, viewport, 'dark')
  await runCanary(qa.page)
  const focus = qa.page.locator(selector)
  await focus.scrollIntoViewIfNeeded()
  const screenshotPath = path.join(sourceDir, fileName)
  await focus.screenshot({ path: screenshotPath })
  await qa.context.close()
  return { screenshotPath, unexpectedRequests: qa.unexpectedRequests, canaryRequests: qa.canaryRequests }
}

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

async function renderComposite(browser, index, frame) {
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
            background: #07100e;
            color: #f8fafc;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          .side {
            padding: 42px 34px;
            border-right: 1px solid rgba(148, 163, 184, 0.28);
            background: #10211f;
          }
          .eyebrow {
            color: #7dd3fc;
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
            border: 1px solid rgba(251, 191, 36, 0.38);
            background: rgba(251, 191, 36, 0.11);
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
          <div class="eyebrow">Warm SMS no-send QA</div>
          <h1>${escapeHtml(frame.title)}</h1>
          <p>${escapeHtml(frame.scenario)}</p>
          <p>${escapeHtml(frame.expected)}</p>
          <div class="gate">${escapeHtml(frame.gate)}</div>
        </section>
        <section class="screen">
          <img src="${imageUrl}" alt="">
        </section>
      </body>
    </html>`, { waitUntil: 'load' })
  const compositePath = path.join(compositeDir, `frame-${String(index + 1).padStart(2, '0')}.png`)
  await page.screenshot({ path: compositePath })
  await page.close()
  return compositePath
}

const browser = await chromium.launch()
const frameResults = [
  await captureFrame(
    browser,
    '01-existing-surface.png',
    '#warm-sms-readiness',
  ),
  await captureFrame(
    browser,
    '02-no-send-result.png',
    '[data-sms-no-send-canary]',
  ),
  await captureFrame(
    browser,
    '03-manual-controls-separated.png',
    '#warm-sms-manual-loop',
    { width: 768, height: 1024 },
  ),
]

const viewportResults = []
for (const colorScheme of ['dark', 'light']) {
  for (const [name, viewport] of [
    ['mobile-360', { width: 360, height: 800 }],
    ['mobile-390', { width: 390, height: 844 }],
    ['mobile-430', { width: 430, height: 932 }],
    ['tablet-768', { width: 768, height: 1024 }],
    ['desktop-1440', { width: 1440, height: 1000 }],
  ]) {
    viewportResults.push(await viewportEvidence(browser, name, viewport, colorScheme))
  }
}

const frames = [
  {
    source: frameResults[0].screenshotPath,
    title: 'Same warm outreach surface',
    scenario: 'The operator opens the existing contact workroom at /admin/outreach and reviews warm SMS readiness in place.',
    expected: 'Manual SMS controls stay visible and separate; this phase adds only the Telnyx no-send canary path.',
    gate: 'Decision gate: review the no-send canary evidence only. Do not approve provider activation or live SMS.',
  },
  {
    source: frameResults[1].screenshotPath,
    title: 'No-send canary passes without egress',
    scenario: 'The operator clicks Run SMS no-send canary and receives an idempotent passed_no_send receipt.',
    expected: 'The result shows env setup present, Telnyx selected, execution disabled, externalRequests: 0, and redacted references only.',
    gate: 'External-action boundary: provider calls off, SMS delivery off, Telnyx API called no, raw phone/message no.',
  },
  {
    source: frameResults[2].screenshotPath,
    title: 'Live SMS remains unavailable',
    scenario: 'The manual SMS loop remains a local evidence workflow, not a provider send path.',
    expected: 'Provider activation, live SMS canary, and every per-recipient send are still separate future gates.',
    gate: 'No Slack, Gmail, n8n, Telnyx, Twilio, or MessageBird requests occurred during this walkthrough.',
  },
]

const compositeFrames = []
for (let i = 0; i < frames.length; i += 1) {
  compositeFrames.push(await renderComposite(browser, i, frames[i]))
}
await browser.close()

const externalRequests = [
  ...frameResults.flatMap((item) => item.unexpectedRequests),
  ...viewportResults.flatMap((item) => item.unexpectedRequests),
]
const canaryRequests = [
  ...frameResults.flatMap((item) => item.canaryRequests),
  ...viewportResults.flatMap((item) => item.canaryRequests),
]

if (externalRequests.length > 0) {
  throw new Error(`Unexpected external request(s): ${externalRequests.join(', ')}`)
}
if (canaryRequests.length !== frameResults.length + viewportResults.length) {
  throw new Error(`Expected one no-send canary request per QA pass; got ${canaryRequests.length}.`)
}
if (viewportResults.some((item) => item.horizontalOverflow)) {
  throw new Error(`Horizontal overflow detected: ${viewportResults.filter((item) => item.horizontalOverflow).map((item) => `${item.name}-${item.colorScheme}`).join(', ')}`)
}
if (viewportResults.some((item) => item.canaryHeight > 1250)) {
  throw new Error(`Canary result is excessively tall: ${viewportResults.filter((item) => item.canaryHeight > 1250).map((item) => `${item.name}-${item.colorScheme}:${item.canaryHeight}`).join(', ')}`)
}
if (viewportResults.some((item) => (
  !item.hasExistingSurface ||
  !item.hasManualControls ||
  !item.hasCanaryButton ||
  !item.hasPassedResult ||
  !item.hasEnvSetup ||
  !item.hasProviderDisabled ||
  !item.hasLiveSmsUnavailable ||
  !item.hasPerRecipientSeparate ||
  !item.hasExternalRequestsZero ||
  !item.hasCanaryKey ||
  !item.hasDeliveryStoreReference ||
  !item.hasExecutionFlagDisabled ||
  !item.hasBoundary
))) {
  throw new Error(`A viewport missed Telnyx no-send canary evidence: ${JSON.stringify(viewportResults, null, 2)}`)
}

const concatPath = path.join(compositeDir, 'frames.txt')
await writeFile(concatPath, compositeFrames.map((frame) => `file '${frame.replaceAll("'", "'\\''")}'\nduration 1.8`).join('\n') + `\nfile '${compositeFrames.at(-1).replaceAll("'", "'\\''")}'\n`)
await execFileAsync('ffmpeg', [
  '-y',
  '-f',
  'concat',
  '-safe',
  '0',
  '-i',
  concatPath,
  '-vf',
  'fps=30,format=yuv420p',
  '-movflags',
  '+faststart',
  mp4Path,
])

const receipt = {
  route: qaUrl,
  canaryApiRoute: canaryPath,
  screenshots: viewportResults,
  sourceFrames: frameResults.map((item) => item.screenshotPath),
  compositeFrames,
  mp4Path,
  externalRequests,
  canaryRequests,
  canaryResult,
  networkPolicy: {
    allNonLocalRequestsBlockedBeforeDispatch: true,
    providerHostsBlocked: ['telnyx.com', 'twilio.com', 'messagebird.com', 'slack.com', 'gmail.com', 'googleapis.com', 'n8n'],
    internalNoSendCanaryResponseOnly: true,
  },
  boundaries: {
    existingCanonicalSurfaceOnly: true,
    providerCallsEnabled: false,
    smsDeliveryEnabled: false,
    providerActivationEnabled: false,
    featureFlagEnabled: false,
    telnyxApiCalled: false,
    rawCredentialsReturned: false,
    rawPhoneReturned: false,
    rawMessageBodyReturned: false,
    slackDispatchEnabled: false,
    gmailActionEnabled: false,
    n8nDispatchEnabled: false,
    productionDataMutation: false,
    enableWarmSmsProviderExecution: false,
    liveSmsUnavailable: true,
    perRecipientSendStillSeparate: true,
  },
}

await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
console.log(JSON.stringify({ ok: true, receiptPath, mp4Path, route: qaUrl, externalRequests, canaryRequests: canaryRequests.length }, null, 2))
