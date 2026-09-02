import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { config as loadEnv } from 'dotenv'

const execFileAsync = promisify(execFile)
const root = process.cwd()
loadEnv({ path: path.join(root, '.env.local'), quiet: true })

const outputDir = path.join(root, 'docs', 'warm-outreach-qa')
const qaDir = path.join(root, 'test-results', 'warm-manual-social-handoff-qa')
const sourceDir = path.join(qaDir, 'source')
const baseUrl = (process.env.QA_BASE_URL || 'http://127.0.0.1:3068').replace(/\/$/, '')
const qaPath = '/admin/outreach?tab=leads&filter=warm&id=42&contactId=42&qa=warm-slack-send-approval#warm-manual-social-handoff'
const qaUrl = new URL(qaPath, baseUrl).toString()
const mp4Path = path.join(outputDir, 'warm-manual-social-handoff-qa.mp4')
const receiptPath = path.join(outputDir, 'warm-manual-social-handoff-qa.json')

const screenshots = {
  mobile360: path.join(outputDir, 'warm-manual-social-handoff-mobile-360.png'),
  mobile390: path.join(outputDir, 'warm-manual-social-handoff-mobile-390.png'),
  mobile430: path.join(outputDir, 'warm-manual-social-handoff-mobile-430.png'),
  desktop1440: path.join(outputDir, 'warm-manual-social-handoff-desktop-1440.png'),
}

await mkdir(outputDir, { recursive: true })
await mkdir(sourceDir, { recursive: true })

const user = {
  id: 'warm-manual-social-handoff-qa-admin',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'warm-manual-social-handoff-qa@example.test',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-09-02T00:00:00.000Z',
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
  const urls = [process.env.NEXT_PUBLIC_SUPABASE_URL, 'https://example.supabase.co'].filter(Boolean)
  return [
    ...new Set([
      'sb-127-auth-token',
      ...urls
        .map((value) => {
          try {
            return `sb-${new URL(value).hostname.split('.')[0]}-auth-token`
          } catch {
            return null
          }
        })
        .filter(Boolean),
    ]),
  ]
}

async function seedSession(page) {
  await page.addInitScript(({ keys, storedSession }) => {
    for (const key of keys) window.localStorage.setItem(key, JSON.stringify(storedSession))
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value) => {
          window.__warmManualClipboardWrites = [
            ...(window.__warmManualClipboardWrites || []),
            String(value),
          ]
        },
      },
    })
  }, { keys: authStorageKeys(), storedSession: session })
}

async function installSafeRoutes(page, externalRequests, manualEvidenceApiResponses) {
  const localOrigin = new URL(baseUrl).origin
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (/\/api\/admin\/outreach\/leads\/[^/]+\/manual-social-handoff\b/i.test(url.pathname)) {
      const body = request.postDataJSON()
      const recordedAt = new Date().toISOString()
      const evidence = {
        version: 'warm-outreach-manual-social-evidence/v1',
        status: 'manual_sent_recorded',
        contactId: '42',
        channel: body.channel,
        messageVersionKey: body.messageVersionKey,
        manualHandoffKey: body.manualHandoffKey,
        manualEvidenceKey: body.manualEvidenceKey,
        recordedAt,
        operatorNote: body.operatorNote,
        source: {
          table: 'contact_communications',
          id: 'qa-manual-communication-1',
          sourceSystem: 'manual',
          sourceId: body.manualEvidenceKey,
        },
        privacyBoundary: {
          storesRawMessageBody: false,
          storesRawContactDetails: false,
          storesScreenshot: false,
          storesProviderIdentifiers: false,
        },
        executionBoundary: {
          providerCallsEnabled: false,
          externalSendEnabled: false,
          linkedinApiEnabled: false,
          facebookApiEnabled: false,
          phoneAccessEnabled: false,
          smsDeliveryEnabled: false,
          gmailDraftCreationEnabled: false,
          slackDispatchEnabled: false,
          n8nDispatchEnabled: false,
          externalRequests: [],
        },
      }
      const response = {
        outcome: 'recorded',
        duplicatePrevented: false,
        evidence,
        executionBoundary: {
          providerCallsEnabled: false,
          externalSendEnabled: false,
          linkedinApiCalled: false,
          facebookApiCalled: false,
          phoneAccessCalled: false,
          smsDeliveryEnabled: false,
          gmailDraftCreated: false,
          slackDispatchEnabled: false,
          n8nDispatchEnabled: false,
          externalRequests: [],
        },
      }
      manualEvidenceApiResponses.push({
        method: request.method(),
        url: request.url(),
        requestBody: {
          channel: body.channel,
          messageVersionKey: body.messageVersionKey,
          manualHandoffKey: body.manualHandoffKey,
          manualEvidenceKey: body.manualEvidenceKey,
          operatorNote: body.operatorNote,
        },
        response,
      })
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      })
      return
    }

    const localProviderPath =
      /\/api\/admin\/outreach\/[^/]+\/(?:slack-send-approval|gmail-user-draft|gmail-user-send|gmail-draft-canary)\b/i.test(url.pathname) ||
      /\/api\/admin\/outreach\/gmail-response-import\b/i.test(url.pathname) ||
      /\/api\/admin\/outreach\/leads\/[^/]+\/(?:sms-candidate|sms-telnyx-no-send-canary|sms-telnyx-live-send)\b/i.test(url.pathname) ||
      /\/api\/admin\/outreach\/[^/]+\/(?:sms|text|provider-send|manual-send)\b/i.test(url.pathname)
    const providerHost =
      /slack\.com|gmail\.com|googleapis\.com|twilio\.com|telnyx\.com|messagebird\.com|linkedin\.com|facebook\.com|n8n/i.test(url.hostname)

    if (providerHost || localProviderPath) {
      externalRequests.push({ method: request.method(), url: request.url() })
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

    externalRequests.push({ method: request.method(), url: request.url() })
    await route.abort('blockedbyclient')
  })
}

async function openQaPage(browser, viewport, recordVideo = false) {
  const externalRequests = []
  const manualEvidenceApiResponses = []
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    ...(recordVideo ? { recordVideo: { dir: sourceDir, size: viewport } } : {}),
  })
  const page = await context.newPage()
  await seedSession(page)
  await installSafeRoutes(page, externalRequests, manualEvidenceApiResponses)
  const response = await page.goto(qaUrl, { waitUntil: 'networkidle' })
  if (response && response.status() >= 400) {
    throw new Error(`QA route returned HTTP ${response.status()}: ${qaUrl}`)
  }
  const overlay = await page.locator('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay').count()
  if (overlay > 0) throw new Error('Framework error overlay is visible on the QA route.')
  await page.locator('#warm-manual-social-handoff').waitFor({ timeout: 15_000 })
  return { context, page, externalRequests, manualEvidenceApiResponses }
}

async function verifyManualHandoff(page) {
  const handoff = page.locator('#warm-manual-social-handoff')
  await handoff.scrollIntoViewIfNeeded()
  const checks = await page.evaluate(() => {
    const text = document.body.innerText
    const handoff = document.querySelector('#warm-manual-social-handoff')
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && window.getComputedStyle(element).visibility !== 'hidden'
    }
    return {
      hasHandoff: visible(handoff),
      hasRoute: /Manual social handoff/i.test(text),
      hasChannels: /LinkedIn: manual ready/i.test(text) &&
        /Facebook: manual ready/i.test(text) &&
        /Phone contact: manual ready/i.test(text),
      hasCurrentCta: /Copy LinkedIn text/i.test(text),
      hasNoEgress: /External requests: 0/i.test(text) && /Provider calls: off/i.test(text),
      hasEvidenceBoundary: /No raw message body, phone number, screenshots, provider send, or private reply content/i.test(text),
      hasAuditKeys: /warm-outreach:manual-evidence:v1:qa-linkedin-42/i.test(text),
      hasCanonicalSurface: /Relationship packet/i.test(text) && /Manual social handoff/i.test(text),
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }
  })
  return {
    ...checks,
    horizontalOverflow: checks.scrollWidth > checks.clientWidth,
  }
}

async function viewportEvidence(browser, name, viewport, screenshotPath) {
  const qa = await openQaPage(browser, viewport)
  const checks = await verifyManualHandoff(qa.page)
  await qa.page.screenshot({ path: screenshotPath, fullPage: true })
  await qa.context.close()
  return {
    name,
    viewport,
    screenshotPath,
    checks,
    externalRequests: qa.externalRequests,
  }
}

async function addSideText(page) {
  await page.addStyleTag({
    content: `
      body { padding-left: 380px !important; }
      #qa-side-text {
        position: fixed;
        inset: 0 auto 0 0;
        z-index: 2147483647;
        width: 356px;
        box-sizing: border-box;
        padding: 24px 22px;
        background: #07111f;
        color: #e5eef9;
        border-right: 1px solid rgba(148, 163, 184, .35);
        font: 14px/1.45 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #qa-side-text h2 { margin: 0 0 12px; font-size: 18px; line-height: 1.2; letter-spacing: 0; }
      #qa-side-text h3 { margin: 16px 0 6px; font-size: 12px; letter-spacing: 0; text-transform: uppercase; color: #f7d56b; }
      #qa-side-text p { margin: 0; color: #cbd5e1; }
      #qa-side-text ul { margin: 6px 0 0; padding-left: 18px; color: #cbd5e1; }
      #qa-side-text li { margin: 5px 0; }
    `,
  })
  await page.evaluate(() => {
    const panel = document.createElement('aside')
    panel.id = 'qa-side-text'
    panel.innerHTML = `
      <h2>warm-manual-social-handoff QA</h2>
      <h3>Scenario</h3>
      <p>Operator opens the warm selected-contact workroom and prepares a manual LinkedIn handoff.</p>
      <h3>Expected</h3>
      <ul>
        <li>LinkedIn, Facebook, and phone-contact copy previews are visibly manual.</li>
        <li>The current CTA moves from copy to record evidence to recorded.</li>
        <li>The repeated evidence action disappears after local evidence is recorded.</li>
      </ul>
      <h3>Decision Gate</h3>
      <p>Captain review and Vambah human QA decide whether this copy-and-record workflow is ready.</p>
      <h3>External Boundary</h3>
      <p>No LinkedIn, Facebook, phone, SMS, Gmail, Slack, n8n, scheduling, polling, or provider API call.</p>
    `
    document.body.appendChild(panel)
  })
}

async function recordWalkthrough(browser) {
  const qa = await openQaPage(browser, { width: 1280, height: 720 }, true)
  await addSideText(qa.page)
  const handoff = qa.page.locator('#warm-manual-social-handoff')
  await handoff.scrollIntoViewIfNeeded()
  await qa.page.waitForTimeout(600)
  await handoff.getByRole('button', { name: 'Copy LinkedIn text' }).click()
  await handoff.getByText(/text copied/i).waitFor({ timeout: 10_000 })
  await handoff.getByRole('textbox', { name: 'Operator note' }).fill(
    'Copied into LinkedIn manually after reviewing the relationship basis.',
  )
  await qa.page.waitForTimeout(500)
  await handoff.getByRole('button', { name: 'Record manual evidence' }).click()
  await handoff.getByRole('button', { name: 'Evidence recorded' }).waitFor({ timeout: 10_000 })
  const afterRecord = await qa.page.evaluate(() => {
    const writes = window.__warmManualClipboardWrites || []
    const text = document.body.innerText
    const handoff = document.querySelector('#warm-manual-social-handoff')
    return {
      clipboardWrites: writes.length,
      evidenceRecorded: /Portfolio evidence recorded/i.test(text),
      apiBackedEvidenceResponse: /Portfolio recorded this manual evidence/i.test(text),
      repeatEvidenceButtonVisible: [...(handoff?.querySelectorAll('button') || [])].some((button) =>
        (button.textContent || '').trim() === 'Record manual evidence',
      ),
      externalRequestsVisible: /External requests: 0/i.test(text),
    }
  })
  await qa.page.waitForTimeout(1200)
  const video = qa.page.video()
  await qa.context.close()
  const rawVideoPath = video ? await video.path() : null
  if (rawVideoPath) {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      rawVideoPath,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      mp4Path,
    ])
  }
  return {
    rawVideoPath,
    mp4Path,
    afterRecord,
    externalRequests: qa.externalRequests,
    manualEvidenceApiResponses: qa.manualEvidenceApiResponses,
  }
}

const browser = await chromium.launch({ headless: true })
try {
  const viewportResults = []
  for (const [name, viewport, screenshotPath] of [
    ['mobile360', { width: 360, height: 844 }, screenshots.mobile360],
    ['mobile390', { width: 390, height: 844 }, screenshots.mobile390],
    ['mobile430', { width: 430, height: 932 }, screenshots.mobile430],
    ['desktop1440', { width: 1440, height: 960 }, screenshots.desktop1440],
  ]) {
    viewportResults.push(await viewportEvidence(browser, name, viewport, screenshotPath))
  }

  const video = await recordWalkthrough(browser)
  const externalRequests = [
    ...viewportResults.flatMap((result) => result.externalRequests),
    ...video.externalRequests,
  ]
  const pass = {
    allViewportsRendered: viewportResults.every((result) =>
      result.checks.hasHandoff &&
      result.checks.hasRoute &&
      result.checks.hasChannels &&
      result.checks.hasCurrentCta &&
      result.checks.hasNoEgress &&
      result.checks.hasEvidenceBoundary &&
      result.checks.hasAuditKeys &&
      result.checks.hasCanonicalSurface,
    ),
    noHorizontalOverflow: viewportResults.every((result) => !result.checks.horizontalOverflow),
    noExternalRequests: externalRequests.length === 0,
    localEvidenceRecorded:
      video.afterRecord.clipboardWrites === 1 &&
      video.afterRecord.evidenceRecorded &&
      !video.afterRecord.repeatEvidenceButtonVisible &&
      video.afterRecord.externalRequestsVisible,
    apiBackedEvidenceResponse:
      video.afterRecord.apiBackedEvidenceResponse &&
      video.manualEvidenceApiResponses.length === 1 &&
      video.manualEvidenceApiResponses.every((item) =>
        item.response.evidence?.status === 'manual_sent_recorded' &&
        item.response.evidence?.privacyBoundary?.storesRawMessageBody === false &&
        item.response.evidence?.privacyBoundary?.storesRawContactDetails === false &&
        item.response.executionBoundary?.externalRequests?.length === 0
      ),
  }
  const receipt = {
    version: 'warm-manual-social-handoff-qa/v1',
    createdAt: new Date().toISOString(),
    route: qaUrl,
    scenario:
      'Operator opens /admin/outreach warm selected-contact workroom and prepares manual LinkedIn/Facebook/phone-contact handoff from synthetic warm relationship context.',
    expectedBehavior: [
      'Manual social handoff appears on the canonical selected-contact relationship packet surface.',
      'LinkedIn, Facebook, and phone-contact previews are visibly manual and no-egress.',
      'Primary CTA moves from copy text to record manual evidence to recorded state.',
      'After the API-backed evidence response returns, the repeat evidence action is no longer presented.',
    ],
    decisionGate:
      'Captain QA and Vambah human QA only. Provider automation and external sending require separate explicit future gates.',
    externalActionBoundary:
      'No LinkedIn, Facebook, phone, SMS, Gmail, Slack, n8n, scheduling, polling, provider API, or production-data mutation was authorized or executed.',
    screenshots,
    mp4Path,
    rawVideoPath: video.rawVideoPath,
    viewportResults,
    video,
    pass,
    externalRequests,
  }

  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)

  if (!pass.allViewportsRendered || !pass.noHorizontalOverflow || !pass.localEvidenceRecorded || !pass.apiBackedEvidenceResponse) {
    throw new Error(`Manual social handoff QA failed: ${JSON.stringify(pass, null, 2)}`)
  }
  if (externalRequests.length > 0) {
    throw new Error(`Unexpected external/provider request(s): ${JSON.stringify(externalRequests, null, 2)}`)
  }

  console.log(JSON.stringify({
    ok: true,
    receiptPath,
    mp4Path,
    route: qaUrl,
    externalRequests,
    pass,
  }, null, 2))
} finally {
  await browser.close()
}
