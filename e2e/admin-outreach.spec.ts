import { test, expect, type Page } from '@playwright/test'

async function waitForAdminContentOrLogin(page: Page, contentPattern: RegExp) {
  await expect
    .poll(
      async () => {
        const url = page.url()
        const mainText = await page.locator('main').innerText().catch(() => '')
        const bodyText = await page.locator('body').innerText().catch(() => '')
        return (
          url.includes('/auth/login') ||
          /sign in|log in/i.test(bodyText) ||
          contentPattern.test(mainText)
        )
      },
      { timeout: 7000 },
    )
    .toBe(true)
}

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
    await waitForAdminContentOrLogin(page, /all leads|manage all leads|escalations/i)
  })

  test('Leads tab is available and shows All leads filter or empty state', async ({ page }) => {
    await page.goto('/admin/outreach?tab=leads')
    await waitForAdminContentOrLogin(page, /all leads|warm|cold|no leads|search leads/i)
  })

  test('Message Queue tab is not shown (single email history: Email center)', async ({ page }) => {
    await page.goto('/admin/outreach?tab=leads')
    await waitForAdminContentOrLogin(page, /all leads|warm|cold|no leads|search leads/i)
    const hasQueueTab = await page.getByRole('button', { name: /message queue/i }).count()
    const hasSignIn = await page.getByText(/sign in|log in/i).first().isVisible().catch(() => false)
    expect(hasQueueTab === 0 || hasSignIn).toBe(true)
  })
})
