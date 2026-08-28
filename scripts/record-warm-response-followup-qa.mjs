import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import path from 'path'
import { promisify } from 'node:util'
import { config as loadEnv } from 'dotenv'

const execFileAsync = promisify(execFile)
const root = process.cwd()
loadEnv({ path: path.join(root, '.env.local') })
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const sourceAuthState =
  process.env.PLAYWRIGHT_AUTH_STATE ||
  '/Users/vambahsillah/Projects/Portfolio/.auth/portfolio-admin-storage-state.json'
const tmpDir = path.join(root, 'tmp', 'warm-response-followup-qa')
const outputDir = path.join(root, 'docs', 'warm-outreach-qa')
const tmpAuthStatePath = path.join(tmpDir, 'localhost-admin-storage-state.json')
const wrapperPath = path.join(tmpDir, 'warm-response-followup-wrapper.html')
const qaJsonPath = path.join(outputDir, 'warm-response-followup-qa.json')
const mp4Path = path.join(outputDir, 'warm-response-followup-contact-workroom.mp4')
const screenshotPaths = {
  mobile360: path.join(outputDir, 'warm-response-followup-contact-mobile-360.png'),
  mobile390: path.join(outputDir, 'warm-response-followup-contact-mobile-390.png'),
  mobile430: path.join(outputDir, 'warm-response-followup-contact-mobile-430.png'),
  tablet768: path.join(outputDir, 'warm-response-followup-contact-tablet-768.png'),
  desktop: path.join(outputDir, 'warm-response-followup-contact-desktop.png'),
}

const routePath = '/admin/contacts/42?qa=warm-slack-send-approval#warm-response-lifecycle'
const routeUrl = `${baseUrl}${routePath}`
const providerHostPattern =
  /gmail|slack|n8n|googleapis|oauth2|linkedin|facebook\.com|graph\.facebook|api\.apify/i
const providerApiPathPattern = /\/api\/.*(gmail|slack|n8n|provider|oauth)/i

await mkdir(tmpDir, { recursive: true })
await mkdir(outputDir, { recursive: true })

const savedState = JSON.parse(await readFile(sourceAuthState, 'utf8'))
const sourceOrigin = savedState.origins?.find((origin) =>
  Array.isArray(origin.localStorage) &&
  origin.localStorage.some((item) => String(item.name).includes('-auth-token')),
)
if (!sourceOrigin) {
  throw new Error(`No Supabase auth localStorage entry found in ${sourceAuthState}`)
}
const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://local.supabase.co').host
const supabaseProjectRef = supabaseHost.split('.')[0]
const localStorageAuthKey = `sb-${supabaseProjectRef}-auth-token`

const localAuthState = {
  cookies: [],
  origins: [
    {
      origin: baseUrl,
      localStorage: sourceOrigin.localStorage.map((item) => {
        if (!String(item.name).includes('-auth-token')) return item
        const value = JSON.parse(item.value)
        const user = {
          ...(value.user ?? {}),
          id: 'qa-admin-user',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'qa-admin@example.com',
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: {},
        }
        return {
          name: localStorageAuthKey,
          value: JSON.stringify({
            ...value,
            access_token: 'qa-access-token',
            refresh_token: 'qa-refresh-token',
            token_type: 'bearer',
            expires_in: 604800,
            expires_at: Math.floor(Date.now() / 1000) + 604800,
            user,
          }),
        }
      }),
    },
  ],
}
await writeFile(tmpAuthStatePath, JSON.stringify(localAuthState, null, 2))

await writeFile(wrapperPath, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Warm response follow-up lifecycle QA</title>
    <style>
      body {
        margin: 0;
        background: #030712;
        color: #f9fafb;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .stage {
        display: grid;
        grid-template-columns: 340px minmax(0, 1fr);
        gap: 16px;
        height: 720px;
        padding: 16px;
        box-sizing: border-box;
      }
      aside {
        border: 1px solid #1f2937;
        border-radius: 8px;
        background: rgba(15, 23, 42, .92);
        padding: 18px;
      }
      h1, h2, p { margin: 0; }
      h1 { font-size: 20px; line-height: 1.2; }
      h2 { margin-top: 18px; color: #bae6fd; font-size: 13px; letter-spacing: .03em; text-transform: uppercase; }
      p { margin-top: 8px; color: #d1d5db; font-size: 13px; line-height: 1.5; }
      .flag {
        display: block;
        margin-top: 8px;
        border: 1px solid rgba(16, 185, 129, .3);
        border-radius: 6px;
        background: rgba(16, 185, 129, .12);
        color: #d1fae5;
        padding: 7px 8px;
        font-size: 12px;
      }
      iframe {
        width: 100%;
        height: 100%;
        border: 1px solid #1f2937;
        border-radius: 8px;
        background: #030712;
      }
    </style>
  </head>
  <body>
    <main class="stage">
      <aside>
        <h1>Warm Reply Lifecycle QA</h1>
        <p>Route: ${routePath}</p>
        <h2>Step</h2>
        <p>Capture a synthetic inbound warm reply, attach a stable manual message key, and review the local draft plus next-touch decision state.</p>
        <h2>Expected</h2>
        <p>The contact workroom records the reply as interested, reuses stable local keys, creates a local reply draft, and keeps all follow-up decisions pending human QA.</p>
        <span class="flag">Provider calls: off</span>
        <span class="flag">Gmail draft creation: off</span>
        <span class="flag">Gmail sends: off</span>
        <span class="flag">Slack and n8n: off</span>
      </aside>
      <iframe title="Actual Portfolio contact workroom" src="${routeUrl}"></iframe>
    </main>
  </body>
</html>`)

function syntheticResponses() {
  return {
    responses: [
      {
        id: 'comm-response-existing',
        channel: 'email',
        direction: 'inbound',
        message_type: 'reply',
        subject: 'Warm outreach response: interested',
        body: 'Interested in talking next week.',
        source_id: 'warm-outreach:reply:manual:qa-existing',
        status: 'replied',
        sent_at: '2026-08-26T12:00:00.000Z',
        metadata: {
          lifecycle: 'warm_outreach_response',
          source_type: 'gmail',
          source_label: 'Gmail reply',
          source_provenance: {
            source_type: 'gmail',
            source_label: 'Gmail reply',
            capture_method: 'provider_shaped_manual_intake',
            source_system: 'manual',
            provider: 'gmail',
            provider_thread_id: 'gmail-thread-qa',
            provider_message_id: 'gmail-message-qa-1',
            manual_message_key: 'qa-thread-42-message-1',
            source_url: 'https://mail.google.com/mail/u/0/#inbox/gmail-thread-qa',
            provider_polling_enabled: false,
            provider_ingestion_enabled: false,
            external_action_enabled: false,
          },
          response_class: 'interested',
          response_class_label: 'interested',
          recommended_next_action: {
            label: 'Review short next-step reply',
            description: 'Prepare a concise next-step reply.',
            priority: 'high',
            requiresNextTouchDecision: true,
          },
          next_touch_decision_required: true,
          approval_gate: {
            state: 'pending_human_reply_review',
            label: 'Pending: human reply approval',
            recoveryPath: 'Approve the local draft in the contact workroom.',
          },
          local_draft_recommendation: {
            subject: 'Draft reply: interested',
          },
          human_qa_required: true,
          manual_message_key: 'qa-thread-42-message-1',
        },
        created_at: '2026-08-26T12:00:00.000Z',
      },
    ],
    executionBoundary: {
      providerIngestionEnabled: false,
      externalMonitoringEnabled: false,
      replySubmissionEnabled: false,
      externalSendEnabled: false,
      gmailDraftCreationEnabled: false,
      slackActionEnabled: false,
    },
  }
}

async function installRoutes(context, unexpectedRequests) {
  context.on('request', (request) => {
    const url = request.url()
    const parsed = new URL(url)
    const isLocalApp = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
    const isProviderBoundary = isLocalApp
      ? providerApiPathPattern.test(parsed.pathname)
      : providerHostPattern.test(`${parsed.hostname}${parsed.pathname}`)
    if (isProviderBoundary) {
      unexpectedRequests.push({
        method: request.method(),
        url,
      })
    }
  })

  await context.route('**/api/user/profile**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        profile: {
          id: 'qa-admin-user',
          email: 'qa-admin@example.com',
          role: 'admin',
          created_at: '2026-08-28T00:00:00.000Z',
          updated_at: '2026-08-28T00:00:00.000Z',
        },
      }),
    })
  })

  await context.route('**/auth/v1/user**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'qa-admin-user',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'qa-admin@example.com',
        created_at: '2026-08-28T00:00:00.000Z',
        updated_at: '2026-08-28T00:00:00.000Z',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {},
      }),
    })
  })

  await context.route('**/auth/v1/token**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'qa-access-token',
        refresh_token: 'qa-refresh-token',
        token_type: 'bearer',
        expires_in: 604800,
        expires_at: Math.floor(Date.now() / 1000) + 604800,
        user: {
          id: 'qa-admin-user',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'qa-admin@example.com',
          created_at: '2026-08-28T00:00:00.000Z',
          updated_at: '2026-08-28T00:00:00.000Z',
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: {},
        },
      }),
    })
  })

  await context.route('**/api/admin/outreach/leads/42/responses', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          outcome: 'created',
          responseCommunicationId: 'comm-response-created',
          replyDraftCommunicationId: 'comm-draft-created',
          replyDraftOutcome: 'created',
          followUpTask: { outcome: 'created', id: 'task-created' },
          suppressionProposal: null,
          sourceProvenance: {
            source_type: 'gmail',
            source_label: 'Gmail reply',
            capture_method: 'provider_shaped_manual_intake',
            source_system: 'manual',
            provider: 'gmail',
            provider_thread_id: 'gmail-thread-qa',
            provider_message_id: 'gmail-message-qa-new',
            manual_message_key: 'qa-thread-42-message-3',
            source_url: null,
            provider_polling_enabled: false,
            provider_ingestion_enabled: false,
            external_action_enabled: false,
          },
          executionBoundary: {
            providerIngestionEnabled: false,
            externalMonitoringEnabled: false,
            replySubmissionEnabled: false,
            externalSendEnabled: false,
            gmailDraftCreationEnabled: false,
            slackActionEnabled: false,
          },
          decision: {
            responseClass: 'interested',
            interpretation: {
              classificationLabel: 'interested',
              recommendedNextAction: {
                label: 'Review short next-step reply',
                requiresNextTouchDecision: true,
              },
            },
            approvalGate: {
              label: 'Pending: human reply approval',
              recoveryPath: 'Approve the local draft in the contact workroom.',
            },
          },
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(syntheticResponses()),
    })
  })
}

async function captureRouteScreenshot(width, height, screenshotPath) {
  const unexpectedRequests = []
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width, height },
    storageState: tmpAuthStatePath,
  })
  await installRoutes(context, unexpectedRequests)
  const page = await context.newPage()
  await page.goto(routeUrl, { waitUntil: 'domcontentloaded' })
  try {
    await page.getByRole('heading', { name: /Warm response lifecycle/i }).scrollIntoViewIfNeeded({
      timeout: 10000,
    })
  } catch (error) {
    const bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '')
    throw new Error(
      `Warm response lifecycle heading not found at ${page.url()}. Visible text: ${bodyText.slice(0, 1200)}`,
      { cause: error },
    )
  }
  await page.getByPlaceholder(/Optional stable source key/i).fill('qa-thread-42-message-2')
  await page.getByLabel(/Response source/i).selectOption('gmail')
  await page.getByPlaceholder(/Paste or summarize the response/i).fill('Interested. Could we talk next week?')
  await page.getByRole('button', { name: /Capture response/i }).click()
  await page.getByText(/Response captured as interested/i).waitFor()
  await page.screenshot({ path: screenshotPath, fullPage: true })
  await context.close()
  await browser.close()
  return unexpectedRequests
}

const screenshotUnexpectedRequests = []
for (const [name, width] of [
  ['mobile360', 360],
  ['mobile390', 390],
  ['mobile430', 430],
]) {
  screenshotUnexpectedRequests.push(
    ...(await captureRouteScreenshot(width, 844, screenshotPaths[name])),
  )
}
screenshotUnexpectedRequests.push(
  ...(await captureRouteScreenshot(768, 900, screenshotPaths.tablet768)),
)
screenshotUnexpectedRequests.push(
  ...(await captureRouteScreenshot(1280, 900, screenshotPaths.desktop)),
)

const videoUnexpectedRequests = []
const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  storageState: tmpAuthStatePath,
  recordVideo: { dir: outputDir, size: { width: 1280, height: 720 } },
})
await installRoutes(context, videoUnexpectedRequests)
const page = await context.newPage()
await page.goto(`file://${wrapperPath}`, { waitUntil: 'domcontentloaded' })
const frame = page.frameLocator('iframe[title="Actual Portfolio contact workroom"]')
await frame.getByRole('heading', { name: /Warm response lifecycle/i }).scrollIntoViewIfNeeded()
await page.waitForTimeout(500)
await frame.getByLabel(/Response source/i).selectOption('gmail')
await frame.getByPlaceholder(/Optional stable source key/i).fill('qa-thread-42-message-3')
await frame.getByPlaceholder(/Paste or summarize the response/i).fill('Interested. Could we review options next week?')
await page.waitForTimeout(400)
await frame.getByRole('button', { name: /Capture response/i }).click()
await frame.getByText(/Response captured as interested/i).waitFor()
await page.waitForTimeout(1200)
const video = page.video()
await context.close()
await browser.close()
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
  await unlink(rawVideoPath).catch(() => undefined)
}

const unexpectedRequests = [...screenshotUnexpectedRequests, ...videoUnexpectedRequests]
await writeFile(qaJsonPath, JSON.stringify({
  route: routeUrl,
  screenshots: screenshotPaths,
  mp4Path,
  rawVideoPath: null,
  unexpectedRequests,
}, null, 2))

console.log(JSON.stringify({
  route: routeUrl,
  screenshots: screenshotPaths,
  videoPath: mp4Path,
  rawVideoPath: null,
  unexpectedRequests,
  qaJsonPath,
}, null, 2))
