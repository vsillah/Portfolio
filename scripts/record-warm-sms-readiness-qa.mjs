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
const qaDir = path.join(root, 'test-results', 'warm-sms-provider-selection-qa')
const sourceDir = path.join(qaDir, 'source')
const compositeDir = path.join(qaDir, 'composite')
const baseUrl = (process.env.QA_BASE_URL || 'http://127.0.0.1:3027').replace(/\/$/, '')
const contactId = 42
const qaPath = `/admin/outreach?tab=leads&filter=warm&id=${contactId}&contactId=${contactId}&qa=warm-slack-send-approval#warm-sms-readiness`
const qaUrl = new URL(qaPath, baseUrl).toString()
const mp4Path = path.join(outputDir, 'warm-sms-provider-selection-qa.mp4')
const receiptPath = path.join(outputDir, 'warm-sms-provider-selection-qa.json')

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
    const blockedHost = /slack\.com|gmail\.com|googleapis\.com|twilio\.com|telnyx\.com|messagebird\.com|linkedin\.com|facebook\.com|n8n/i.test(url.hostname)

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
  await page.locator('#warm-sms-provider-readiness').waitFor({ timeout: 15_000 })
  return { context, page, unexpectedRequests }
}

async function viewportEvidence(browser, name, viewport) {
  const qa = await openQaPage(browser, viewport)
  await qa.page.locator('#warm-sms-readiness').scrollIntoViewIfNeeded()
  const contentChecks = await qa.page.evaluate(() => {
    const provider = document.querySelector('#warm-sms-provider-readiness')
    const providerDetails = document.querySelector('[data-testid="warm-sms-provider-details"]')
    const smsSection = document.querySelector('#warm-sms-readiness')
    const manualLoop = document.querySelector('#warm-sms-manual-loop')
    const criticalBoundaries = [...document.querySelectorAll('[data-sms-provider-critical-boundary]')]
    const visibleText = document.body.innerText
    const detailsText = providerDetails?.textContent ?? ''
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && window.getComputedStyle(element).visibility !== 'hidden'
    }
    return {
      hasSmsReadiness: /Warm SMS manual readiness/i.test(visibleText),
      hasManualBoundary: /Provider calls: off/i.test(visibleText),
      hasApprovalCopy: /Approval records manual.?send readiness only/i.test(visibleText),
      hasManualLoop: /Manual SMS operating loop/i.test(visibleText),
      hasEvidenceCapture: /Manual send evidence/i.test(visibleText),
      hasResponseOutcome: /Manual response outcome/i.test(visibleText),
      hasProviderReadiness: /Warm SMS provider readiness/i.test(visibleText),
      hasProviderDisabled: /SMS provider configured but disabled/i.test(visibleText),
      hasConsentAudit: /Consent audit:/i.test(detailsText),
      hasActivationArchitecture: /activation architecture/i.test(visibleText),
      hasTransportContract:
        /Provider transport contract/i.test(visibleText) &&
        /SMS transport configured-ready; send remains off/i.test(visibleText),
      hasTransportNoSendCopy:
        /does not send SMS, activate a provider, mutate env, or call an external service/i.test(visibleText),
      hasTransportSummary:
        /Selected provider/i.test(visibleText) &&
        /Custom disabled adapter/i.test(visibleText) &&
        /Sender: ready\. Capabilities: 6\/6/i.test(visibleText),
      hasNoSendCanary:
        /No-send canary simulation/i.test(visibleText) &&
        /No-send canary can route configuration without SMS delivery/i.test(visibleText) &&
        /would route no send/i.test(visibleText),
      hasNoSendCanaryBoundary:
        /Provider calls: off\. SMS delivery: off\. Env changed: no\. External requests: 0/i.test(visibleText),
      hasActivationChecklist:
        /Transport configured/i.test(visibleText) &&
        /Provider disabled/i.test(visibleText) &&
        /No-send canary eligible/i.test(visibleText) &&
        /Live send eligible/i.test(visibleText),
      hasDeliveryPlaceholder:
        /Delivery confirmation/i.test(visibleText) &&
        /Provider message ID: placeholder only/i.test(visibleText) &&
        /Delivery status: placeholder only/i.test(visibleText),
      hasActivationSummary:
        /capabilities 6\/6 verified/i.test(visibleText) &&
        /idempotency contract only/i.test(visibleText),
      hasSetupSummary:
        /Setup path/i.test(visibleText) &&
        /Config validation/i.test(visibleText) &&
        /Credentials read: no · env changed: no/i.test(visibleText) &&
        /Setup gate/i.test(visibleText),
      hasProviderSelectionPlan:
        /Provider selection recommendation/i.test(visibleText) &&
        /Recommended: Telnyx Messaging/i.test(visibleText) &&
        /Planning only/i.test(visibleText),
      hasProviderSelectionBoundary:
        /choose owned provider\/account and redacted sender, callback, signing, and secret-location refs/i.test(visibleText) &&
        /Keep disabled: execution flag, provider API, live SMS, production env, contact-data transmission/i.test(visibleText),
      hasProviderSelectionComparison:
        /Provider comparison/i.test(detailsText) &&
        /Selection status: provider selection and configuration planning only/i.test(detailsText) &&
        /Next approval: explicit sms provider activation approval/i.test(detailsText),
      hasProviderSelectionCandidateCoverage:
        /Twilio Messaging · fallback/i.test(detailsText) &&
        /Telnyx Messaging · recommended/i.test(detailsText) &&
        /MessageBird \/ Bird · fallback/i.test(detailsText) &&
        /Custom disabled adapter · review only/i.test(detailsText),
      hasProviderSelectionNoSendBoundary:
        /Credential\/env refs/i.test(detailsText) &&
        /WARM_SMS_IDEMPOTENCY_NAMESPACE/i.test(detailsText) &&
        /Provider calls: off\. SMS delivery: off\. Raw credentials returned: no/i.test(detailsText),
      hasActivationDetails:
        /Provider capability requirements/i.test(detailsText) &&
        /Idempotency contract · not implemented/i.test(detailsText) &&
        /Audit evidence contract/i.test(detailsText) &&
        /Blocked recovery path/i.test(detailsText),
      hasSetupDetails:
        /Provider setup path/i.test(detailsText) &&
        /Environment and config validation/i.test(detailsText) &&
        /Operator setup path/i.test(detailsText),
      hasTransportDetails:
        /Transport config parse · redacted/i.test(detailsText) &&
        /External requests: 0/i.test(detailsText) &&
        /Credentials read: no/i.test(detailsText) &&
        /Environment variables changed: no/i.test(detailsText),
      hasSetupEnvBoundary:
        /ENABLE_WARM_SMS_PROVIDER_EXECUTION/i.test(detailsText) &&
        /Raw value returned: no/i.test(detailsText) &&
        /Provider settings changed: no/i.test(detailsText) &&
        /Feature flag enabled: no/i.test(detailsText),
      hasFutureSendBoundary:
        /Generic proceed: rejected/i.test(visibleText) &&
        /Approval: per-recipient required/i.test(visibleText) &&
        /Live send: off/i.test(visibleText),
      hasManualSeparation:
        Boolean(provider && manualLoop && !provider.contains(manualLoop)) && visible(manualLoop),
      providerDetailsCollapsed: providerDetails instanceof HTMLDetailsElement && !providerDetails.open,
      providerCheckCount: providerDetails?.querySelectorAll('[data-sms-provider-check]').length ?? 0,
      providerCapabilityCount:
        providerDetails?.querySelectorAll('[data-sms-provider-capability]').length ?? 0,
      providerSetupCandidateCount:
        providerDetails?.querySelectorAll('[data-sms-provider-setup-candidate]').length ?? 0,
      providerSelectionCandidateCount:
        providerDetails?.querySelectorAll('[data-sms-provider-selection-candidate]').length ?? 0,
      providerConfigItemCount:
        providerDetails?.querySelectorAll('[data-sms-provider-config-item]').length ?? 0,
      hasIdempotencyModel:
        Boolean(providerDetails?.querySelector('[data-sms-idempotency-model]')),
      hasRecoveryPath:
        Boolean(providerDetails?.querySelector('[data-sms-recovery-path]')),
      criticalBoundaryCount: criticalBoundaries.length,
      criticalBoundariesVisible: criticalBoundaries.every(visible),
      pageHeight: document.documentElement.scrollHeight,
      smsSectionHeight: smsSection instanceof HTMLElement
        ? Math.round(smsSection.getBoundingClientRect().height)
        : null,
      providerSectionHeight: provider instanceof HTMLElement
        ? Math.round(provider.getBoundingClientRect().height)
        : null,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }
  })
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
  const screenshotPath = path.join(outputDir, `warm-sms-provider-selection-${name}.png`)
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
    hasActivationArchitecture: contentChecks.hasActivationArchitecture,
    hasTransportContract: contentChecks.hasTransportContract,
    hasTransportNoSendCopy: contentChecks.hasTransportNoSendCopy,
    hasTransportSummary: contentChecks.hasTransportSummary,
    hasNoSendCanary: contentChecks.hasNoSendCanary,
    hasNoSendCanaryBoundary: contentChecks.hasNoSendCanaryBoundary,
    hasActivationChecklist: contentChecks.hasActivationChecklist,
    hasDeliveryPlaceholder: contentChecks.hasDeliveryPlaceholder,
    hasActivationSummary: contentChecks.hasActivationSummary,
    hasSetupSummary: contentChecks.hasSetupSummary,
    hasProviderSelectionPlan: contentChecks.hasProviderSelectionPlan,
    hasProviderSelectionBoundary: contentChecks.hasProviderSelectionBoundary,
    hasProviderSelectionComparison: contentChecks.hasProviderSelectionComparison,
    hasProviderSelectionCandidateCoverage: contentChecks.hasProviderSelectionCandidateCoverage,
    hasProviderSelectionNoSendBoundary: contentChecks.hasProviderSelectionNoSendBoundary,
    hasActivationDetails: contentChecks.hasActivationDetails,
    hasSetupDetails: contentChecks.hasSetupDetails,
    hasTransportDetails: contentChecks.hasTransportDetails,
    hasSetupEnvBoundary: contentChecks.hasSetupEnvBoundary,
    hasFutureSendBoundary: contentChecks.hasFutureSendBoundary,
    hasManualSeparation: contentChecks.hasManualSeparation,
    providerDetailsCollapsed: contentChecks.providerDetailsCollapsed,
    providerCheckCount: contentChecks.providerCheckCount,
    providerCapabilityCount: contentChecks.providerCapabilityCount,
    providerSetupCandidateCount: contentChecks.providerSetupCandidateCount,
    providerSelectionCandidateCount: contentChecks.providerSelectionCandidateCount,
    providerConfigItemCount: contentChecks.providerConfigItemCount,
    hasIdempotencyModel: contentChecks.hasIdempotencyModel,
    hasRecoveryPath: contentChecks.hasRecoveryPath,
    criticalBoundaryCount: contentChecks.criticalBoundaryCount,
    criticalBoundariesVisible: contentChecks.criticalBoundariesVisible,
    pageHeight: contentChecks.pageHeight,
    smsSectionHeight: contentChecks.smsSectionHeight,
    providerSectionHeight: contentChecks.providerSectionHeight,
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

async function smsFrame(
  browser,
  fileName,
  focusSelector,
  action,
  viewport = { width: 390, height: 844 },
) {
  const qa = await openQaPage(browser, viewport)
  const card = qa.page.locator('#warm-sms-readiness')
  if (action) await action(card)
  const focus = qa.page.locator(focusSelector)
  await focus.scrollIntoViewIfNeeded()
  const screenshotPath = path.join(sourceDir, fileName)
  await focus.screenshot({ path: screenshotPath })
  await qa.context.close()
  return { screenshotPath, unexpectedRequests: qa.unexpectedRequests }
}

async function openActivationDetails(card) {
  await card.getByText('Activation requirements and audit evidence').click()
  await card.getByTestId('warm-sms-provider-details').evaluate((element) => {
    if (!(element instanceof HTMLDetailsElement) || !element.open) {
      throw new Error('Provider readiness details did not open.')
    }
  })
}

const browser = await chromium.launch()
const frameResults = []
frameResults.push(await smsFrame(browser, '01-transport-summary.png', '[data-sms-transport-readiness]', null))
frameResults.push(await smsFrame(browser, '02-activation-summary.png', '#warm-sms-provider-readiness', null))
frameResults.push(await smsFrame(browser, '03-provider-selection-plan.png', '[data-sms-provider-selection-plan]', null))
frameResults.push(await smsFrame(
  browser,
  '04-provider-selection-comparison.png',
  '[data-sms-provider-selection-comparison]',
  openActivationDetails,
  { width: 768, height: 1024 },
))
frameResults.push(await smsFrame(
  browser,
  '05-transport-config-redacted.png',
  '[data-sms-transport-config-items]',
  openActivationDetails,
  { width: 768, height: 1024 },
))
frameResults.push(await smsFrame(
  browser,
  '06-provider-setup-path.png',
  '[data-sms-provider-setup-path]',
  openActivationDetails,
  { width: 768, height: 1024 },
))
frameResults.push(await smsFrame(
  browser,
  '07-provider-configuration.png',
  '[data-sms-provider-configuration]',
  openActivationDetails,
  { width: 768, height: 1024 },
))
frameResults.push(await smsFrame(
  browser,
  '08-capability-requirements.png',
  '[data-sms-capability-requirements]',
  openActivationDetails,
  { width: 768, height: 1024 },
))
frameResults.push(await smsFrame(
  browser,
  '09-idempotency-send-authority.png',
  '[data-sms-send-contract]',
  openActivationDetails,
  { width: 768, height: 1024 },
))
frameResults.push(await smsFrame(
  browser,
  '10-audit-recovery.png',
  '[data-sms-audit-recovery]',
  openActivationDetails,
  { width: 768, height: 1024 },
))
frameResults.push(await smsFrame(browser, '11-sms-approved-copy.png', '#warm-sms-manual-decision', async (card) => {
  await card.getByRole('button', { name: 'Approve', exact: true }).click()
  await card.getByRole('button', { name: 'Copy approved draft' }).click()
  await card.getByText('Approved for manual use').waitFor({ timeout: 10_000 })
}))
frameResults.push(await smsFrame(browser, '12-sms-suppressed-stop.png', '#warm-sms-manual-response', async (card) => {
  await card.getByRole('button', { name: 'Approve', exact: true }).click()
  await card.getByRole('button', { name: 'Prepare manual use' }).click()
  await card.getByLabel('Operator note').fill('Contact asked not to receive text messages.')
  await card.getByRole('button', { name: 'Record manual evidence' }).click()
  await card.getByLabel('Manual SMS response outcome').selectOption('stop_opt_out')
  await card.getByText('SMS prompts: suppressed').waitFor({ timeout: 10_000 })
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
          <div class="eyebrow">Warm SMS Provider Selection QA</div>
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
    title: 'Transport contract is compact',
    scenario: 'The synthetic contact has reviewed consent evidence and a disabled SMS provider transport model inside the existing warm outreach card.',
    expected: 'Portfolio shows the selected provider, sender status, capability count, idempotency namespace, and delivery confirmation placeholders.',
    gate: 'This phase does not send SMS, activate a provider, mutate env, or call an external service.',
  },
  {
    source: frameResults[1].screenshotPath,
    title: 'Setup and activation readiness stays explicit',
    scenario: 'The synthetic contact has reviewed consent evidence and a disabled SMS provider model with complete local no-send canary prerequisites.',
    expected: 'Portfolio names the provider path, shows verified disabled config status, reports 6/6 verified capabilities, and keeps deeper evidence collapsed.',
    gate: 'This activation packet is canary-ready only. Provider calls, SMS delivery, and environment changes remain off.',
  },
  {
    source: frameResults[2].screenshotPath,
    title: 'Provider recommendation is explicit',
    scenario: 'The operator reviews the existing warm outreach contact surface before any SMS provider is activated.',
    expected: 'Portfolio recommends Telnyx for disabled setup review, keeps the Vambah-owned setup step compact, and names what must stay disabled.',
    gate: 'This is provider-selection planning only. No credentials, provider requests, SMS sends, environment changes, or contact-data transmission occur.',
  },
  {
    source: frameResults[3].screenshotPath,
    title: 'Provider comparison stays collapsed',
    scenario: 'The operator opens the existing activation details to compare Twilio, Telnyx, Bird, and the custom disabled adapter.',
    expected: 'Every provider row covers capability fit, setup work, consent/suppression compatibility, delivery callbacks, opt-out, idempotency, credential/env references, no-send validation, and blockers.',
    gate: 'Candidate comparison does not choose live activation. External requests remain 0 and raw credentials are never returned.',
  },
  {
    source: frameResults[4].screenshotPath,
    title: 'Transport parsing is redacted',
    scenario: 'The operator opens the drill-in to review transport config parsing without revealing credential, sender, adapter, or environment values.',
    expected: 'The redacted parse reports blockers and no-egress proof: external requests 0, credentials read no, environment variables changed no.',
    gate: 'Config parsing is evidence only. It does not touch env, secrets, providers, Slack, Gmail, n8n, or production data.',
  },
  {
    source: frameResults[5].screenshotPath,
    title: 'Provider setup path is a review choice',
    scenario: 'The operator opens the setup drill-in to compare candidate SMS paths without choosing live activation.',
    expected: 'Twilio, Telnyx, MessageBird, and a custom disabled adapter appear as setup candidates. Every candidate keeps external calls off.',
    gate: 'Choosing or preparing a path is not credential access, environment mutation, provider activation, or send authority.',
  },
  {
    source: frameResults[6].screenshotPath,
    title: 'Provider choice and configuration stay explicit',
    scenario: 'The operator opens the activation drill-in to review the selected synthetic adapter and its disabled configuration summary.',
    expected: 'The provider choice is architecture evidence only. The summary says credentials were not read and environment values were not changed.',
    gate: 'Configuration remains planned and disabled. Provider execution is still unavailable.',
  },
  {
    source: frameResults[7].screenshotPath,
    title: 'Capability evidence supports no-send canary review',
    scenario: 'The selected provider must satisfy outbound submission, delivery callbacks, inbound opt-out handling, sender compliance, idempotency, and no-send testing.',
    expected: 'All six synthetic requirements are verified for the no-send canary while the provider stays disabled.',
    gate: 'Synthetic capability evidence supports local routing review only. The packet still cannot send SMS.',
  },
  {
    source: frameResults[8].screenshotPath,
    title: 'Send authority and dedupe remain separate',
    scenario: 'The future contract binds contact, SMS channel, message version, current per-recipient approval, and a stable idempotency key.',
    expected: 'A duplicate returns existing attempt evidence without resending. Generic proceed remains rejected.',
    gate: 'The idempotency model is contract-only. No route, feature flag, provider call, or SMS send is implemented.',
  },
  {
    source: frameResults[9].screenshotPath,
    title: 'Audit and recovery are ordered',
    scenario: 'The operator can see evidence required before activation, before a future send, and after a provider attempt, plus the exact recovery sequence.',
    expected: 'The audit packet excludes raw phone and message body. The recovery path ends at a current per-recipient authorization gate.',
    gate: 'No provider, SMS, Slack, Gmail, n8n, migration, environment, deployment, or production-data action runs.',
  },
  {
    source: frameResults[10].screenshotPath,
    title: 'Manual approval stays separate',
    scenario: 'The operator approves the existing manual SMS text and uses the local copy affordance.',
    expected: 'Manual approval changes only the PR #882 loop. It does not satisfy provider draft approval or future send authorization.',
    gate: 'The copied text is for one-to-one manual use outside Portfolio. Provider execution remains fail-closed.',
  },
  {
    source: frameResults[11].screenshotPath,
    title: 'Stop outcome suppresses SMS',
    scenario: 'The operator records a stop or opt-out outcome from the existing manual SMS thread.',
    expected: 'The manual card fails closed and suppresses future SMS prompts for this contact.',
    gate: 'Suppression has precedence. No copy, provider draft, activation, or future send review should continue.',
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
  '-t',
  String(repeatedFrames.length),
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
if (viewportResults.some((item) => !item.hasSmsReadiness || !item.hasApprovalCopy || !item.hasManualLoop || !item.hasEvidenceCapture || !item.hasResponseOutcome || !item.hasProviderReadiness || !item.hasProviderDisabled || !item.hasConsentAudit || !item.hasActivationArchitecture || !item.hasTransportContract || !item.hasTransportNoSendCopy || !item.hasTransportSummary || !item.hasNoSendCanary || !item.hasNoSendCanaryBoundary || !item.hasActivationChecklist || !item.hasDeliveryPlaceholder || !item.hasActivationSummary || !item.hasSetupSummary || !item.hasProviderSelectionPlan || !item.hasProviderSelectionBoundary || !item.hasProviderSelectionComparison || !item.hasProviderSelectionCandidateCoverage || !item.hasProviderSelectionNoSendBoundary || !item.hasActivationDetails || !item.hasSetupDetails || !item.hasTransportDetails || !item.hasSetupEnvBoundary || !item.hasFutureSendBoundary || !item.hasManualSeparation || !item.providerDetailsCollapsed || item.providerCapabilityCount !== 6 || item.providerSetupCandidateCount !== 4 || item.providerSelectionCandidateCount !== 4 || item.providerConfigItemCount !== 6 || !item.hasIdempotencyModel || !item.hasRecoveryPath || item.criticalBoundaryCount !== 5 || !item.criticalBoundariesVisible)) {
  throw new Error(`A viewport missed compact SMS provider-selection, transport/setup/activation readiness, no-send copy, collapsed requirements, setup details, config validation, idempotency, recovery, visible critical boundaries, manual separation, loop, evidence, response, or approval-boundary copy: ${JSON.stringify(viewportResults, null, 2)}`)
}
if (viewportResults.some((item) => !item.allManualInputsUseDarkMode)) {
  throw new Error(`A viewport rendered a manual SMS input with light-mode styling: ${JSON.stringify(viewportResults, null, 2)}`)
}
const baselineMobile390PageHeight = 12_457
const maxMobile390PageHeight = baselineMobile390PageHeight + 3000
const mobile390 = viewportResults.find((item) => item.name === 'mobile-390')
if (!mobile390 || mobile390.pageHeight > maxMobile390PageHeight) {
  throw new Error(`The provider-selection summary exceeded the ${maxMobile390PageHeight}px compact-page budget at 390px: ${JSON.stringify(mobile390, null, 2)}`)
}
const oversizedMobileProviderSections = viewportResults.filter((item) => (
  item.name.startsWith('mobile-') &&
  (item.providerSectionHeight === null || item.providerSectionHeight > 2200)
))
if (oversizedMobileProviderSections.length > 0) {
  throw new Error(`A compact provider summary exceeded the 2200px mobile budget: ${JSON.stringify(oversizedMobileProviderSections, null, 2)}`)
}

const receipt = {
  route: qaUrl,
  layout: (() => {
    const revisedMobile390PageHeight = mobile390?.pageHeight ?? null
    const pageHeightDeltaPixels = revisedMobile390PageHeight === null
      ? null
      : revisedMobile390PageHeight - baselineMobile390PageHeight
    return {
      baselineMobile390PageHeight,
      baselineMeasurementSource: 'Merged PR #883 compact provider-readiness receipt plus the provider-selection and transport-contract layers',
      maxMobile390PageHeight,
      revisedMobile390PageHeight,
      revisedMobile390SmsSectionHeight: mobile390?.smsSectionHeight ?? null,
      revisedMobile390ProviderSectionHeight: mobile390?.providerSectionHeight ?? null,
      pageHeightDeltaPixels,
      pageHeightDeltaPercent: pageHeightDeltaPixels === null
        ? null
        : Number(((pageHeightDeltaPixels / baselineMobile390PageHeight) * 100).toFixed(1)),
    }
  })(),
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
    providerConfigured: true,
    providerEnabled: false,
    transportState: 'configured_ready',
    transportConfigParsing: true,
    transportExternalRequests: [],
    senderReferenceReady: true,
    deliveryConfirmationPlaceholder: true,
    recommendedProvider: 'telnyx_messaging',
    providerSelectionPlanningOnly: true,
    providerSelectionCandidateCount: 4,
    providerSelectionRecorded: true,
    providerConfigurationVerified: true,
    providerCapabilitiesVerified: true,
    noSendCanaryEligible: true,
    noSendCanaryResult: 'would_route_no_send',
    idempotencyImplementation: false,
    activationEnabled: false,
    providerSendRouteImplemented: false,
    separateCurrentSendApprovalRequired: true,
    genericProceedAccepted: false,
    smsDelivery: false,
    smsSends: false,
    smsProviderCalls: false,
    phoneImport: false,
    slackDispatch: false,
    slack: false,
    gmailAction: false,
    gmail: false,
    n8nDispatch: false,
    n8n: false,
    productionDataMutation: false,
    migration: false,
    migrations: false,
    envChanges: false,
    deployment: false,
  },
}

await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
console.log(JSON.stringify({ ok: true, receiptPath, mp4Path, route: qaUrl, externalRequests }, null, 2))
