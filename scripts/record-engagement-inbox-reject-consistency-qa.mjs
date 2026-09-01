import { chromium, expect } from '@playwright/test'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const baseUrl = (process.env.QA_BASE_URL || 'http://127.0.0.1:3108').replace(/\/$/, '')
const outputDir = path.join(root, 'docs', 'qa', 'slack-approval-lifecycle')
const rawVideoDir = path.join(root, 'tmp', 'engagement-inbox-reject-video')
const desktopMp4Path = path.join(outputDir, 'engagement-inbox-rejected-reply-recovery-qa-2026-09-01.mp4')
const mobileMp4Path = path.join(outputDir, 'engagement-inbox-rejected-reply-mobile-qa-2026-09-01.mp4')
const screenshotPath = path.join(outputDir, 'engagement-inbox-rejected-reply-locked-state-2026-09-01.png')
const receiptPath = path.join(outputDir, 'engagement-inbox-rejected-reply-receipt-2026-09-01.json')
const exactPath = '/admin/social-content/engagement-inbox?comment=comment-qa-locked&post=social-qa-locked&review=reply&source=slack#social-comment-review-gate'
const exactUrl = `${baseUrl}${exactPath}`
const allowedQaHost = new URL(baseUrl).hostname

if (!existsSync(path.join(root, 'node_modules'))) {
  throw new Error('node_modules is required. In worktrees, temporarily link the main Portfolio node_modules before running this recorder.')
}

await mkdir(outputDir, { recursive: true })
await mkdir(rawVideoDir, { recursive: true })

const user = {
  id: 'qa-admin-user',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'qa-admin@example.test',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-09-01T00:00:00.000Z',
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

const capturedActions = []
const externalRequests = []

function isBlockedExternal(url) {
  return /gmail|slack|linkedin|facebook|instagram|tiktok|youtube|n8n|telnyx|resend/i.test(url)
}

async function installRoutes(page) {
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const pathname = url.pathname

    if (url.hostname.endsWith('.supabase.co') && pathname.includes('/auth/v1/token')) {
      return route.fulfill({ status: 200, json: session })
    }

    if (url.hostname.endsWith('.supabase.co') && pathname.includes('/auth/v1/user')) {
      return route.fulfill({ status: 200, json: user })
    }

    if (url.hostname.endsWith('.supabase.co') && pathname.includes('/rest/v1/user_profiles')) {
      return route.fulfill({
        status: 200,
        json: [{
          id: user.id,
          role: 'admin',
        }],
      })
    }

    if (
      isBlockedExternal(request.url())
      && url.hostname !== allowedQaHost
      && !url.hostname.includes('127.0.0.1')
      && !url.hostname.includes('localhost')
    ) {
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
            created_at: '2026-09-01T00:00:00.000Z',
            updated_at: '2026-09-01T00:00:00.000Z',
          },
        },
      })
    }

    if (pathname === '/api/admin/social-content/social-qa-locked/engagement/comments' && request.method() === 'POST') {
      capturedActions.push(JSON.parse(request.postData() || '{}'))
      return route.fallback()
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
    const serialized = JSON.stringify(value)
    const originalGetItem = window.Storage.prototype.getItem
    window.Storage.prototype.getItem = function getItemWithQaSession(storageKey) {
      if (/^sb-.*-auth-token$/.test(String(storageKey))) {
        return originalGetItem.call(this, storageKey) ?? serialized
      }
      return originalGetItem.call(this, storageKey)
    }
    window.localStorage.setItem(key, JSON.stringify(value))
    window.localStorage.setItem('sb-127-auth-token', JSON.stringify(value))
  }, { key: storageKey, value: session })
}

async function annotate(page, label, placement = 'bottom') {
  await page.evaluate(({ text, placement }) => {
    document.getElementById('engagement-inbox-reject-qa-note')?.remove()
    const panel = document.createElement('aside')
    panel.id = 'engagement-inbox-reject-qa-note'
    panel.textContent = text
    panel.style.position = 'fixed'
    panel.style.right = '12px'
    panel.style.bottom = placement === 'bottom' ? '12px' : ''
    panel.style.top = placement === 'top' ? '56px' : ''
    panel.style.zIndex = '9999'
    panel.style.maxWidth = 'min(420px, calc(100vw - 24px))'
    panel.style.padding = '10px 12px'
    panel.style.border = '1px solid rgba(255,255,255,0.24)'
    panel.style.borderRadius = '8px'
    panel.style.background = 'rgba(5,10,20,0.92)'
    panel.style.color = 'white'
    panel.style.font = '600 12px/1.45 system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
    panel.style.boxShadow = '0 16px 40px rgba(0,0,0,0.35)'
    document.body.appendChild(panel)
  }, { text: label, placement })
}

async function verifyNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(2)
}

async function closeRecordedContext(context, page) {
  const video = page.video()
  await context.close()
  return video ? video.path() : null
}

async function convertToMp4(sourceVideo, targetPath) {
  if (!sourceVideo) return null
  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    sourceVideo,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    targetPath,
  ])
  return targetPath
}

async function runScenario(browser, viewport, mp4Path, mobile = false) {
  capturedActions.length = 0

  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: rawVideoDir, size: viewport },
  })
  const page = await context.newPage()
  await seedSession(page)
  await installRoutes(page)

  await page.goto(exactUrl, { waitUntil: 'networkidle' })
  const gate = page.locator('#social-comment-review-gate')
  await gate.waitFor({ timeout: 15_000 })
  const lockedCard = page.getByText('Synthetic Submitted Viewer').first().locator('xpath=ancestor::article[1]')
  const recoverableCard = page.getByText('Synthetic Reviewer').first().locator('xpath=ancestor::article[1]')

  await expect(lockedCard.getByText('Reply rejected')).toBeVisible()
  await expect(lockedCard.getByText('Provider evidence locked').first()).toBeVisible()
  await expect(lockedCard.locator('#comment-qa-locked-submitted-reply-lock-reason')).toContainText(/Local revision is locked/i)
  await expect(lockedCard.getByRole('region', { name: /Reply lifecycle/i })).toBeVisible()
  await expect(lockedCard.getByText('Local revision is blocked by submitted provider evidence.')).toBeVisible()
  await expect(lockedCard.getByText('Inspect provider evidence; local revision is blocked.')).toBeVisible()
  await expect(lockedCard.getByText('Controls locked.')).toBeVisible()
  await expect(lockedCard.getByRole('button', { name: 'Revise Reply', exact: true })).toHaveCount(0)
  await expect(lockedCard.getByRole('button', { name: 'Revision Locked', exact: true })).toBeDisabled()
  await expect(lockedCard.getByRole('button', { name: 'Submit', exact: true })).toBeDisabled()
  await lockedCard.getByRole('button', { name: 'Revision Locked', exact: true }).click({ force: true })
  await lockedCard.getByRole('button', { name: 'Revision Locked', exact: true }).click({ force: true })
  expect(capturedActions).toHaveLength(0)
  await expect(page.getByText(/local action was recorded without changing submitted state/i)).toHaveCount(0)
  await verifyNoHorizontalOverflow(page)
  await annotate(
    page,
    `${mobile ? 'Mobile 390x844' : 'Desktop 1280x720'}: compact lifecycle row leads with locked provider evidence, blocked local revision, and no repeated no-op action.`,
  )
  await page.waitForTimeout(1100)

  await recoverableCard.scrollIntoViewIfNeeded()
  await expect(recoverableCard.getByText('Review locked')).toBeVisible()
  await expect(recoverableCard.getByText('Review actions stay locked until this reply is revised.')).toBeVisible()
  await recoverableCard.getByRole('button', { name: 'Revise Reply', exact: true }).click()
  await expect(recoverableCard.getByText('Revision mode', { exact: true })).toBeVisible()
  await expect(recoverableCard.getByText('Local editor is open; provider submit stays blocked.')).toBeVisible()
  await expect(recoverableCard.getByText('Submit revision to return it to review.')).toBeVisible()
  await expect(recoverableCard.getByLabel('Revision feedback or replacement reply')).toBeVisible()
  await expect(recoverableCard.getByRole('button', { name: 'Revise Reply', exact: true })).toHaveCount(0)
  expect(capturedActions).toHaveLength(0)
  await annotate(
    page,
    'Feedback step: Revise Reply exposes the editor in place; the compact facts show the editor is local and review is paused.',
    mobile ? 'top' : 'bottom',
  )
  await page.waitForTimeout(900)
  await recoverableCard.getByLabel('Revision feedback or replacement reply').fill('Revised reply: this can help, but Portfolio still requires human approval before any provider submission.')
  await recoverableCard.getByRole('button', { name: 'Submit Revision', exact: true }).click()
  await expect(page.getByText('Revised reply saved and returned to review')).toBeVisible()
  await expect(recoverableCard.getByText('Ready for review', { exact: true })).toBeVisible()
  await expect(recoverableCard.getByText('Review, approve, reject with feedback, or edit again.')).toBeVisible()
  await expect(recoverableCard.getByRole('button', { name: 'Approve', exact: true })).toBeVisible()
  await expect(recoverableCard.getByRole('button', { name: 'Reject', exact: true })).toBeVisible()
  await expect(recoverableCard.getByRole('button', { name: 'Submit', exact: true })).toBeDisabled()
  await annotate(
    page,
    'Lifecycle result: Submit Revision records one local return_to_review action and returns the row to a clear Ready for review state.',
    mobile ? 'top' : 'bottom',
  )
  await verifyNoHorizontalOverflow(page)
  if (!mobile) {
    await page.screenshot({ path: screenshotPath, fullPage: true })
  }
  await page.waitForTimeout(1400)

  const rawVideo = await closeRecordedContext(context, page)
  await convertToMp4(rawVideo, mp4Path)

  return {
    viewport,
    mp4Path,
    capturedActions: [...capturedActions],
  }
}

const browser = await chromium.launch({ headless: true })
const desktop = await runScenario(browser, { width: 1280, height: 720 }, desktopMp4Path)
const mobile = await runScenario(browser, { width: 390, height: 844 }, mobileMp4Path, true)
await browser.close()

if (externalRequests.length > 0) {
  throw new Error(`QA encountered blocked external requests: ${externalRequests.join(', ')}`)
}
if (!desktop.capturedActions.some((action) => action.action === 'return_to_review')) {
  throw new Error('Desktop QA did not capture return_to_review recovery action')
}
if (!mobile.capturedActions.some((action) => action.action === 'return_to_review')) {
  throw new Error('Mobile QA did not capture return_to_review recovery action')
}

await writeFile(receiptPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  routesCovered: [exactPath],
  qaBaseUrl: baseUrl,
  exactUrl,
  externalRequests,
  videoPath: path.relative(root, desktopMp4Path),
  mobileVideoPath: path.relative(root, mobileMp4Path),
  screenshotPath: path.relative(root, screenshotPath),
  coverage: {
    desktopViewport: desktop.viewport,
    mobileViewport: mobile.viewport,
    recordedLocalActions: {
      lockedSubmittedEvidenceNoPost: true,
      recoverableReturnToReviewPosts: true,
    },
  },
}, null, 2))

console.log(JSON.stringify({
  exactUrl,
  desktopMp4Path,
  mobileMp4Path,
  receiptPath,
  externalRequests,
}, null, 2))
