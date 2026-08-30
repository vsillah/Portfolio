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
const qaDir = path.join(root, 'test-results', 'warm-sms-telnyx-activation-planning-qa')
const sourceDir = path.join(qaDir, 'source')
const compositeDir = path.join(qaDir, 'composite')
const baseUrl = (process.env.QA_BASE_URL || 'http://127.0.0.1:3027').replace(/\/$/, '')
const contactId = 42
const qaPath = `/admin/outreach?tab=leads&filter=warm&id=${contactId}&contactId=${contactId}&qa=warm-slack-send-approval#warm-sms-readiness`
const qaUrl = new URL(qaPath, baseUrl).toString()
const mp4Path = path.join(outputDir, 'warm-sms-telnyx-activation-planning-qa.mp4')
const receiptPath = path.join(outputDir, 'warm-sms-telnyx-activation-planning-qa.json')

await mkdir(outputDir, { recursive: true })
await mkdir(sourceDir, { recursive: true })
await mkdir(compositeDir, { recursive: true })

const user = {
  id: 'warm-sms-telnyx-activation-planning-qa-admin',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'warm-sms-telnyx-activation-planning-qa@example.test',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-08-30T00:00:00.000Z',
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

async function installSafeRoutes(page, unexpectedRequests) {
  const localOrigin = new URL(baseUrl).origin
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const requestUrl = request.url()
    const blockedLocalPath =
      /\/api\/admin\/outreach\/[^/]+\/(?:slack-send-approval|gmail-user-draft|gmail-user-send|gmail-draft-canary)\b/i.test(url.pathname) ||
      /\/api\/admin\/outreach\/gmail-response-import\b/i.test(url.pathname) ||
      /\/api\/admin\/outreach\/[^/]+\/(?:sms|text|provider-send|manual-send)\b/i.test(url.pathname)
    const blockedHost = /slack\.com|gmail\.com|googleapis\.com|twilio\.com|telnyx\.com|messagebird\.com|n8n/i.test(url.hostname)

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

async function openQaPage(browser, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
  const page = await context.newPage()
  await seedSession(page)
  const unexpectedRequests = []
  await installSafeRoutes(page, unexpectedRequests)
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
  await page.locator('[data-sms-telnyx-activation-planning]').waitFor({ timeout: 15_000 })
  return { context, page, unexpectedRequests }
}

async function viewportEvidence(browser, name, viewport) {
  const qa = await openQaPage(browser, viewport)
  await qa.page.locator('[data-sms-telnyx-activation-planning]').scrollIntoViewIfNeeded()
  const screenshotPath = path.join(outputDir, `warm-sms-telnyx-activation-planning-${name}.png`)
  const checks = await qa.page.evaluate(() => {
    const planning = document.querySelector('[data-sms-telnyx-activation-planning]')
    const gateSequence = document.querySelector('[data-sms-telnyx-gate-sequence]')
    const drillIn = document.querySelector('[data-sms-telnyx-activation-drill-in]')
    const planningText = planning?.textContent ?? ''
    const gateText = gateSequence?.textContent ?? ''
    const drillInText = drillIn?.textContent ?? ''
    return {
      hasPlanningGate: /Telnyx activation planning gate/i.test(planningText),
      hasStateSeparation:
        /Reference plan complete; activation planning active; env setup pending; no-send canary pending; provider activation disabled; live SMS unavailable/i.test(planningText),
      hasCurrentGate: /telnyx activation planning only/i.test(planningText),
      hasGateSequence:
        /Reference plan complete/i.test(gateText) &&
        /Activation planning gate active/i.test(gateText) &&
        /Provider account confirmation/i.test(gateText) &&
        /Sender\/profile registration/i.test(gateText) &&
        /Callback URL readiness/i.test(gateText) &&
        /Secret reference placement/i.test(gateText) &&
        /Vercel env update request/i.test(gateText) &&
        /Disabled provider config verification/i.test(gateText) &&
        /No-send canary/i.test(gateText) &&
        /Provider activation disabled/i.test(gateText) &&
        /Live SMS canary unavailable/i.test(gateText) &&
        /Per-recipient send unavailable/i.test(gateText),
      gateCount: gateSequence?.children.length ?? 0,
      drillInCollapsed: drillIn instanceof HTMLDetailsElement && !drillIn.open,
      hasRedactedReferences:
        /TELNYX_ACCOUNT_REFERENCE/i.test(drillInText) &&
        /TELNYX_MESSAGING_PROFILE_REFERENCE/i.test(drillInText) &&
        /TELNYX_SENDER_REFERENCE/i.test(drillInText) &&
        /TELNYX_WEBHOOK_SIGNING_REFERENCE/i.test(drillInText) &&
        /Raw value returned: no/i.test(drillInText),
      hasLaterApprovalGates:
        /Vercel env mutation/i.test(drillInText) &&
        /Secret manager update/i.test(drillInText) &&
        /Telnyx provider activation/i.test(drillInText) &&
        /Provider API calls/i.test(drillInText) &&
        /Live SMS canary/i.test(drillInText) &&
        /Per-recipient SMS send/i.test(drillInText) &&
        /Requires current Vambah approval\. Enabled now: no/i.test(drillInText),
      hasBoundary:
        /ENABLE_WARM_SMS_PROVIDER_EXECUTION=false; provider calls off; SMS delivery off; Telnyx activation off; live canary off; per-recipient send off/i.test(drillInText) &&
        /No secret manager mutation, Vercel env mutation, Telnyx API call, Slack dispatch, Gmail action, n8n dispatch, migration, or production-data mutation occurred\. External requests 0/i.test(drillInText),
      hasManualAndProviderSeparation:
        /Manual SMS operating loop/i.test(document.body.innerText) &&
        /Provider calls: off/i.test(document.body.innerText) &&
        /Generic proceed: rejected/i.test(document.body.innerText) &&
        /Approval: per-recipient required/i.test(document.body.innerText),
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
    screenshotPath,
    horizontalOverflow: checks.scrollWidth > checks.clientWidth,
    unexpectedRequests: qa.unexpectedRequests,
    ...checks,
  }
}

async function captureFrame(browser, fileName, selector, action = null, viewport = { width: 390, height: 844 }) {
  const qa = await openQaPage(browser, viewport)
  const card = qa.page.locator('#warm-sms-readiness')
  if (action) await action(card)
  const focus = qa.page.locator(selector)
  await focus.scrollIntoViewIfNeeded()
  const screenshotPath = path.join(sourceDir, fileName)
  await focus.screenshot({ path: screenshotPath })
  await qa.context.close()
  return { screenshotPath, unexpectedRequests: qa.unexpectedRequests }
}

async function openPlanningDrillIn(card) {
  await card.locator('[data-sms-telnyx-activation-drill-in] summary').click()
  await card.locator('[data-sms-telnyx-activation-drill-in]').evaluate((element) => {
    if (!(element instanceof HTMLDetailsElement) || !element.open) {
      throw new Error('Telnyx activation planning drill-in did not open.')
    }
  })
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
          <div class="eyebrow">Warm SMS Telnyx QA</div>
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
    '01-activation-planning-summary.png',
    '[data-sms-telnyx-activation-planning]',
  ),
  await captureFrame(
    browser,
    '02-gate-sequence.png',
    '[data-sms-telnyx-gate-sequence]',
  ),
  await captureFrame(
    browser,
    '03-redacted-refs-and-approval-gates.png',
    '[data-sms-telnyx-activation-drill-in]',
    openPlanningDrillIn,
    { width: 768, height: 1024 },
  ),
  await captureFrame(
    browser,
    '04-no-send-canary-boundary.png',
    '[data-sms-no-send-canary]',
  ),
  await captureFrame(
    browser,
    '05-provider-activation-audit.png',
    '[data-sms-provider-configuration]',
    async (card) => {
      await card.getByText('Activation requirements and audit evidence').click()
    },
    { width: 768, height: 1024 },
  ),
]

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

const frames = [
  {
    source: frameResults[0].screenshotPath,
    title: 'Current gate is planning only',
    scenario: 'Operator opens the existing warm outreach contact workroom and reviews the Telnyx activation planning gate.',
    expected: 'Reference plan is complete, activation planning is active, env setup is pending, and execution remains disabled.',
    gate: 'Decision gate: approve only the planning surface. Do not approve env mutation, secrets, provider activation, or sending.',
  },
  {
    source: frameResults[1].screenshotPath,
    title: 'Sequence separates every later gate',
    scenario: 'The operator scans the full sequence from provider account confirmation through per-recipient send.',
    expected: 'Vambah-owned setup, captain checks, approval-only gates, disabled provider activation, and unavailable live send are distinct.',
    gate: 'External-action boundary: provider calls off, SMS delivery off, ENABLE_WARM_SMS_PROVIDER_EXECUTION=false.',
  },
  {
    source: frameResults[2].screenshotPath,
    title: 'References are redacted',
    scenario: 'The collapsed drill-in opens only for reference names and later approval requirements.',
    expected: 'No credentials, phone numbers, tokens, provider dashboard data, or secrets are displayed or fetched.',
    gate: 'Later approval required: Vercel env mutation, secret manager update, Telnyx activation, provider API calls, live canary, and each send.',
  },
  {
    source: frameResults[3].screenshotPath,
    title: 'No-send canary is not a live send',
    scenario: 'The canary area remains a local route simulation on the existing contact surface.',
    expected: 'It may become eligible, but live SMS remains unavailable and no provider message ID exists.',
    gate: 'No-egress proof must show externalRequests: [] before the captain asks for human QA.',
  },
  {
    source: frameResults[4].screenshotPath,
    title: 'Activation audit stays separate',
    scenario: 'Provider activation evidence remains behind a collapsed requirements panel.',
    expected: 'Disabled config and capability evidence can be reviewed without activating Telnyx or implementing a send route.',
    gate: 'Future live SMS needs current Vambah approval and exact per-recipient authorization.',
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

if (externalRequests.length > 0) {
  throw new Error(`Unexpected external request(s): ${externalRequests.join(', ')}`)
}
if (viewportResults.some((item) => item.horizontalOverflow)) {
  throw new Error(`Horizontal overflow detected: ${viewportResults.filter((item) => item.horizontalOverflow).map((item) => item.name).join(', ')}`)
}
if (viewportResults.some((item) => (
  !item.hasPlanningGate ||
  !item.hasStateSeparation ||
  !item.hasCurrentGate ||
  !item.hasGateSequence ||
  item.gateCount !== 12 ||
  !item.drillInCollapsed ||
  !item.hasRedactedReferences ||
  !item.hasLaterApprovalGates ||
  !item.hasBoundary ||
  !item.hasManualAndProviderSeparation
))) {
  throw new Error(`A viewport missed Telnyx activation planning evidence: ${JSON.stringify(viewportResults, null, 2)}`)
}

const concatPath = path.join(compositeDir, 'frames.txt')
await writeFile(concatPath, compositeFrames.map((frame) => `file '${frame.replaceAll("'", "'\\''")}'\nduration 1.6`).join('\n') + `\nfile '${compositeFrames.at(-1).replaceAll("'", "'\\''")}'\n`)
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
  screenshots: viewportResults,
  sourceFrames: frameResults.map((item) => item.screenshotPath),
  compositeFrames,
  mp4Path,
  externalRequests,
  networkPolicy: {
    allNonLocalRequestsBlockedBeforeDispatch: true,
    prohibitedProviderAndSendRoutesAborted: true,
    syntheticFixtureRoutesOnly: true,
  },
  boundaries: {
    referencePlanComplete: true,
    activationPlanningGateActive: true,
    envSetupPending: true,
    noSendCanaryState: 'pending',
    providerActivationDisabled: true,
    liveSendUnavailable: true,
    telnyxProviderActivation: false,
    enableWarmSmsProviderExecution: false,
    smsProviderCalls: false,
    smsDelivery: false,
    smsSends: false,
    phoneImport: false,
    slackDispatch: false,
    gmailAction: false,
    n8nDispatch: false,
    secretManagerMutation: false,
    vercelEnvMutation: false,
    productionDataMutation: false,
    migrations: false,
    providerApiCalls: false,
    liveSmsCanary: false,
    perRecipientSmsSend: false,
    laterApprovalGates: [
      'Vercel env mutation',
      'Secret manager update',
      'Telnyx provider activation',
      'Provider API calls',
      'Live SMS canary',
      'Each per-recipient SMS send',
    ],
  },
}

await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
console.log(JSON.stringify({ ok: true, receiptPath, mp4Path, route: qaUrl, externalRequests }, null, 2))
