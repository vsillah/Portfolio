import { test, expect } from '@playwright/test'

const slugs = ['ai-lead-chatbot', 'lead-workflow-agent', 'website-ux-refresh', 'accelerated-cohort', 'self-paced-course', 'premium-masterclass']

for (const slug of slugs) {
  test(`${slug} has usable views at desktop, tablet and mobile widths`, async ({ page }) => {
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/service-prototypes/${slug}`)
      await expect(page.locator('[data-prototype]')).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'Experience views' }).getByRole('button')).toHaveCount(3)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.getByRole('button', { name: 'Dark mode' }).click()
      await expect(page.getByRole('button', { name: 'Light mode' })).toBeVisible()
      await page.getByRole('button', { name: 'Light mode' }).click()
      await page.getByRole('navigation', { name: 'Experience views' }).getByRole('button').nth(1).click()
      await expect(page.getByRole('navigation', { name: 'Experience views' }).getByRole('button').nth(1)).toHaveAttribute('aria-current', 'page')
    }
  })
}

test('chatbot consent gates operator follow-up', async ({ page }) => {
  await page.goto('/service-prototypes/ai-lead-chatbot?view=2')
  await page.getByRole('button', { name: 'Taylor Reed' }).click()
  await expect(page.getByRole('button', { name: 'Assign human follow-up' })).toBeDisabled()
  await page.getByRole('button', { name: 'Morgan Ellis' }).click()
  await page.getByRole('button', { name: 'Assign human follow-up' }).click()
  await expect(page.getByText('Handoff recorded for review')).toBeVisible()
})

test('workflow exception can recover with an audit entry', async ({ page }) => {
  await page.goto('/service-prototypes/lead-workflow-agent?view=3')
  await page.getByRole('button', { name: 'Retry lookup' }).click()
  await expect(page.getByText('Retry succeeded; human review resumed')).toBeVisible()
})

test('cohort exercise and course assessment provide useful blocked states', async ({ page }) => {
  await page.goto('/service-prototypes/accelerated-cohort')
  await expect(page.getByRole('button', { name: 'Save exercise' })).toBeDisabled()
  await page.getByRole('textbox', { name: 'The decision we need to make' }).fill('Which inquiry should staff answer first?')
  await page.getByRole('button', { name: 'Save exercise' }).click()
  await expect(page.getByText('Saved locally for this preview.')).toBeVisible()
  await page.goto('/service-prototypes/self-paced-course?view=3')
  await expect(page.getByRole('button', { name: 'Submit answer' })).toBeDisabled()
  await page.getByLabel('Name the decision').check()
  await page.getByRole('button', { name: 'Submit answer' }).click()
  await expect(page.getByText('Certificate milestone unlocked for this preview')).toBeVisible()
})

test('canonical Accelerated cover stays in the cohort hero without hiding the workspace', async ({ page }) => {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/service-prototypes/accelerated-cohort')
    const cover = page.getByTestId('accelerated-cover')
    await expect(cover).toBeVisible()
    await expect(cover).toHaveAttribute('alt', 'Accelerated: Building Smarter Products with AI book cover by Vambah Sillah')
    const image = await cover.evaluate((element) => {
      const img = element as HTMLImageElement
      const rect = img.getBoundingClientRect()
      return { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom }
    })
    expect(image.naturalWidth).toBe(1800)
    expect(image.naturalHeight).toBe(2700)
    expect(image.width / image.height).toBeCloseTo(2 / 3, 2)
    expect(image.top).toBeGreaterThanOrEqual(0)
    expect(image.bottom).toBeLessThan(900)
    expect(await page.getByRole('heading', { name: 'Your cohort workspace' }).evaluate((element) => element.getBoundingClientRect().top)).toBeLessThan(900)
  }
})

test('approved SAM art is readable through full, focused and zoom views', async ({ page }) => {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/service-prototypes/accelerated-cohort')
    const artwork = page.getByTestId('sam-artifact').locator('img')
    await expect(artwork).toHaveAttribute('src', /accelerated-sam-infographic\.png/)
    await page.getByRole('group', { name: 'Framework views' }).getByRole('button', { name: 'Signals' }).click()
    await expect(artwork).toHaveAttribute('src', /accelerated-sam-signals\.png/)
    await page.getByRole('group', { name: 'Framework views' }).getByRole('button', { name: 'Alignment' }).click()
    await expect(artwork).toHaveAttribute('src', /accelerated-sam-alignment\.png/)
    await page.getByRole('group', { name: 'Framework views' }).getByRole('button', { name: 'Momentum' }).click()
    await expect(artwork).toHaveAttribute('src', /accelerated-sam-momentum\.png/)
    await page.getByRole('button', { name: 'Zoom full SAM infographic' }).click()
    const dialog = page.getByRole('dialog', { name: 'Full Signals, Alignment, Momentum infographic' })
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('img')).toHaveAttribute('src', /accelerated-sam-infographic\.png/)
    await page.getByRole('button', { name: 'Close infographic' }).click()
    await expect(dialog).not.toBeVisible()
    await page.getByRole('navigation', { name: 'Experience views' }).getByRole('button').nth(1).click()
    await expect(artwork).toHaveAttribute('src', /accelerated-sam-signals\.png/)
    await page.getByRole('navigation', { name: 'Experience views' }).getByRole('button').nth(2).click()
    await expect(artwork).toHaveAttribute('src', /accelerated-sam-alignment\.png/)
  }
})
