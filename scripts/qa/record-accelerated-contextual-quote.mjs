// Synthetic, privacy-safe QA capture. No account, payment, quote submission, or provider call.
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright-core'

const origin = process.env.QA_ORIGIN || 'http://localhost:3146'
const output = path.join(process.cwd(), 'docs/qa/accelerated-member-commerce')
await fs.mkdir(output, { recursive: true })
const raw = path.join(output, 'raw')
await fs.mkdir(raw, { recursive: true })
const browser = await chromium.launch({ headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] })

const workshop = {
  id: '22222222-2222-4222-8222-222222222222', title: 'In-person strategy workshop',
  description: 'A facilitated working session to set priorities.', service_type: 'workshop',
  delivery_method: 'in_person', duration_hours: 4, duration_description: 'Half day',
  price: 1800, is_quote_based: false, min_participants: 2, max_participants: 20,
  image_url: '/ATAS_Innovation_Workshop.webp', is_featured: false,
}

// Warm local route compilation before the timed capture begins.
await Promise.all([
  fetch(`${origin}/member/quote?qa=quote&rev=warm`),
  fetch(`${origin}/services/22222222-2222-4222-8222-222222222222?fromQuote=qa`),
])

for (const [name, width, height] of [['desktop', 1280, 800], ['mobile', 390, 844]]) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  await page.route('**/api/services/22222222-2222-4222-8222-222222222222/bundles', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ bundles: [] }) }))
  await page.route('**/api/services/22222222-2222-4222-8222-222222222222', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(workshop) }))
  await page.goto(`${origin}/member/quote?qa=quote&rev=catalog-recording`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Active catalog' }).waitFor()
  // Chrome's Playwright WebM leaves a gray strip below the page on some hosts.
  // Capture the actual viewport at each step so the delivered MP4 has no crop.
  const frames = path.join(raw, `accelerated-member-${name}-frames`)
  await fs.rm(frames, { recursive: true, force: true })
  await fs.mkdir(frames)
  const captured = []
  let recording = true
  const capture = (async () => {
    while (recording) {
      const filename = `frame-${String(captured.length).padStart(5, '0')}.jpg`
      try {
        const screenshot = await page.screenshot({ type: 'jpeg', quality: 82, timeout: 10000 })
        await fs.writeFile(path.join(frames, filename), screenshot)
        captured.push({ filename, at: Date.now() })
      } catch (error) {
        if (recording) throw error
      }
      await new Promise((resolve) => setTimeout(resolve, 80))
    }
  })()
  await page.waitForTimeout(800)
  if (name === 'mobile') await page.getByText('Refine options · 5 questions').click()
  await page.getByRole('radio', { name: 'In person' }).check()
  await page.getByText(/1 matching options · 3 filtered out/).waitFor()
  await page.waitForTimeout(650)
  if (name === 'mobile') await page.getByText('Refine options · 5 questions').click()
  const workshopCard = page.getByRole('heading', { name: 'In-person strategy workshop' }).locator('..')
  await workshopCard.getByRole('button', { name: 'Add to Cart' }).click()
  await page.getByRole('link', { name: 'Cart (1)' }).waitFor()
  await page.locator('a[href*="/services/22222222-2222-4222-8222-222222222222?fromQuote=qa"]').last().click()
  await page.getByRole('link', { name: 'Back to quote catalog' }).waitFor()
  await page.waitForTimeout(900)
  await page.getByRole('link', { name: 'Back to quote catalog' }).click()
  await page.getByText(/1 matching options · 3 filtered out/).waitFor()
  assert.equal(await page.getByRole('link', { name: 'Cart (1)' }).count(), 1)
  await page.waitForTimeout(550)
  if (name === 'mobile') await page.getByText('Refine options · 5 questions').click()
  await page.getByRole('radio', { name: 'Remote' }).check()
  await page.getByText(/2 matching options · 2 filtered out/).waitFor()
  if (name === 'mobile') await page.getByText('Refine options · 5 questions').click()
  await page.getByRole('button', { name: 'Request Quote' }).last().click()
  await page.getByText('This alternative is a request for review. Your approved recommendation has not changed.').waitFor()
  assert.equal(await page.getByRole('button', { name: 'Send for operator review' }).isDisabled(), true)
  await page.waitForTimeout(1000)
  recording = false
  await capture
  assert.ok(captured.length >= 20, `Too few ${name} viewport frames: ${captured.length}`)
  const concat = ['ffconcat version 1.0']
  for (let index = 0; index < captured.length; index++) {
    concat.push(`file '${captured[index].filename}'`)
    concat.push(`duration ${index + 1 < captured.length ? Math.max(0.04, (captured[index + 1].at - captured[index].at) / 1000).toFixed(3) : '0.100'}`)
  }
  concat.push(`file '${captured.at(-1).filename}'`)
  const manifest = path.join(frames, 'frames.ffconcat')
  await fs.writeFile(manifest, `${concat.join('\n')}\n`)
  await context.close()
  await fs.rm(path.join(raw, `accelerated-member-${name}-walkthrough.webm`), { force: true })
  const final = path.join(output, `accelerated-member-${name}-walkthrough.mp4`)
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', manifest, '-vf', 'fps=25',
    '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', final])
  execFileSync('tar', ['-czf', path.join(raw, `accelerated-member-${name}-frames.tar.gz`), '-C', raw,
    `accelerated-member-${name}-frames`])
  await fs.rm(frames, { recursive: true, force: true })
  console.log(final)
}
await browser.close()
