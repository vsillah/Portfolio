import { expect, test } from '@playwright/test'

for (const width of [1440, 768, 360]) {
  test(`Decision File keeps one full-width lesson row at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/accelerated/decision-file')

    const rows = page.locator('label[for^="decision-file-page-"]')
    await expect(rows).toHaveCount(16)
    for (const act of ['Signals', 'Alignment', 'Momentum', 'Synthesis']) {
      await expect(page.getByRole('heading', { name: act, exact: true })).toBeVisible()
    }
    await expect(page.getByRole('button', { name: 'Save all pages' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Download copy' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete all answers' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Review and send' })).toBeVisible()

    const layout = await rows.evaluateAll((elements) => elements.map((element) => {
      const row = element.getBoundingClientRect()
      const parent = element.parentElement!.getBoundingClientRect()
      const textarea = element.querySelector('textarea')!.getBoundingClientRect()
      return { rowX: row.x, rowY: row.y, rowWidth: row.width, parentX: parent.x, parentWidth: parent.width, textareaWidth: textarea.width }
    }))
    for (const [index, row] of layout.entries()) {
      expect(Math.abs(row.rowX - row.parentX), `L${index + 1} starts at the group edge`).toBeLessThan(2)
      expect(row.rowWidth, `L${index + 1} spans the group`).toBeGreaterThanOrEqual(row.parentWidth - 2)
      expect(row.textareaWidth, `L${index + 1} has a usable response field`).toBeGreaterThan(200)
      if (index > 0) expect(row.rowY, `L${index + 1} follows the previous lesson`).toBeGreaterThan(layout[index - 1].rowY)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  })
}
