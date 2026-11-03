import { expect, test } from '@playwright/test'

for (const width of [390, 1440]) {
  test(`L01 scene navigation opens the selected player state at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/service-prototypes/accelerated-cohort/l01-review?rev=scene-navigation-qa')
    await expect(page.locator('[data-scene]')).toHaveAttribute('data-scene', 'L01-01')

    await page.getByRole('button', { name: /02:45 The map, with the book underneath/ }).click()

    await expect(page).toHaveURL(/\/l01-review\?rev=scene-navigation-qa&t=165$/)
    await expect(page.locator('[data-scene]')).toHaveAttribute('data-scene', 'L01-03')
    await expect(page.getByRole('slider', { name: 'Seek animatic' })).toHaveValue('165')
    await expect(page.getByText('WORKSHOP MAP')).toBeVisible()
    await expect(page.getByText('02:45 / 09:00')).toBeVisible()
    await expect(page.getByRole('button', { name: /02:45 The map, with the book underneath/ })).toHaveAttribute('aria-current', 'step')
  })
}

test.describe('without client hydration', () => {
  test.use({ javaScriptEnabled: false })

  test('the native scene form opens Scene 3 at 02:45', async ({ page }) => {
    await page.goto('/service-prototypes/accelerated-cohort/l01-review?rev=no-hydration-qa')
    await page.getByRole('button', { name: /02:45 The map, with the book underneath/ }).click()

    await expect(page).toHaveURL(/\/l01-review\?rev=no-hydration-qa&t=165$/)
    await expect(page.locator('[data-scene]')).toHaveAttribute('data-scene', 'L01-03')
    await expect(page.getByRole('slider', { name: 'Seek animatic' })).toHaveValue('165')
    await expect(page.getByText('02:45 / 09:00')).toBeVisible()
  })
})
