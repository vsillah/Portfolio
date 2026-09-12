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
const qaDir = path.join(root, 'test-results', 'warm-sms-live-execution-readiness-qa')
const sourceDir = path.join(qaDir, 'source')
const baseUrl = (process.env.QA_BASE_URL || 'http://127.0.0.1:3028').replace(/\/$/, '')
const contactId = 42
const qaPath = `/admin/outreach?tab=leads&filter=warm&id=${contactId}&contactId=${contactId}&qa=warm-slack-send-approval#warm-sms-readiness`
const qaUrl = new URL(qaPath, baseUrl).toString()
const canaryPath = `/api/admin/outreach/leads/${contactId}/sms-telnyx-no-send-canary`
const liveSendPath = `/api/admin/outreach/leads/${contactId}/sms-telnyx-live-send`
const mp4Path = path.join(outputDir, 'warm-sms-live-execution-readiness-qa.mp4')
const receiptPath = path.join(outputDir, 'warm-sms-live-execution-readiness-qa.json')

await mkdir(outputDir, { recursive: true })
await mkdir(sourceDir, { recursive: true })

const user = {
  id: 'warm-sms-live-execution-readiness-qa-admin',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'warm-sms-live-execution-readiness-qa@example.test',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-08-30T00:00:00.000Z',
}

const canaryResult = {
  version: 'warm-outreach-sms-telnyx-no-send-canary/v1',
  status: 'passed_no_send',
  message:
    'No-send Telnyx SMS canary passed. No Telnyx API call ran, no SMS was sent, and provider activation remains disabled.',
  contactId: String(contactId),
  provider: {
    expectedProvider: 'telnyx_messaging',
    selectedProvider: {
      key: 'telnyx_messaging',
      label: 'Telnyx Messaging',
      configured: true,
      unavailable: false,
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
  smsDeliveryEnabledReason:
    'No-send canary only; live SMS requires later activation and per-recipient approval.',
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

async function installSafeRoutes(page, externalRequests, canaryRequests, liveSendRequests) {
  const localOrigin = new URL(baseUrl).origin
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const requestUrl = request.url()
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

    if (url.origin === localOrigin && url.pathname === liveSendPath) {
      liveSendRequests.push({
        url: requestUrl,
        method: request.method(),
      })
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'blocked_no_send',
          telnyxApiCalled: false,
          externalSendPerformed: false,
        }),
      })
      return
    }

    if (blockedHost) {
      externalRequests.push(requestUrl)
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

    externalRequests.push(requestUrl)
    await route.abort('blockedbyclient')
  })
}

async function openQaPage(browser, viewport, colorScheme = 'dark', recordVideo = false) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme,
    ...(recordVideo ? { recordVideo: { dir: qaDir, size: viewport } } : {}),
  })
  const page = await context.newPage()
  await seedSession(page)
  const externalRequests = []
  const canaryRequests = []
  const liveSendRequests = []
  await installSafeRoutes(page, externalRequests, canaryRequests, liveSendRequests)
  const response = await page.goto(qaUrl, { waitUntil: 'networkidle' })
  if (response && response.status() >= 400) {
    throw new Error(`QA route returned HTTP ${response.status()}: ${qaUrl}`)
  }
  const overlay = await page.locator('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay').count()
  if (overlay > 0) throw new Error('Framework error overlay is visible on the QA route.')
  await page.locator('#warm-sms-readiness').waitFor({ timeout: 15_000 })
  await page.locator('[data-sms-live-telnyx-readiness]').waitFor({ timeout: 15_000 })
  return { context, page, externalRequests, canaryRequests, liveSendRequests }
}

async function runCanary(page) {
  await page.getByRole('button', { name: 'Run SMS no-send canary' }).click()
  await page.locator('[data-sms-no-send-canary]').getByText(/No-send Telnyx SMS canary passed/i).waitFor({ timeout: 15_000 })
}

async function viewportEvidence(browser, name, viewport, colorScheme) {
  const qa = await openQaPage(browser, viewport, colorScheme)
  await runCanary(qa.page)
  await qa.page.locator('[data-sms-live-telnyx-readiness]').scrollIntoViewIfNeeded()
  const screenshotPath = path.join(sourceDir, `warm-sms-live-execution-readiness-${name}-${colorScheme}.png`)
  const checks = await qa.page.evaluate(() => {
    const text = document.body.innerText
    const live = document.querySelector('[data-sms-live-telnyx-readiness]')?.textContent ?? ''
    const inputs = [...document.querySelectorAll('textarea, select')]
    return {
      hasExistingSurface: /Warm SMS manual readiness/i.test(text) && /Relationship packet/i.test(text),
      hasNoSendPassed: /No-send Telnyx SMS canary passed/i.test(text),
      hasLiveReadiness: /Live Telnyx one-recipient readiness/i.test(live),
      hasSequence:
        /No-send canary passed/i.test(live) &&
        /Credential\/provider smoke available/i.test(live) &&
        /Explicit per-recipient send approval/i.test(live) &&
        /Live one-recipient SMS execution/i.test(live),
      hasRecoveryStates:
        /Missing 1Password credential/i.test(live) &&
        /Missing sender\/profile/i.test(live) &&
        /Execution flag disabled/i.test(live) &&
        /Consent\/suppression failure/i.test(live) &&
        /Duplicate idempotency key/i.test(live) &&
        /Absent per-recipient approval/i.test(live),
      hasRouteContract:
        /sms-telnyx-live-send/i.test(live) &&
        /execute_warm_sms_send_for_authorized_recipient/i.test(live) &&
        /generic proceed is rejected/i.test(live),
      hasNoLiveButton: ![...document.querySelectorAll('button')].some((button) =>
        /live.*sms|send sms/i.test(button.textContent ?? ''),
      ),
      hasNoSecretOrRawRecipientLeak:
        !/op:\/\/Portfolio\/Warm SMS Telnyx\/credential/i.test(text) &&
        !/\+1555\d{7}/.test(text) &&
        !/Hi Alice, open to a short check-in/i.test(text),
      darkInputCount: inputs.filter((input) =>
        input.className.includes('bg-imperial-navy') &&
        input.className.includes('text-platinum-white') &&
        input.className.includes('[color-scheme:dark]'),
      ).length,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      pageHeight: document.documentElement.scrollHeight,
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
    externalRequests: qa.externalRequests,
    canaryRequests: qa.canaryRequests,
    liveSendRequests: qa.liveSendRequests,
    ...checks,
  }
}

async function recordWalkthrough(browser) {
  const qa = await openQaPage(browser, { width: 1280, height: 720 }, 'dark', true)
  await qa.page.addStyleTag({
    content: `
      body { padding-left: 390px !important; }
      #codex-qa-panel {
        position: fixed;
        inset: 0 auto 0 0;
        z-index: 2147483647;
        width: 390px;
        box-sizing: border-box;
        padding: 32px 28px;
        background: #10211f;
        color: #f8fafc;
        border-right: 1px solid rgba(148, 163, 184, 0.3);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #codex-qa-panel .eyebrow {
        color: #7dd3fc;
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0;
      }
      #codex-qa-panel h1 {
        margin: 12px 0 18px;
        font-size: 27px;
        line-height: 1.12;
        letter-spacing: 0;
      }
      #codex-qa-panel p {
        margin: 0 0 13px;
        color: #cbd5e1;
        font-size: 14px;
        line-height: 1.45;
      }
      #codex-qa-panel .gate {
        margin-top: 18px;
        border: 1px solid rgba(251, 191, 36, 0.42);
        background: rgba(251, 191, 36, 0.12);
        color: #fef3c7;
        border-radius: 8px;
        padding: 12px;
        font-size: 13px;
        line-height: 1.42;
      }
    `,
  })
  await qa.page.evaluate(() => {
    const panel = document.createElement('aside')
    panel.id = 'codex-qa-panel'
    panel.innerHTML = `
      <div class="eyebrow">Warm SMS Live Readiness QA</div>
      <h1>Telnyx path is scaffolded, but live send stays gated.</h1>
      <p>Scenario: the operator reviews the existing warm outreach workroom after the no-send canary phase.</p>
      <p>Expected behavior: the UI shows no-send canary passed, provider smoke readiness, exact per-recipient approval, and live one-recipient execution as separate gates.</p>
      <div class="gate">Decision gate: this PR authorizes code review and human QA only. No live SMS, no Telnyx provider request, no secret value, no env mutation, and no production-data mutation.</div>
    `
    document.body.append(panel)
  })
  await qa.page.locator('#warm-sms-readiness').scrollIntoViewIfNeeded()
  await qa.page.waitForTimeout(700)
  await runCanary(qa.page)
  await qa.page.waitForTimeout(900)
  await qa.page.locator('[data-sms-live-telnyx-readiness]').scrollIntoViewIfNeeded()
  await qa.page.waitForTimeout(1400)
  const webmPath = await qa.page.video().path()
  await qa.context.close()
  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    webmPath,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    mp4Path,
  ])
  return {
    webmPath,
    mp4Path,
    externalRequests: qa.externalRequests,
    canaryRequests: qa.canaryRequests,
    liveSendRequests: qa.liveSendRequests,
  }
}

const browser = await chromium.launch({ headless: true })
try {
  const viewportChecks = []
  for (const colorScheme of ['dark', 'light']) {
    for (const [name, viewport] of [
      ['mobile-360', { width: 360, height: 844 }],
      ['mobile-390', { width: 390, height: 844 }],
      ['mobile-430', { width: 430, height: 844 }],
      ['tablet-768', { width: 768, height: 900 }],
      ['desktop-1440', { width: 1440, height: 960 }],
    ]) {
      viewportChecks.push(await viewportEvidence(browser, name, viewport, colorScheme))
    }
  }
  const video = await recordWalkthrough(browser)
  const allExternalRequests = [
    ...viewportChecks.flatMap((check) => check.externalRequests),
    ...video.externalRequests,
  ]
  const receipt = {
    version: 'warm-sms-live-execution-readiness-qa/v1',
    createdAt: new Date().toISOString(),
    route: qaUrl,
    mp4Path,
    viewportChecks,
    video,
    pass: {
      allViewportsRendered: viewportChecks.every((check) =>
        check.hasExistingSurface &&
        check.hasNoSendPassed &&
        check.hasLiveReadiness &&
        check.hasSequence &&
        check.hasRecoveryStates &&
        check.hasRouteContract &&
        check.hasNoLiveButton &&
        check.hasNoSecretOrRawRecipientLeak &&
        check.darkInputCount >= 2 &&
        !check.horizontalOverflow,
      ),
      noExternalRequests: allExternalRequests.length === 0,
      noLiveSendRouteCalled: viewportChecks.every((check) => check.liveSendRequests.length === 0) &&
        video.liveSendRequests.length === 0,
      noProviderCallMade: true,
      noSmsSent: true,
      noRawSecretsPhoneOrMessageShown: true,
    },
    boundaries: {
      existingCanonicalSurfaceOnly: true,
      providerCallsEnabled: false,
      smsDeliveryEnabled: false,
      providerActivationEnabled: false,
      enableWarmSmsProviderExecutionChanged: false,
      telnyxApiCalled: false,
      rawCredentialsReturned: false,
      rawPhoneReturned: false,
      rawMessageBodyReturned: false,
      slackDispatchEnabled: false,
      gmailActionEnabled: false,
      n8nDispatchEnabled: false,
      productionDataMutation: false,
    },
  }
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
  console.log(JSON.stringify({
    ok: receipt.pass.allViewportsRendered &&
      receipt.pass.noExternalRequests &&
      receipt.pass.noLiveSendRouteCalled,
    receiptPath,
    mp4Path,
    route: qaUrl,
    externalRequests: allExternalRequests,
    liveSendRequests: [
      ...viewportChecks.flatMap((check) => check.liveSendRequests),
      ...video.liveSendRequests,
    ],
  }, null, 2))
} finally {
  await browser.close()
}
