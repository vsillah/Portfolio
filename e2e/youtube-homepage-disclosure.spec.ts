import { expect, test } from '@playwright/test'

test.use({ storageState: undefined })

test('public homepage presents YouTube use and privacy link at three widths', async ({ page }) => {
  test.setTimeout(90_000)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route('**/*', (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() !== 'GET' || !['localhost', '127.0.0.1'].includes(url.hostname)) {
      return route.abort()
    }
    return route.continue()
  })

  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await page.goto('/?review=youtube-homepage-disclosure', { waitUntil: 'domcontentloaded' })

    const footer = page.getByRole('contentinfo', { name: 'YouTube API Services' })
    await expect(footer).toBeVisible()
    await expect(footer).toContainText('connected AmaduTown channel workflows')
    await expect(footer).toContainText('under review and inactive')
    await expect(footer.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/legal/privacy')
    await expect(footer.getByRole('link', { name: 'Data deletion' })).toHaveAttribute('href', '/legal/data-deletion')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  }

  const privacyLink = page.getByRole('contentinfo', { name: 'YouTube API Services' }).getByRole('link', { name: 'Privacy Policy' })
  await privacyLink.focus()
  await expect(privacyLink).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/legal\/privacy$/)
  await expect(page.getByRole('heading', { name: 'Privacy Policy', exact: true })).toBeVisible()
  expect(pageErrors).toEqual([])
})
