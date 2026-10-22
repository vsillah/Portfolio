#!/usr/bin/env node
import { mkdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright'

const revision = process.argv[2]
if (!/^[a-f0-9]{7,40}$/.test(revision ?? '')) throw new Error('Pass the reviewed Git commit SHA.')
const output = join(process.cwd(), 'docs/social-content/qa/official-campaign-handoff')
mkdirSync(output, { recursive: true })
const url = `http://127.0.0.1:5207/admin/social-content?officialQa=campaign-handoff-v1&rev=${revision}#official-campaign-handoff`
const browser = await chromium.launch({ headless: true })
try {
  for (const [name, width, height] of [['desktop-1440', 1440, 900], ['tablet-768', 768, 900], ['mobile-390', 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: 'dark',
      ...(name === 'tablet-768' ? {} : { recordVideo: { dir: output, size: { width, height } } }) })
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    const card = page.getByTestId('official-campaign-handoff')
    await card.waitFor({ state: 'visible' })
    await page.getByText('3 evidence gates to resolve').waitFor({ state: 'visible' })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (overflow > 1) throw new Error(`${name} has ${overflow}px horizontal overflow`)
    await card.screenshot({ path: join(output, `${name}.png`) })
    if (name !== 'tablet-768') {
      await page.waitForTimeout(650)
      await page.getByText('3 evidence gates to resolve').click()
      await page.waitForTimeout(350)
      await page.getByText('3 evidence gates to resolve').click()
      await page.waitForTimeout(700)
      await page.getByText('product visual proof missing').scrollIntoViewIfNeeded()
      await page.waitForTimeout(900)
      await page.getByRole('button', { name: 'Prepare exact review handoff' }).scrollIntoViewIfNeeded()
      await page.waitForTimeout(900)
    }
    const video = page.video()
    await context.close()
    if (video) {
      const source = await video.path()
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', source, '-c:v', 'libx264', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(output, `${name}.mp4`)])
      unlinkSync(source)
    }
    process.stdout.write(`${name}: ${url}\n`)
  }
} finally {
  await browser.close()
}
