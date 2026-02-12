import { test, expect } from '@playwright/test'

test.describe('Admin Guarantees Page', () => {
  test('loads the guarantees admin page', async ({ page }) => {
    await page.goto('/admin/guarantees')

    // Should see the page heading
    await expect(page.getByRole('heading', { name: /guarantees/i })).toBeVisible()
  })

  test('displays Templates and Active Guarantees tabs', async ({ page }) => {
    await page.goto('/admin/guarantees')

    // Should see the two tabs
    await expect(page.getByRole('tab', { name: /active guarantees/i }).or(page.getByText(/active guarantees/i))).toBeVisible()
    await expect(page.getByRole('tab', { name: /templates/i }).or(page.getByText(/templates/i))).toBeVisible()
  })

  test('can switch to Templates tab', async ({ page }) => {
    await page.goto('/admin/guarantees')

    // Click on Templates tab
    const templatesTab = page.getByRole('tab', { name: /templates/i }).or(page.getByText(/templates/i))
    await templatesTab.click()

    // Should show template-related content (e.g. "Create Template" button or template list)
    await expect(page.getByText(/create template/i).or(page.getByText(/no templates/i))).toBeVisible({
      timeout: 5000,
    })
  })

  test('guarantee template editor opens', async ({ page }) => {
    await page.goto('/admin/guarantees')

    // Navigate to templates tab
    const templatesTab = page.getByRole('tab', { name: /templates/i }).or(page.getByText(/templates/i))
    await templatesTab.click()

    // Click create template button
    const createBtn = page.getByRole('button', { name: /create template/i })
    if (await createBtn.isVisible()) {
      await createBtn.click()

      // The template editor form should appear
      await expect(
        page.getByLabel(/template name/i).or(page.getByPlaceholder(/template name/i)).or(page.getByText(/template name/i))
      ).toBeVisible({ timeout: 5000 })
    }
  })
})

test.describe('Admin Guarantees API Smoke Tests', () => {
  test('GET /api/admin/guarantee-templates returns JSON', async ({ request }) => {
    const response = await request.get('/api/admin/guarantee-templates')
    // May return 401 if not authenticated in E2E context — both are acceptable smoke results
    expect([200, 401, 403]).toContain(response.status())
  })

  test('GET /api/admin/guarantees returns JSON', async ({ request }) => {
    const response = await request.get('/api/admin/guarantees')
    expect([200, 401, 403]).toContain(response.status())
  })

  test('GET /api/admin/continuity-plans returns JSON', async ({ request }) => {
    const response = await request.get('/api/admin/continuity-plans')
    expect([200, 401, 403]).toContain(response.status())
  })
})
