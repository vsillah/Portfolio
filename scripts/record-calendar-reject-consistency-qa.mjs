import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { chromium, expect } from '@playwright/test'

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3107'
const authStatePath = process.env.PLAYWRIGHT_AUTH_STATE || path.join(process.cwd(), '.auth/calendar-reject-qa-storage-state.json')
const outputDir = process.env.QA_OUTPUT_DIR || path.join(process.cwd(), 'docs/qa')
const videoDir = path.join(outputDir, '.calendar-reject-video')

if (!existsSync(authStatePath)) {
  throw new Error(`Auth state not found: ${authStatePath}`)
}

mkdirSync(outputDir, { recursive: true })
mkdirSync(videoDir, { recursive: true })

const campaign = {
  id: 'campaign-qa',
  name: 'Synthetic Calendar QA Campaign',
  slug: 'synthetic-calendar-qa',
  description: 'Privacy-safe fixture for calendar rejection QA.',
  campaign_type: 'standard',
  status: 'draft',
  starts_at: '2099-08-20T00:00:00.000Z',
  ends_at: '2099-08-30T00:00:00.000Z',
  completion_window_days: 30,
  campaign_eligible_bundles: [],
  campaign_criteria_templates: [],
  calendar_item_count: 1,
  next_calendar_item: null,
}

const rejectedCalendarItem = {
  id: 'qa-calendar-rejected',
  campaign_id: campaign.id,
  agent_work_item_id: 'qa-work-revision',
  social_content_id: null,
  channel: 'linkedin',
  campaign_phase: 'teach',
  title: 'Rejected calendar authorization',
  planned_angle: 'Revise the proof point before creating an internal draft handoff.',
  scheduled_for: '2099-08-22T14:00:00.000Z',
  due_status: 'planned',
  authorization_status: 'rejected',
  authorization_due_at: '2099-08-21T14:00:00.000Z',
  autonomy_eligible: false,
  metadata: {
    authorization_decision_note: 'Clarify the evidence source before this can be authorized.',
    returned_to_shaka: true,
    revision_work_item_id: 'qa-work-revision',
    external_execution_enabled: false,
    template_label: 'Synthetic QA calendar',
    source_labels: ['Synthetic fixture'],
  },
  attraction_campaigns: {
    id: campaign.id,
    name: campaign.name,
    slug: campaign.slug,
  },
  agent_work_items: {
    id: 'qa-work-revision',
    title: 'Revise synthetic calendar handoff',
    status: 'proposed',
  },
  social_content_queue: null,
}

async function installRoutes(page) {
  const syntheticUser = {
    id: 'qa-admin-user',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'qa-admin@example.test',
  }
  await page.route('**/auth/v1/token?**', async (route) => {
    await route.fulfill({
      json: {
        access_token: 'qa-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'qa-refresh-token',
        user: syntheticUser,
      },
    })
  })
  await page.route('**/auth/v1/user', async (route) => {
    await route.fulfill({
      json: {
        user: syntheticUser,
      },
    })
  })
  await page.route('**/api/user/profile**', async (route) => {
    await route.fulfill({
      json: {
        profile: {
          id: 'qa-admin-user',
          email: 'qa-admin@example.test',
          full_name: 'QA Admin',
          role: 'admin',
          created_at: '2099-01-01T00:00:00.000Z',
          updated_at: '2099-01-01T00:00:00.000Z',
        },
      },
    })
  })
  await page.route('**/api/admin/social-content/intelligence/research-packets?**', async (route) => {
    await route.fulfill({ json: { packets: [] } })
  })
  await page.route('**/api/admin/agents/work-items?**', async (route) => {
    await route.fulfill({ json: { work_items: [] } })
  })
  await page.route('**/api/admin/social-content/intelligence/daily-digest?**', async (route) => {
    await route.fulfill({ json: { digest: null } })
  })
  await page.route('**/api/admin/social-content/intelligence/autoresearch-backlog', async (route) => {
    await route.fulfill({
      json: {
        items: [],
        summary: {
          total: 0,
          readyForInternalHandoff: 0,
          blockedOrManual: 0,
          callableExternalActions: 0,
        },
        opportunity_summary: {
          total: 0,
          highPriority: 0,
          channels: [],
          requiresHumanGate: 0,
        },
        opportunities: [],
        side_effects: {
          provider_generation: false,
          upload: false,
          external_schedule: false,
          publish: false,
          external_post: false,
        },
        callable_external_actions: [],
      },
    })
  })
  await page.route('**/api/admin/social-content/calendar?**', async (route) => {
    await route.fulfill({ json: { items: [rejectedCalendarItem] } })
  })
  await page.route('**/api/admin/campaigns?**', async (route) => {
    await route.fulfill({ json: { data: [campaign] } })
  })
  await page.route(`**/api/admin/campaigns/${campaign.id}`, async (route) => {
    await route.fulfill({
      json: {
        data: {
          ...campaign,
          social_content_calendar_items: [rejectedCalendarItem],
        },
      },
    })
  })
  await page.route(`**/api/admin/campaigns/${campaign.id}/enrollments`, async (route) => {
    await route.fulfill({ json: { data: [] } })
  })
  await page.route('**/api/admin/sales/bundles', async (route) => {
    await route.fulfill({ json: { data: [] } })
  })
}

async function annotate(page, label) {
  await page.evaluate((text) => {
    document.getElementById('calendar-reject-qa-note')?.remove()
    const panel = document.createElement('aside')
    panel.id = 'calendar-reject-qa-note'
    panel.textContent = text
    panel.style.position = 'fixed'
    panel.style.right = '12px'
    panel.style.bottom = '12px'
    panel.style.zIndex = '9999'
    panel.style.maxWidth = '360px'
    panel.style.padding = '10px 12px'
    panel.style.border = '1px solid rgba(255,255,255,0.24)'
    panel.style.borderRadius = '8px'
    panel.style.background = 'rgba(5,10,20,0.92)'
    panel.style.color = 'white'
    panel.style.font = '600 12px/1.45 system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
    panel.style.boxShadow = '0 16px 40px rgba(0,0,0,0.35)'
    document.body.appendChild(panel)
  }, label)
}

async function verifyNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(2)
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  storageState: authStatePath,
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
})
const page = await context.newPage()
await installRoutes(page)

await page.goto(`${baseUrl}/admin/agents/content-intelligence?section=calendar&calendar_item=${rejectedCalendarItem.id}#content-calendar-gate`, {
  waitUntil: 'networkidle',
})
await annotate(page, 'Desktop Content Intelligence: rejected calendar row must show locked state, no authorize/reject, and an edit recovery action.')
const contentRow = page.locator('[aria-label="Focused calendar row Rejected calendar authorization"]')
await expect(contentRow).toContainText('Calendar authorization rejected')
await expect(contentRow).toContainText('Decision note: Clarify the evidence source before this can be authorized.')
await expect(contentRow.getByRole('button', { name: 'Edit and Return to Review' })).toBeVisible()
await expect(contentRow.getByRole('button', { name: 'Authorize Draft Handoff' })).toHaveCount(0)
await expect(contentRow.getByRole('button', { name: 'Reject' })).toHaveCount(0)
await verifyNoHorizontalOverflow(page)
await page.waitForTimeout(900)

await contentRow.getByRole('button', { name: 'Edit and Return to Review' }).click()
await annotate(page, 'Recovery check: edit form opens; saving changes is the existing path that returns the row to pending review.')
await expect(contentRow.getByRole('button', { name: 'Save Changes' })).toBeVisible()
await expect(contentRow.getByRole('button', { name: 'Authorize Draft Handoff' })).toHaveCount(0)
await expect(contentRow.getByRole('button', { name: 'Reject' })).toHaveCount(0)
await page.waitForTimeout(900)

await page.goto(`${baseUrl}/admin/campaigns/${campaign.id}`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Content Calendar/ }).click()
await annotate(page, 'Campaign calendar: same rejected state model; recovery links back to the central calendar gate.')
const campaignRow = page.locator('[aria-label="Campaign calendar row Rejected calendar authorization"]')
await expect(campaignRow).toContainText('Calendar authorization rejected')
await expect(campaignRow.getByRole('link', { name: 'Edit and Return to Review' })).toHaveAttribute(
  'href',
  `/admin/agents/content-intelligence?section=calendar&calendar_item=${rejectedCalendarItem.id}#content-calendar-gate`,
)
await expect(campaignRow.getByRole('button', { name: 'Authorize Draft Handoff' })).toHaveCount(0)
await expect(campaignRow.getByRole('button', { name: 'Reject' })).toHaveCount(0)
await verifyNoHorizontalOverflow(page)
await page.waitForTimeout(900)

await page.setViewportSize({ width: 390, height: 844 })
await page.goto(`${baseUrl}/admin/agents/content-intelligence?section=calendar&calendar_item=${rejectedCalendarItem.id}#content-calendar-gate`, {
  waitUntil: 'networkidle',
})
await annotate(page, 'Mobile 390px: locked rejected row remains readable and recovery stays visible without horizontal overflow.')
const mobileRow = page.locator('[aria-label="Focused calendar row Rejected calendar authorization"]')
await expect(mobileRow).toContainText('Calendar authorization rejected')
await expect(mobileRow.getByRole('button', { name: 'Edit and Return to Review' })).toBeVisible()
await expect(mobileRow.getByRole('button', { name: 'Authorize Draft Handoff' })).toHaveCount(0)
await expect(mobileRow.getByRole('button', { name: 'Reject' })).toHaveCount(0)
await verifyNoHorizontalOverflow(page)
await page.waitForTimeout(1200)

const video = page.video()
await context.close()
await browser.close()

const sourceVideo = await video.path()
console.log(JSON.stringify({
  ok: true,
  sourceVideo,
  route: `${baseUrl}/admin/agents/content-intelligence?section=calendar&calendar_item=${rejectedCalendarItem.id}#content-calendar-gate`,
  campaignRoute: `${baseUrl}/admin/campaigns/${campaign.id}`,
}))
