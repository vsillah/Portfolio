import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { seedSession, installSafeRoutes } from './record-warm-planned-draft-actions-qa.mjs'
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3117'
const output = `${process.cwd()}/docs/warm-outreach-qa/warm-gmail-actions`
await mkdir(output, { recursive: true })
const browser = await chromium.launch()
const runs = []
for (const width of [1440, 768, 390]) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, recordVideo: { dir: `${output}/source`, size: { width, height: 900 } } })
  const page = await context.newPage()
  const externalRequests = [], localRequests = []
  await seedSession(page)
  await installSafeRoutes(page, externalRequests, localRequests)
  const queue = { id: 'qa-outreach-queue-existing-101', contactSubmissionId: 101, channel: 'email', status: 'draft', body: 'Hi Amina, thanks for discussing the workshop. Would Tuesday at 2 work for a short follow-up?', subject: 'Workshop follow-up', createdAt: '2026-09-08T12:00:00Z', updatedAt: '2026-09-08T12:00:00.000Z', generationInputs: {} }
  const version = () => { queue.updatedAt = new Date(Date.parse(queue.updatedAt) + 1).toISOString() }
  const fingerprint = () => `warm-final-copy:v1:${createHash('sha256').update(JSON.stringify([queue.id,101,'amina.office@example.test',queue.subject,queue.body])).digest('hex')}`
  const readiness = action => ({ reviewedCopy: { queueId: queue.id, recipientEmail: 'amina.office@example.test', sender: 'sender@example.test', subject: queue.subject, body: queue.body, updatedAt: queue.updatedAt }, noSendSmoke: action === 'draft' || action === 'update', readyForConfirmation: action !== 'draft', ...(action === 'slack' ? { slackDestination: { workspaceId: 'TTEST', channelId: 'CTEST' } } : {}), expectedAuthorization: { expectedUpdatedAt: queue.updatedAt, finalCopyFingerprint: fingerprint(), recipientEmail: 'amina.office@example.test', contactSubmissionId: 101, channel: 'email', ...(action === 'update' ? { createGmailDraft: false, updateGmailDraft: true, gmailDraftId: 'synthetic-draft-1', draftAuthorization: 'update_gmail_draft_for_recipient' } : action === 'draft' ? { createGmailDraft: true, draftAuthorization: 'create_gmail_draft_for_recipient' } : action === 'slack' ? { sendReviewToSlack: true, workspaceId: 'TTEST', channelId: 'CTEST' } : { executeGmailSend: true, sendAuthorization: 'execute_warm_gmail_send_for_authorized_recipient', gmailDraftId: 'synthetic-draft-1' }) } })
  let draftCalls = 0, updateCalls = 0, sendCalls = 0, slackCalls = 0, enableFixtureSend = false, enableFixtureSlack = false
  await page.route('**/api/admin/outreach/drafts/*/inputs', route => route.fulfill({ json: queue }))
  await page.route('**/api/admin/outreach', async route => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    const body = route.request().postDataJSON()
    if (body.expectedVersions?.[queue.id] !== queue.updatedAt) throw new Error('Stale displayed review version')
    if (body.action === 'edit') { Object.assign(queue, body.updates); Object.assign(queue.generationInputs, { warm_gmail_send_authorization: null, warm_gmail_send_slack_approval_request: null, copy_revision_requires_provider_reconciliation: Boolean(queue.generationInputs.gmail_draft_creation) }) }
    queue.status = body.action === 'approve' ? 'approved' : 'draft'; version()
    await route.fulfill({ json: { versions: { [queue.id]: queue.updatedAt }, generationInputsById: { [queue.id]: queue.generationInputs } } })
  })
  for (const action of ['draft','send']) await page.route(`**/api/admin/outreach/*/gmail-user-${action}`, async route => {
    const body = route.request().postDataJSON()
    if (!route.request().headers().authorization) throw new Error('Missing admin session')
    if (body.noSendSmoke || body.prepareOnly) return route.fulfill({ json: action === 'send' && !enableFixtureSend ? { readyForConfirmation: false, message: 'Live Gmail sending is disabled. Complete setup, then refresh readiness.' } : readiness(body.prepareDraftUpdate ? 'update' : action) })
    if (JSON.stringify(body) !== JSON.stringify(readiness(body.updateGmailDraft ? 'update' : action).expectedAuthorization)) throw new Error('Explicit confirmation payload drift')
    version()
    if (body.updateGmailDraft) {
      updateCalls++
      Object.assign(queue.generationInputs, { gmail_draft_creation: { draft_id: 'synthetic-draft-1', final_copy_fingerprint: fingerprint() }, copy_revision_requires_provider_reconciliation: false, warm_gmail_send_authorization: null, warm_gmail_send_slack_approval_request: null, warm_gmail_review_slack_delivery: null })
      await route.fulfill({ json: { gmailDraftUpdated: true, draftId: 'synthetic-draft-1', message: 'Synthetic mailbox update receipt recorded. Fresh review required.' } })
    } else if (action === 'draft') {
      draftCalls++
      queue.generationInputs.gmail_draft_creation = { draft_id: 'synthetic-draft-1', final_copy_fingerprint: fingerprint() }
      await route.fulfill({ json: { gmailDraftCreated: true, draftId: 'synthetic-draft-1', message: 'Synthetic Gmail draft receipt recorded. No email sent.' } })
    } else {
      sendCalls++; queue.status = 'sent'
      await route.fulfill({ json: { status: 'sent', gmailSendCalled: true, externalSendPerformed: true, messageId: 'synthetic-message-1', threadId: 'synthetic-thread-1', message: 'Synthetic Gmail send receipt recorded.' } })
    }
  })
  await page.route('**/api/admin/outreach/*/slack-send-approval', async route => {
    if (route.request().postDataJSON().expectedUpdatedAt !== queue.updatedAt) throw new Error('Stale approval request')
    queue.generationInputs.warm_gmail_send_slack_approval_request = { status: 'pending' }; version()
    await route.fulfill({ json: { approvalRequest: { status: 'pending' } } })
  })
  await page.route('**/api/admin/outreach/*/slack-review-delivery', async route => {
    const body = route.request().postDataJSON()
    if (!enableFixtureSlack) return route.fulfill({ status: 409, json: { message: 'Slack review delivery is disabled. Complete the approved destination setup, then refresh.' } })
    if (body.prepareOnly) return route.fulfill({ json: readiness('slack') })
    if (JSON.stringify(body) !== JSON.stringify(readiness('slack').expectedAuthorization)) throw new Error('Slack confirmation scope drift')
    slackCalls++; version()
    queue.generationInputs.warm_gmail_review_slack_delivery = { state: 'sent', workspace_id: 'TTEST', channel_id: 'CTEST', slack_channel: 'CTEST', slack_message_ts: '123.456' }
    await route.fulfill({ json: { sent: true, status: 'sent', receipt: { channel: 'CTEST', ts: '123.456' }, message: 'Synthetic Slack review receipt recorded. Gmail remains separate.' } })
  })
  const url = `${base}/admin/outreach?tab=leads&filter=warm&id=101&contactId=101&draftReview=${queue.id}#warm-gmail-draft-review`
  await page.goto(url, { waitUntil: 'networkidle' })
  const panel = page.getByLabel('Gmail draft review for Amina Batchready')
  await panel.waitFor({ timeout: 30000 })
  await panel.getByRole('button', { name: 'Approve final copy' }).click()
  const actions = page.getByRole('region', { name: 'Gmail actions' })
  await actions.evaluate(el => el.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(900)
  await actions.getByRole('button', { name: 'Review Gmail draft creation' }).click()
  await actions.getByRole('button', { name: 'Create Gmail draft', exact: true }).waitFor()
  await actions.evaluate(el => el.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(1800)
  await actions.screenshot({ path: `${output}/draft-confirm-${width}.png` })
  await actions.getByRole('button', { name: 'Create Gmail draft', exact: true }).click()
  await actions.getByRole('button', { name: 'Prepare review request' }).click()
  await actions.getByText(/Slack delivery has not occurred/).waitFor()
  await page.waitForTimeout(1200)
  await actions.getByRole('button', { name: 'Review Slack delivery' }).click()
  await actions.getByText(/Slack review delivery is disabled/).waitFor()
  await page.waitForTimeout(1200)
  await actions.screenshot({ path: `${output}/slack-disabled-${width}.png` })
  enableFixtureSlack = true
  await actions.getByRole('button', { name: 'Review Slack delivery' }).click()
  await actions.getByRole('button', { name: 'Send review to Slack' }).waitFor()
  await actions.evaluate(el => el.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(1800)
  await actions.screenshot({ path: `${output}/slack-confirm-${width}.png` })
  await actions.getByRole('button', { name: 'Send review to Slack' }).click()
  await actions.getByRole('link', { name: 'Open review in Slack' }).waitFor()
  await page.waitForTimeout(1000)
  // An old approved decision must not survive editing the already-created mailbox draft.
  queue.generationInputs.warm_gmail_send_authorization = { status: 'approved', final_copy_fingerprint: fingerprint() }; version()
  await actions.getByRole('button', { name: 'Refresh review' }).click()
  await actions.getByRole('button', { name: 'Review Gmail send' }).waitFor()
  await panel.getByRole('button', { name: 'Edit final copy' }).click()
  await panel.getByLabel('Final message').fill('Hi Amina, thanks for discussing the workshop. Would Wednesday at 3 work for our follow-up?')
  await panel.getByRole('button', { name: 'Save and return to review' }).click()
  await panel.getByRole('button', { name: 'Approve final copy' }).click()
  await actions.getByRole('button', { name: 'Review Gmail draft update' }).click()
  await actions.getByRole('button', { name: 'Update Gmail draft', exact: true }).waitFor()
  await actions.evaluate(el => el.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(1800)
  await actions.screenshot({ path: `${output}/update-confirm-${width}.png` })
  await actions.getByRole('button', { name: 'Update Gmail draft', exact: true }).click()
  await actions.getByRole('button', { name: 'Prepare review request' }).waitFor()
  if (await actions.getByRole('button', { name: 'Review Gmail send' }).count()) throw new Error('Old authorization survived revision')
  await actions.getByRole('button', { name: 'Prepare review request' }).click()
  await actions.getByRole('button', { name: 'Review Slack delivery' }).click()
  await actions.getByRole('button', { name: 'Send review to Slack' }).click()
  await actions.getByRole('link', { name: 'Open review in Slack' }).waitFor()
  // Synthetic fixture models a separate approved decision; the UI never invents send authorization.
  queue.generationInputs.warm_gmail_send_authorization = { status: 'approved', final_copy_fingerprint: fingerprint() }; version()
  await actions.getByRole('button', { name: 'Refresh review' }).click()
  await actions.getByRole('button', { name: 'Review Gmail send' }).click()
  await actions.getByText(/Live Gmail sending is disabled/).waitFor()
  await page.waitForTimeout(1500)
  await actions.screenshot({ path: `${output}/setup-blocked-${width}.png` })
  enableFixtureSend = true
  await actions.getByRole('button', { name: 'Review Gmail send' }).click()
  await actions.getByRole('button', { name: 'Send this Gmail draft', exact: true }).waitFor()
  await actions.evaluate(el => el.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(1800)
  await actions.screenshot({ path: `${output}/send-confirm-${width}.png` })
  await actions.getByRole('button', { name: 'Send this Gmail draft', exact: true }).click()
  await actions.getByText('Synthetic Gmail send receipt recorded.').waitFor()
  await actions.getByText('Receipt details', { exact: true }).click()
  await page.waitForTimeout(1400)
  await actions.screenshot({ path: `${output}/receipt-${width}.png` })
  if (await actions.getByRole('button', { name: 'Review Gmail send' }).count()) throw new Error('Duplicate send remains enabled')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  if (overflow || externalRequests.length || draftCalls !== 1 || sendCalls !== 1 || slackCalls !== 2 || updateCalls !== 1) throw new Error(JSON.stringify({ width, overflow, externalRequests, draftCalls, sendCalls }))
  const video = page.video(); await context.close()
  execFileSync('ffmpeg', ['-y','-i',await video.path(),'-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',`${output}/walkthrough-${width}.mp4`], { stdio: 'pipe' })
  runs.push({ width, overflow, externalRequests, draftCalls, updateCalls, sendCalls, slackCalls, oldApprovalInvalidated: true, authorization: 'separate synthetic persisted callback state', providerExecution: 'HTTP fixture only; real route contracts tested separately' })
}
await browser.close()
await writeFile(`${output}/receipt.json`, JSON.stringify({ runs }, null, 2))
console.log(output)
