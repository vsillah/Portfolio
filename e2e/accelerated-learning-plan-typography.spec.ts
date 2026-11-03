import { expect, test } from '@playwright/test'

test('Learning plan copy wraps without horizontal overflow in both themes', async ({ page }) => {
  test.setTimeout(120_000)
  for (const width of [390, 768, 781, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/service-prototypes/accelerated-cohort?view=3')
    const plan = page.getByRole('region', { name: 'Accelerated learning plan' })
    await expect(plan.getByRole('heading', { name: 'Sixteen lessons. One decision file.' })).toBeVisible()
    await expect(plan.getByRole('button', { name: /^L\d\d:/ })).toHaveCount(16)

    for (const theme of ['light', 'dark']) {
      const isDark = await page.locator('html').evaluate((element) => element.classList.contains('dark'))
      if ((theme === 'dark') !== isDark) await page.getByRole('button', { name: /mode/i }).first().click()
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/)
      for (let index = 1; index <= 16; index++) {
        const id = `L${String(index).padStart(2, '0')}`
        await plan.getByRole('button', { name: new RegExp(`^${id}:`) }).evaluate((element) => (element as HTMLButtonElement).click())
        await expect(plan.locator('article [class*=detailTop]')).toContainText(id)
        const layout = await plan.evaluate((root) => {
          const documentWidth = document.documentElement.scrollWidth
          const viewportWidth = document.documentElement.clientWidth
          const clipped = [...root.querySelectorAll('h2,h3,p,strong,small,span,figcaption,button,label')]
            .filter((element) => element.clientWidth && element.scrollWidth > element.clientWidth + 2)
            .map((element) => element.textContent?.trim().slice(0, 70))
          const catalog = root.querySelector('input')?.parentElement?.parentElement?.getBoundingClientRect()
          const rows = [...root.querySelectorAll('button[aria-label^="L"]')]
          const rowRights = rows.map((row) => row.getBoundingClientRect().right)
          return { documentWidth, viewportWidth, clipped, catalogWidth: catalog?.width ?? 0, rowRights, catalogRight: catalog?.right ?? 0 }
        })
        expect(layout.documentWidth, `${width}px ${theme} ${id} document overflow`).toBeLessThanOrEqual(layout.viewportWidth)
        expect(layout.clipped, `${width}px ${theme} ${id} clipped text`).toEqual([])
        expect(Math.max(...layout.rowRights), `${width}px ${theme} ${id} lesson rows`).toBeLessThanOrEqual(layout.catalogRight + 1)
        if (width === 781) expect(layout.catalogWidth).toBeGreaterThanOrEqual(730)
      }
    }
  }
})
