import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const contentId = 'bb5bcfe7-3de8-4fdc-b13f-da85416e8cad'
const outputDir = path.join(root, 'docs', 'social-content-qa')
const rawVideoDir = path.join(root, 'test-results', 'social-copy-reject-comments-qa')
const mp4Path = path.join(outputDir, 'social-copy-reject-comments-mobile.mp4')
const receiptPath = path.join(outputDir, 'social-copy-reject-comments-receipt.json')
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:3097'
const exactPath = `/admin/social-content/${contentId}?step=copy&qa=slack-content-calendar-approval#social-copy-gate`
const exactUrl = `${baseUrl}${exactPath}`

await mkdir(outputDir, { recursive: true })
await mkdir(rawVideoDir, { recursive: true })

const user = {
  id: 'qa-admin-user',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'qa-admin@example.test',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-08-31T00:00:00.000Z',
}

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

const now = Math.floor(Date.now() / 1000)
const expiresAt = now + 3600
const qaAccessToken = [
  base64Url({ alg: 'none', typ: 'JWT' }),
  base64Url({
    aud: 'authenticated',
    exp: expiresAt,
    iat: now,
    sub: user.id,
    email: user.email,
    role: 'authenticated',
  }),
  'qa-signature',
].join('.')

const session = {
  access_token: qaAccessToken,
  refresh_token: 'qa-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: expiresAt,
  user,
}

const socialItem = {
  id: contentId,
  meeting_record_id: null,
  platform: 'linkedin',
  status: 'draft',
  post_text: [
    'Slack can approve a canary only when the Portfolio gate makes the operator path clear.',
    '',
    'This draft is synthetic QA copy. It shows a copy gate that can be rejected with revision feedback before Shaka receives the next pass.',
  ].join('\n'),
  cta_text: 'Review the gate before publishing.',
  cta_url: null,
  hashtags: ['AgentOps', 'ContentWorkflow'],
  image_url: null,
  image_prompt: 'Simple review-gate workflow diagram for Social Content QA.',
  framework_visual_type: 'architecture',
  voiceover_url: null,
  voiceover_text: null,
  video_url: null,
  topic_extracted: null,
  hormozi_framework: null,
  rag_context: {
    source: 'social_content_calendar_authorization',
    source_type: 'social_content_calendar_item',
    calendar_item_id: 'calendar-qa-1',
    campaign_id: 'campaign-qa-1',
    campaign_name: 'Slack content calendar approval QA',
    planned_angle: 'Make rejection actionable from the copy gate',
    publish_gate: 'draft_only',
    external_execution_enabled: false,
  },
  scheduled_for: null,
  published_at: null,
  platform_post_id: null,
  admin_notes: null,
  reviewed_by: null,
  target_platforms: ['linkedin'],
  video_generation_method: 'none',
  youtube_title: null,
  youtube_description: null,
  content_format: 'single_image',
  content_pillar: 'Agent Ops',
  companion_post_text: null,
  carousel_slides: null,
  carousel_pdf_url: null,
  carousel_slide_urls: null,
  created_at: '2026-08-31T16:00:00.000Z',
  updated_at: '2026-08-31T16:05:00.000Z',
  publishes: [],
}

let latestItem = socialItem
const capturedPutBodies = []
const calibrationRevisionRequests = []
const externalRequests = []

function isBlockedExternal(url) {
  return /gmail|slack|linkedin|facebook|instagram|tiktok|youtube|n8n|telnyx|resend/i.test(url)
}

async function installRoutes(page) {
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const pathname = url.pathname

    if (url.hostname.endsWith('.supabase.co') && pathname.includes('/auth/v1/user')) {
      return route.fulfill({ status: 200, json: user })
    }

    if (isBlockedExternal(request.url()) && !url.hostname.includes('127.0.0.1') && !url.hostname.includes('localhost')) {
      externalRequests.push(request.url())
      return route.abort()
    }

    if (pathname === '/api/user/profile') {
      return route.fulfill({
        status: 200,
        json: {
          profile: {
            id: user.id,
            email: user.email,
            role: 'admin',
            created_at: '2026-08-31T00:00:00.000Z',
            updated_at: '2026-08-31T00:00:00.000Z',
          },
        },
      })
    }

    if (pathname === '/api/admin/social-content/config') {
      return route.fulfill({ status: 200, json: { configs: [] } })
    }

    if (pathname === '/api/admin/social-content/calibration-library') {
      return route.fulfill({ status: 200, json: { references: [] } })
    }

    if (pathname === '/api/admin/social-content/topic-backlog') {
      return route.fulfill({ status: 200, json: { items: [] } })
    }

    if (pathname === `/api/admin/social-content/${contentId}/engagement/comments`) {
      return route.fulfill({ status: 200, json: { items: [] } })
    }

    if (pathname === '/api/admin/social-content') {
      return route.fulfill({ status: 200, json: { items: [latestItem], total: 1 } })
    }

    if (pathname === `/api/admin/social-content/${contentId}` && request.method() === 'PUT') {
      const capturedPutBody = JSON.parse(request.postData() || '{}')
      capturedPutBodies.push(capturedPutBody)
      latestItem = {
        ...latestItem,
        ...capturedPutBody,
        reviewed_by: user.id,
        updated_at: new Date().toISOString(),
      }
      return route.fulfill({ status: 200, json: { item: latestItem } })
    }

    if (pathname === `/api/admin/social-content/${contentId}/calibration-revision`) {
      calibrationRevisionRequests.push(JSON.parse(request.postData() || '{}'))
      return route.fulfill({ status: 200, json: { item: latestItem } })
    }

    if (pathname === `/api/admin/social-content/${contentId}`) {
      return route.fulfill({ status: 200, json: { item: latestItem } })
    }

    return route.fallback()
  })
}

async function seedSession(page) {
  const supabaseProjectRef = new URL(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co',
  ).hostname.split('.')[0]
  const storageKey = `sb-${supabaseProjectRef}-auth-token`
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value))
    window.localStorage.setItem('sb-127-auth-token', JSON.stringify(value))
  }, { key: storageKey, value: session })
}

const browser = await chromium.launch()
const warmContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
const warmPage = await warmContext.newPage()
await seedSession(warmPage)
await installRoutes(warmPage)
await warmPage.goto(exactUrl, { waitUntil: 'networkidle' })
await warmPage.locator('#social-copy-gate').waitFor({ timeout: 15_000 })
await warmContext.close()

latestItem = socialItem
capturedPutBodies.length = 0
calibrationRevisionRequests.length = 0
externalRequests.length = 0

const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  recordVideo: { dir: rawVideoDir, size: { width: 390, height: 844 } },
})
const page = await context.newPage()
page.on('dialog', (dialog) => dialog.accept())
await seedSession(page)
await installRoutes(page)

await page.goto(exactUrl, { waitUntil: 'networkidle' })
await page.locator('#social-copy-gate').waitFor({ timeout: 15_000 })
await page.getByRole('button', { name: 'Reject', exact: true }).scrollIntoViewIfNeeded()
await page.waitForTimeout(700)
await page.getByRole('button', { name: 'Reject', exact: true }).click()
await page.getByLabel('Revision feedback for Shaka').waitFor({ timeout: 5_000 })
await page.waitForTimeout(900)
const noFeedbackPutResponse = page.waitForResponse((response) => (
  response.url().endsWith(`/api/admin/social-content/${contentId}`)
  && response.request().method() === 'PUT'
))
await page.getByRole('button', { name: 'Submit Rejection' }).click()
await noFeedbackPutResponse
await page.locator('#social-copy-gate').getByText('Copy: Rejected').waitFor({ timeout: 5_000 })
const noFeedbackVisibleCopyState = await page.locator('#social-copy-gate').getByText('Copy: Rejected').textContent()
await page.waitForTimeout(900)

latestItem = {
  ...socialItem,
  post_text: 'Second synthetic pass: the operator can add optional comments for Shaka before rejecting.',
  updated_at: new Date().toISOString(),
}

await page.goto(exactUrl, { waitUntil: 'networkidle' })
await page.locator('#social-copy-gate').waitFor({ timeout: 15_000 })
await page.getByRole('button', { name: 'Reject', exact: true }).scrollIntoViewIfNeeded()
await page.waitForTimeout(1000)
await page.getByRole('button', { name: 'Reject', exact: true }).click()
await page.getByLabel('Revision feedback for Shaka').scrollIntoViewIfNeeded()
await page.waitForTimeout(1200)
await page.getByLabel('Revision feedback for Shaka').fill('Add the Slack canary context, name what failed, and give Shaka a concrete revision path before this copy returns for approval.')
await page.getByLabel('Revision feedback for Shaka').scrollIntoViewIfNeeded()
await page.waitForTimeout(1800)
await page.getByRole('button', { name: 'Submit Rejection' }).click()
await page.locator('#social-copy-gate').getByText('Copy: Rejected').waitFor({ timeout: 5_000 })
const feedbackVisibleCopyState = await page.locator('#social-copy-gate').getByText('Copy: Rejected').textContent()
await page.waitForTimeout(1200)

const video = page.video()
await context.close()
const rawVideoPath = video ? await video.path() : null
await browser.close()

const noFeedbackBody = capturedPutBodies[0]
const feedbackBody = capturedPutBodies[1]

if (!noFeedbackBody || !feedbackBody) {
  throw new Error(`QA expected two rejection PUT requests, saw ${capturedPutBodies.length}`)
}
if (noFeedbackBody?.rag_context) {
  throw new Error('QA blank rejection unexpectedly persisted revision feedback metadata')
}
if (!feedbackBody?.rag_context?.content_calibration?.operator_feedback?.revision_request) {
  throw new Error('QA did not capture persisted copy revision feedback')
}
if (calibrationRevisionRequests.length > 0) {
  throw new Error('QA unexpectedly generated a calibration revision from direct rejection')
}
if (externalRequests.length > 0) {
  throw new Error(`QA encountered blocked external requests: ${externalRequests.join(', ')}`)
}

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

await writeFile(receiptPath, JSON.stringify({
  exactUrl,
  mp4Path,
  noFeedbackReject: {
    capturedStatus: noFeedbackBody.status,
    visibleCopyGateState: noFeedbackVisibleCopyState,
    persistedRevisionFeedback: Boolean(noFeedbackBody.rag_context?.content_calibration?.operator_feedback?.revision_request),
  },
  feedbackReject: {
    capturedStatus: feedbackBody.status,
    visibleCopyGateState: feedbackVisibleCopyState,
    capturedRevisionStatus: feedbackBody.rag_context.content_calibration.status,
    capturedRevisionAction: feedbackBody.rag_context.content_calibration.revision_requests.at(-1).action,
  },
  calibrationRevisionRequests: calibrationRevisionRequests.length,
  externalRequests,
}, null, 2))

console.log(JSON.stringify({
  exactUrl,
  mp4Path,
  receiptPath,
  externalRequests,
}, null, 2))
