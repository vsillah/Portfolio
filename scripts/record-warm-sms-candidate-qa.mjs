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
const qaDir = path.join(root, 'test-results', 'warm-sms-candidate-review-qa')
const sourceDir = path.join(qaDir, 'source')
const compositeDir = path.join(qaDir, 'composite')
const baseUrl = (process.env.QA_BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '')
const contactId = 42
const qaPath = `/admin/outreach?tab=leads&filter=warm&id=${contactId}&contactId=${contactId}&qa=warm-slack-send-approval#warm-sms-readiness`
const qaUrl = new URL(qaPath, baseUrl).toString()
const candidatePath = `/api/admin/outreach/leads/${contactId}/sms-candidate`
const mp4Path = path.join(outputDir, 'warm-sms-candidate-review-qa.mp4')
const receiptPath = path.join(outputDir, 'warm-sms-candidate-review-qa.json')

await mkdir(outputDir, { recursive: true })
await mkdir(sourceDir, { recursive: true })
await mkdir(compositeDir, { recursive: true })

const user = {
  id: 'warm-sms-candidate-qa-admin',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'warm-sms-candidate-qa@example.test',
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

function candidateResponse(messageText) {
  const messageVersionKey = 'warm-sms-message:v1:42:qa-candidate'
  return {
    version: 'warm-outreach-sms-candidate-route/v1',
    outcome: 'created',
    message: 'SMS candidate queue row prepared for review. No SMS was sent and no Telnyx call was made.',
    candidate: {
      id: 'qa-sms-candidate-42',
      channel: 'sms',
      status: 'draft',
      createdAt: '2026-08-30T17:45:00.000Z',
      messageVersionKey,
      smsSendIdempotencyKey: `warm-sms-send:v1:qa-sms-candidate-42:42:${messageVersionKey}`,
      submittedEvidenceKey: `warm-sms-audit:v1:submitted:qa-sms-candidate-42:42:${messageVersionKey}`,
      approvalState: 'missing',
      submittedEvidenceRecorded: false,
      rawPhoneReturned: false,
      rawMessageBodyReturned: false,
    },
    candidateReview: {
      version: 'warm-outreach-sms-candidate-review/v1',
      state: 'candidate_exists',
      label: 'SMS candidate row exists',
      detail: 'Use the existing queue row for review. Live SMS still requires exact approval and provider activation.',
      queueArtifact: {
        id: 'qa-sms-candidate-42',
        channel: 'sms',
        status: 'draft',
        createdAt: '2026-08-30T17:45:00.000Z',
        messageVersionKey,
        smsSendIdempotencyKey: `warm-sms-send:v1:qa-sms-candidate-42:42:${messageVersionKey}`,
        submittedEvidenceKey: `warm-sms-audit:v1:submitted:qa-sms-candidate-42:42:${messageVersionKey}`,
        approvalState: 'missing',
        submittedEvidenceRecorded: false,
        rawPhoneReturned: false,
        rawMessageBodyReturned: false,
      },
      prerequisites: [
        ['phone_present', 'Phone present', 'passed', 'A phone reference exists on the contact record; raw phone is not returned.'],
        ['relationship_basis', 'Relationship basis', 'passed', 'Local relationship evidence supports manual SMS review.'],
        ['suppression_clear', 'Suppression clear', 'passed', 'No suppression blocker is recorded; operator must still confirm appropriateness.'],
        ['draft_text_available', 'Draft text', 'passed', `A short review draft is available (${messageText.length} chars).`],
        ['candidate_row', 'Candidate row', 'passed', 'Review queue row qa-sms-candidate-42.'],
      ].map(([key, label, status, detail]) => ({ key, label, status, detail })),
      blockedReasons: [],
      prepareAction: {
        route: '/api/admin/outreach/leads/[id]/sms-candidate',
        method: 'POST',
        enabledOnThisSurface: false,
        label: 'Candidate exists',
        detail: 'A candidate row already exists; select it for approval review before any future send gate.',
      },
      executionBoundary: {
        createsQueueArtifact: false,
        providerCallsEnabled: false,
        smsDeliveryEnabled: false,
        telnyxApiCalled: false,
        externalSendEnabled: false,
        slackDispatchEnabled: false,
        gmailActionEnabled: false,
        n8nDispatchEnabled: false,
        rawPhoneReturned: false,
        rawMessageBodyReturned: false,
        externalRequests: [],
      },
    },
    executionBoundary: {
      createsQueueArtifact: true,
      providerCallsEnabled: false,
      smsDeliveryEnabled: false,
      telnyxApiCalled: false,
      externalSendEnabled: false,
      slackDispatchEnabled: false,
      gmailActionEnabled: false,
      n8nDispatchEnabled: false,
      rawPhoneReturned: false,
      rawMessageBodyReturned: false,
      rawCredentialsReturned: false,
      environmentVariablesChanged: false,
      externalRequests: [],
    },
  }
}

async function installSafeRoutes(page, evidence) {
  const localOrigin = new URL(baseUrl).origin
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const requestUrl = request.url()
    const blockedHost = /slack\.com|gmail\.com|googleapis\.com|twilio\.com|telnyx\.com|messagebird\.com|linkedin\.com|facebook\.com|n8n/i.test(url.hostname)

    if (url.origin === localOrigin && url.pathname === candidatePath && request.method() === 'POST') {
      const body = JSON.parse(request.postData() || '{}')
      evidence.candidateRequests.push({
        url: requestUrl,
        method: request.method(),
        bodyChars: typeof body.messageText === 'string' ? body.messageText.length : 0,
        rawPhonePresent: /\+1?\d{7,}/.test(request.postData() || ''),
      })
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(candidateResponse(body.messageText || '')),
      })
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

    if (url.hostname === 'va.vercel-scripts.com') {
      await route.abort('blockedbyclient')
      return
    }

    if (blockedHost) {
      evidence.externalRequests.push(requestUrl)
      await route.abort('blockedbyclient')
      return
    }

    if (url.origin === localOrigin) {
      await route.continue()
      return
    }

    evidence.externalRequests.push(requestUrl)
    await route.abort('blockedbyclient')
  })
}

function isExpectedSyntheticConsoleNoise(text) {
  return /Failed to load resource: net::ERR_BLOCKED_BY_CLIENT\.Inspector/i.test(text)
    || /Failed to load resource: the server responded with a status of 401 \(Unauthorized\)/i.test(text)
}

async function openQaPage(browser, viewport, evidence) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const consoleErrors = []
  const ignoredConsoleErrors = []
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (isExpectedSyntheticConsoleNoise(text)) {
      ignoredConsoleErrors.push(text)
      return
    }
    consoleErrors.push(text)
  })
  await seedSession(page)
  await installSafeRoutes(page, evidence)
  const response = await page.goto(qaUrl, { waitUntil: 'networkidle' })
  if (response && response.status() >= 400) {
    throw new Error(`QA route returned HTTP ${response.status()}: ${qaUrl}`)
  }
  await page.locator('#warm-sms-readiness').waitFor({ timeout: 15_000 })
  await page.locator('#warm-sms-candidate-review').waitFor({ timeout: 15_000 })
  await page.locator('#warm-sms-readiness').scrollIntoViewIfNeeded()
  return { context, page, consoleErrors, ignoredConsoleErrors }
}

async function viewportEvidence(browser, name, viewport) {
  const evidence = {
    externalRequests: [],
    candidateRequests: [],
  }
  const qa = await openQaPage(browser, viewport, evidence)
  const beforePath = path.join(sourceDir, `${name}-before.png`)
  await qa.page.screenshot({ path: beforePath, fullPage: false })
  await qa.page.getByRole('button', { name: 'Prepare candidate' }).click()
  await qa.page.getByText('SMS candidate row exists').waitFor({ timeout: 10_000 })
  const afterPath = path.join(sourceDir, `${name}-after.png`)
  await qa.page.screenshot({ path: afterPath, fullPage: false })

  const checks = await qa.page.evaluate(() => {
    const text = document.body.innerText
    const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    return {
      hasCandidateCard: /SMS candidate row/i.test(text),
      hasReadyState: /Ready to prepare SMS candidate|SMS candidate row exists/i.test(text),
      hasCreatedReceipt: /No SMS was sent and no Telnyx call was made/i.test(text),
      hasQueueId: /qa-sms-candidate-42/i.test(text),
      hasApprovalMissing: /Approval: missing/i.test(text),
      hasSendEvidenceNone: /Send evidence: none/i.test(text),
      hasLiveBoundary: /No SMS was sent and no Telnyx call was made/i.test(text)
        && /Provider calls:\s*off/i.test(text)
        && /Live send:\s*off/i.test(text),
      hasNoLiveSendButton: !/Send live SMS/i.test(text),
      horizontalOverflow: overflow,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }
  })

  await qa.context.close()
  return {
    name,
    viewport,
    beforePath,
    afterPath,
    consoleErrors: qa.consoleErrors,
    ignoredConsoleErrors: qa.ignoredConsoleErrors,
    ...evidence,
    checks,
  }
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function compositeHtml(frames) {
  const slides = frames.map((frame, index) => `
    <section class="slide ${index === 0 ? 'active' : ''}">
      <div class="copy">
        <p class="eyebrow">Warm SMS candidate QA</p>
        <h1>${escapeHtml(frame.title)}</h1>
        <p><strong>Scenario:</strong> Operator opens the canonical warm outreach workroom for contact 42 and prepares an SMS candidate row for review.</p>
        <p><strong>Expected behavior:</strong> The page shows candidate state, creates/selects a draft queue artifact, and keeps live SMS unavailable.</p>
        <p><strong>Decision gate:</strong> Candidate row review and specific approval are required before any future provider path.</p>
        <p><strong>External-action boundary:</strong> Telnyx API off, SMS delivery off, Slack off, Gmail off, n8n off, raw phone hidden, externalRequests: 0.</p>
      </div>
      <img src="${escapeHtml(frame.src)}" alt="${escapeHtml(frame.title)}" />
    </section>
  `).join('\n')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; width: 1280px; height: 720px; overflow: hidden; background: #07111f; color: #f8fafc; font-family: Inter, Arial, sans-serif; }
    .slide { position: absolute; inset: 0; display: grid; grid-template-columns: 390px 1fr; gap: 22px; padding: 28px; opacity: 0; transition: opacity 360ms ease; }
    .slide.active { opacity: 1; }
    .copy { border: 1px solid rgba(148, 163, 184, 0.35); background: rgba(15, 23, 42, 0.92); border-radius: 8px; padding: 22px; }
    .eyebrow { margin: 0 0 12px; color: #93c5fd; font-size: 13px; text-transform: uppercase; letter-spacing: 0; font-weight: 700; }
    h1 { margin: 0 0 18px; font-size: 30px; line-height: 1.08; letter-spacing: 0; }
    p { margin: 0 0 14px; font-size: 18px; line-height: 1.38; color: #dbeafe; }
    strong { color: #fef3c7; }
    img { width: 100%; height: 100%; object-fit: contain; border: 1px solid rgba(148, 163, 184, 0.35); border-radius: 8px; background: #020617; }
  </style>
</head>
<body>
  ${slides}
  <script>
    const slides = [...document.querySelectorAll('.slide')];
    let i = 0;
    setInterval(() => {
      slides[i].classList.remove('active');
      i = (i + 1) % slides.length;
      slides[i].classList.add('active');
    }, 2500);
  </script>
</body>
</html>`
}

async function renderCompositeVideo(frames) {
  const htmlPath = path.join(compositeDir, 'warm-sms-candidate-review-qa.html')
  await writeFile(htmlPath, compositeHtml(frames))
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: compositeDir, size: { width: 1280, height: 720 } },
  })
  const page = await context.newPage()
  await page.goto(`file://${htmlPath}`)
  await page.waitForTimeout(8500)
  await context.close()
  const video = await page.video().path()
  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    video,
    '-vf',
    'format=yuv420p',
    '-movflags',
    '+faststart',
    mp4Path,
  ])
}

const browser = await chromium.launch()
try {
  const desktop = await viewportEvidence(browser, 'desktop-1440', { width: 1440, height: 1000 })
  const mobile = await viewportEvidence(browser, 'mobile-390', { width: 390, height: 844 })
  const frames = [
    { title: 'Desktop route before candidate preparation', src: desktop.beforePath },
    { title: 'Desktop route after no-send candidate preparation', src: desktop.afterPath },
    { title: 'Mobile route after no-send candidate preparation', src: mobile.afterPath },
  ]
  await renderCompositeVideo(frames)

  const receipt = {
    version: 'warm-sms-candidate-review-qa/v1',
    generatedAt: new Date().toISOString(),
    qaUrl,
    routeTested: qaPath,
    viewports: [desktop, mobile].map((item) => ({
      name: item.name,
      viewport: item.viewport,
      checks: item.checks,
      candidateRequests: item.candidateRequests,
      externalRequests: item.externalRequests,
      consoleErrors: item.consoleErrors,
      ignoredConsoleErrors: item.ignoredConsoleErrors,
      screenshots: {
        before: item.beforePath,
        after: item.afterPath,
      },
    })),
    scenario: 'Operator prepares a governed warm SMS candidate row from the existing warm outreach workroom.',
    expectedBehavior: 'Candidate row state is visible, prepare action records/selects a draft queue artifact only, and live SMS remains gated.',
    decisionGate: 'Specific candidate review and approval are still required before any future send path.',
    externalActionBoundary: {
      telnyxApiCalled: false,
      smsDeliveryEnabled: false,
      slackDispatchEnabled: false,
      gmailActionEnabled: false,
      n8nDispatchEnabled: false,
      rawPhoneReturned: false,
      rawMessageBodyReturned: false,
      externalRequests: [],
    },
    artifacts: {
      mp4: mp4Path,
    },
  }

  const failed = receipt.viewports.flatMap((item) => {
    const failures = []
    for (const [key, value] of Object.entries(item.checks)) {
      if (key === 'horizontalOverflow') {
        if (value) failures.push(`${item.name}:${key}`)
      } else if (typeof value === 'boolean' && !value) {
        failures.push(`${item.name}:${key}`)
      }
    }
    if (item.externalRequests.length > 0) failures.push(`${item.name}:externalRequests`)
    if (item.consoleErrors.length > 0) failures.push(`${item.name}:consoleErrors`)
    return failures
  })
  receipt.status = failed.length === 0 ? 'passed' : 'failed'
  receipt.failures = failed

  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
  if (failed.length > 0) {
    throw new Error(`Warm SMS candidate QA failed: ${failed.join(', ')}`)
  }
  console.log(JSON.stringify({
    status: 'passed',
    mp4Path,
    receiptPath,
    viewports: receipt.viewports.map((item) => ({
      name: item.name,
      horizontalOverflow: item.checks.horizontalOverflow,
      candidateRequests: item.candidateRequests.length,
      externalRequests: item.externalRequests.length,
    })),
  }, null, 2))
} finally {
  await browser.close()
}
