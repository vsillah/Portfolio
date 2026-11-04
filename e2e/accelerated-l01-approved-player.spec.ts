import { expect, test } from '@playwright/test'

test('approved L01 player, captions, transcript, return, and locked later lessons work without external requests', async ({ page }) => {
  test.setTimeout(120_000)
  const external: string[] = []
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      external.push(route.request().url())
      return route.abort()
    }
    return route.continue()
  })

  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/service-prototypes/accelerated-cohort?view=3&rev=approved-l01')
    const plan = page.getByRole('region', { name: 'Accelerated learning plan' })
    for (const theme of ['light', 'dark']) {
      const isDark = await page.locator('html').evaluate((element) => element.classList.contains('dark'))
      if ((theme === 'dark') !== isDark) await page.getByRole('button', { name: /mode/i }).first().click()
      await plan.getByRole('button', { name: 'Watch L01 guided video · 09:00' }).click()
      const video = plan.getByLabel('L01 Build smarter, stay human guided video')
      await expect(video).toBeVisible()
      await expect(video.locator('track')).toHaveAttribute('src', /l01-approved-captions\.vtt$/)
      await expect(plan.getByRole('button', { name: 'English captions on' })).toHaveAttribute('aria-pressed', 'true')
      await plan.getByText('Read along with L01 transcript').click()
      await expect(plan.getByText('The document is open. At the top it says, Q3 Innovation Plan.')).toBeVisible()
      const bounds = await plan.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }))
      expect(bounds.document, `${width}px ${theme} overflow`).toBeLessThanOrEqual(bounds.viewport)
      await plan.getByRole('button', { name: /Return to Learning plan/ }).click()
      await expect(video).toHaveCount(0)
      await plan.getByRole('button', { name: /^L02:/ }).click()
      await expect(plan.getByRole('button', { name: /Watch L02 guided video/ })).toBeDisabled()
      await plan.getByRole('button', { name: /^L16:/ }).click()
      await expect(plan.getByRole('button', { name: /Watch L16 guided video/ })).toBeDisabled()
      await plan.getByRole('button', { name: /^L01:/ }).click()
    }
  }
  expect(external.filter((url) => /heygen|api\/video|accelerated.*provider/i.test(url))).toEqual([])
})
