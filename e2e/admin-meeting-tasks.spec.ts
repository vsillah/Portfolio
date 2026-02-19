import { test, expect } from '@playwright/test'

test.describe('Admin Meeting Tasks Page', () => {
  test('loads the meeting tasks page and shows client filter', async ({ page }) => {
    await page.goto('/admin/meeting-tasks')

    // Wait for page to finish loading (auth check + data fetch)
    await expect(
      page.getByRole('heading', { name: /meeting action tasks/i })
    ).toBeVisible({ timeout: 15000 })

    // New "by client" UI: filter dropdown with "All clients" option
    const clientFilter = page.getByRole('combobox').filter({ has: page.locator('option', { hasText: 'All clients' }) })
    await expect(clientFilter).toBeVisible()
  })

  test('displays Action Items and Client Update Drafts tabs', async ({ page }) => {
    await page.goto('/admin/meeting-tasks')

    await expect(page.getByRole('heading', { name: /meeting action tasks/i })).toBeVisible({ timeout: 15000 })

    await expect(page.getByRole('tab', { name: /action items/i }).or(page.getByText(/action items/i))).toBeVisible()
    await expect(page.getByRole('tab', { name: /client update drafts/i }).or(page.getByText(/client update drafts/i))).toBeVisible()
  })
})

test.describe('Admin Meeting Tasks API Smoke', () => {
  test('GET /api/meeting-action-tasks/projects returns 401 without auth', async ({ request }) => {
    const response = await request.get('/api/meeting-action-tasks/projects')
    expect(response.status()).toBe(401)
  })
})
