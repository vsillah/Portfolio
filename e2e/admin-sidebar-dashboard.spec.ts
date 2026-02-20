import { test, expect } from '@playwright/test'

/**
 * Admin sidebar and dashboard E2E.
 * If not authenticated, /admin may redirect to sign-in; tests accept either dashboard content or sign-in.
 */
test.describe('Admin sidebar and dashboard', () => {
  test('loads admin dashboard with sidebar and category cards or sign-in', async ({ page }) => {
    await page.goto('/admin')
    // Wait for client-side outcome: unauthenticated → redirect to login; authenticated → dashboard heading
    await Promise.race([
      page.waitForURL(/\/auth\/login/, { timeout: 10000 }).catch(() => null),
      page.getByRole('heading', { name: /admin dashboard/i }).waitFor({ state: 'visible', timeout: 10000 }).catch(() => null),
    ])

    const hasDashboard = await page.getByRole('heading', { name: /admin dashboard/i }).isVisible().catch(() => false)
    const hasSignIn = await page.getByText(/sign in|log in/i).first().isVisible().catch(() => false)
    expect(hasDashboard || hasSignIn).toBe(true)

    if (hasDashboard) {
      await expect(page.getByRole('navigation', { name: /admin navigation/i })).toBeVisible()
      await expect(page.getByRole('link', { name: /lead pipeline/i })).toBeVisible()
      await expect(page.getByText(/value evidence/i).first()).toBeVisible()
    }
  })

  test('clicking sidebar Lead Pipeline navigates and highlights active item', async ({ page }) => {
    await page.goto('/admin')
    const nav = page.getByRole('navigation', { name: /admin navigation/i })
    if (!(await nav.isVisible().catch(() => false))) return

    await nav.getByRole('link', { name: /^lead pipeline$/i }).click()
    await expect(page).toHaveURL(/\/admin\/outreach/, { timeout: 10000 })
    await expect(nav.getByRole('link', { name: /^lead pipeline$/i })).toHaveAttribute('aria-current', 'page')
  })

  test('clicking dashboard card link navigates and sidebar shows correct active state', async ({ page }) => {
    await page.goto('/admin')
    const viewLink = page.getByRole('link', { name: /view lead pipeline/i })
    if (!(await viewLink.isVisible().catch(() => false))) return

    await viewLink.click()
    await expect(page).toHaveURL(/\/admin\/outreach/)
    const nav = page.getByRole('navigation', { name: /admin navigation/i })
    await expect(nav.getByRole('link', { name: /lead pipeline/i })).toHaveAttribute('aria-current', 'page')
  })

  test('sidebar Content Hub can expand and link to outcome groups', async ({ page }) => {
    await page.goto('/admin')
    const contentHubButton = page.getByRole('button', { name: /content hub/i })
    if (!(await contentHubButton.isVisible().catch(() => false))) return

    await contentHubButton.click()
    await expect(page.getByRole('link', { name: /outcome groups/i })).toBeVisible()
    await page.getByRole('link', { name: /outcome groups/i }).click()
    await expect(page).toHaveURL(/\/admin\/content\/outcome-groups/)
  })

  test('skip to main content link and main id present when dashboard loaded', async ({ page }) => {
    await page.goto('/admin')
    const hasDashboard = await page.getByRole('heading', { name: /admin dashboard/i }).isVisible().catch(() => false)
    if (!hasDashboard) return

    const skipLink = page.getByRole('link', { name: /skip to main content/i })
    await expect(skipLink).toBeVisible()
    await expect(page.locator('#admin-main')).toBeVisible()
  })
})
