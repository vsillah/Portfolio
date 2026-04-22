import { test, expect } from '@playwright/test'

/**
 * Smoke tests for Admin Lead Pipeline (All Leads + Escalations).
 * Covers critical paths in docs/regression-smoke-checklist.md.
 * Auth may redirect to login; UI tests accept either authenticated content or sign-in.
 */
test.describe('Admin Outreach API', () => {
  test('GET /api/admin/outreach/leads with filter=all returns 200 or 401', async ({ request }) => {
    const response = await request.get('/api/admin/outreach/leads?filter=all&limit=10&offset=0')
    expect([200, 401, 403]).toContain(response.status())
    if (response.ok()) {
      const data = await response.json()
      expect(data).toHaveProperty('leads')
      expect(data).toHaveProperty('total')
      expect(Array.isArray(data.leads)).toBe(true)
    }
  })

  test('GET /api/admin/outreach returns 200 or 401', async ({ request }) => {
    const response = await request.get('/api/admin/outreach?status=all&limit=10')
    expect([200, 401, 403]).toContain(response.status())
    if (response.ok()) {
      const data = await response.json()
      expect(data).toHaveProperty('items')
      expect(Array.isArray(data.items)).toBe(true)
    }
  })
})

test.describe('Admin Outreach UI', () => {
  test('Outreach page loads (Leads tab or sign-in)', async ({ page }) => {
    await page.goto('/admin/outreach')
    // Either we see lead pipeline content or we are on sign-in
    const hasOutreach = await page.getByText(/leads|manage all leads|lead pipeline/i).first().isVisible().catch(() => false)
    const hasSignIn = await page.getByText(/sign in|log in/i).first().isVisible().catch(() => false)
    expect(hasOutreach || hasSignIn).toBe(true)
  })

  test('Leads tab is available and shows All leads filter or empty state', async ({ page }) => {
    await page.goto('/admin/outreach?tab=leads')
    // Either leads tab content (All leads, Warm, Cold, or empty state) or sign-in
    const hasLeadsContent = await page
      .getByText(/all leads|warm|cold|no leads|search leads/i)
      .first()
      .isVisible()
      .catch(() => false)
    const hasSignIn = await page.getByText(/sign in|log in/i).first().isVisible().catch(() => false)
    expect(hasLeadsContent || hasSignIn).toBe(true)
  })

  test('Message Queue tab is not shown (single email history: Email center)', async ({ page }) => {
    await page.goto('/admin/outreach?tab=leads')
    const hasQueueTab = await page.getByRole('button', { name: /message queue/i }).count()
    const hasSignIn = await page.getByText(/sign in|log in/i).first().isVisible().catch(() => false)
    expect(hasQueueTab === 0 || hasSignIn).toBe(true)
  })
})
