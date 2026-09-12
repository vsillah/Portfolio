// Naming follow-on. The approved v1 recorder and media are preserved separately.
import { chromium, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
const root = process.cwd()
const out = path.join(root, 'docs/qa/website-llc-naming')
const raw = path.join(root, 'test-results/website-llc-naming')
await mkdir(out, { recursive: true }); await mkdir(raw, { recursive: true })
const base = 'http://127.0.0.1:3199'
const syntheticProduct = { id: 901, title: 'Synthetic digital item', description: 'Local naming QA only', price: 100, type: 'ebook', is_active: true, file_url: null, image_url: null }
const syntheticUser = { id: 'naming-qa-admin', aud: 'authenticated', role: 'authenticated', email: 'naming-qa@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-09-09T00:00:00Z' }
const syntheticItem = { id: 'naming-qa', platform: 'linkedin', status: 'draft', post_text: 'Synthetic preview. No publication or provider action.', cta_text: 'Review only', cta_url: null, hashtags: [], image_url: null, image_prompt: null, framework_visual_type: 'architecture', voiceover_url: null, voiceover_text: null, video_url: null, rag_context: {}, scheduled_for: null, published_at: null, admin_notes: null, target_platforms: ['linkedin'], video_generation_method: 'none', content_format: 'single_image', carousel_slides: null, carousel_pdf_url: null, carousel_slide_urls: null, created_at: '2026-09-09T00:00:00Z', updated_at: '2026-09-09T00:00:00Z', publishes: [] }
const records = new Map()
let failNext = false, inquiryWrites = 0, evidenceAttempts = 0
const mock = createServer(async (req, res) => {
  let rawBody = ''; for await (const chunk of req) rawBody += chunk
  res.setHeader('Content-Type', 'application/json')
  if (req.url.startsWith('/rest/v1/contact_submissions')) {
    if (req.method === 'GET') return res.end(JSON.stringify({ id: 7 }))
    inquiryWrites++; res.statusCode = 204; return res.end()
  }
  if (req.url.startsWith('/rest/v1/contact_sms_consent_evidence')) {
    evidenceAttempts++
    if (failNext) { failNext = false; res.statusCode = 500; return res.end(JSON.stringify({ message: 'Synthetic persistence failure' })) }
    const record = JSON.parse(rawBody)
    if (!records.has(record.evidence_key)) records.set(record.evidence_key, { ...record, captured_at: new Date().toISOString() })
    res.statusCode = 201; return res.end()
  }
  return res.end('[]')
})
await new Promise(resolve => mock.listen(54991, '127.0.0.1', resolve))
const browser = await chromium.launch({ headless: true })
const blockedExternalAttempts = [], errors = [], checks = [], videoPaths = []
const pause = (page, ms = 1000) => page.waitForTimeout(ms)
async function capture(page, name) { await pause(page, 500); await page.screenshot({ path: path.join(out, name+'.png') }) }
async function safeContext(width, recordVideo = false) {
  const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 1000 }, reducedMotion: 'reduce', ...(recordVideo ? { recordVideo: { dir: raw, size: { width, height: width < 500 ? 844 : 1000 } } } : {}) })
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { blockedExternalAttempts.push({ host: url.hostname, blocked: true }); return route.abort() }
    if (url.pathname === '/auth/v1/user') return route.fulfill({ status: 200, json: syntheticUser })
    // Unrelated home-page data gets empty synthetic fixtures. Changed API runs for real.
    if (url.pathname.startsWith('/api/') && url.pathname !== '/api/contact') {
      if (url.pathname === '/api/products') return route.fulfill({ status: 200, json: [syntheticProduct] })
      if (url.pathname === '/api/user/profile') return route.fulfill({ status: 200, json: { profile: { ...syntheticUser, role: 'admin' } } })
      if (url.pathname === '/api/admin/social-content/naming-qa') return route.fulfill({ status: 200, json: { item: syntheticItem } })
      if (url.pathname.startsWith('/api/admin/')) return route.fulfill({ status: 200, json: { configs: [], references: [], items: [], total: 0, count: 0 } })
      if (url.pathname.includes('client-dashboard') || url.pathname.includes('client-projects')) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic unavailable project' }) })
      const key = url.pathname.includes('publication') ? 'publications' : url.pathname.includes('campaign') ? 'campaigns' : url.pathname.includes('service') ? 'services' : 'products'
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(key === 'products' || key === 'services' ? [] : { [key]: [], data: [], success: true }) })
    }
    return route.continue()
  })
  return context
}
async function openForm(page) {
  await page.goto(base+'/#contact', { waitUntil: 'domcontentloaded' })
  await page.locator('#contact').scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: 'Send Message', exact: true }).click()
  await expect(page.getByLabel('Mobile phone (optional)')).toBeVisible()
}
async function fillInquiry(page) {
  await page.getByLabel('Name', { exact: true }).fill('Synthetic Visitor')
  await page.getByLabel('Email', { exact: true }).fill('visitor@example.test')
  await page.getByLabel('Message', { exact: true }).fill('Synthetic consent QA. No real inquiry or provider action.')
}
const phone = page => page.getByLabel('Mobile phone (optional)')
const checkbox = page => page.getByRole('checkbox', { name: /I agree to receive/ })
const submit = page => page.locator('form').getByRole('button', { name: 'Send Message', exact: true })
async function noOverflow(page, width, surface) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }))
  if (dimensions.content > width) throw new Error(`${surface} overflows at ${width}: ${dimensions.content}`)
  checks.push({ surface, width, noHorizontalOverflow: true })
}
try {
  for (const width of [1440, 390, 360, 768]) {
    const recording = width === 1440 || width === 390
    const context = await safeContext(width, recording)
    const page = await context.newPage()
    page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(30000)
    console.log('QA width', width)
    page.on('pageerror', err => { errors.push(err.message); console.log('PAGE ERROR', err.message) })
    await page.goto(base, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('img', { name: 'AmaduTown, LLC', exact: true })).toBeVisible()
    await expect(page).toHaveTitle(/AmaduTown Advisory Solutions, LLC/)
    await capture(page, `home-${width}`)
    await openForm(page).catch(async error => { await page.screenshot({ path: '/tmp/sms-qa-failure.png' }); console.log(await page.locator('body').innerText()); throw error })
    await noOverflow(page, width, 'Contact > Send Message')
    await expect(checkbox(page)).not.toBeChecked()
    await phone(page).scrollIntoViewIfNeeded()
    await capture(page, `contact-${width}`)
    if (recording || width === 360) {
      await pause(page, 1800)
      await fillInquiry(page)
      // Optional inquiry without phone.
      await submit(page).click()
      await expect(page.getByRole('status')).toContainText('Message sent successfully')
      await expect(page.getByRole('status')).toBeInViewport(); await pause(page, 1400)
      const before = records.size
      await fillInquiry(page)
      await checkbox(page).check()
      await submit(page).click()
      await expect(page.locator('#contact-phone-error')).toContainText('Enter a valid mobile number')
      await expect(page.getByRole('status')).toHaveCount(0)
      await capture(page, `phone-error-${width}`); await pause(page, 1400)
      await phone(page).fill('123')
      await submit(page).click()
      await expect(phone(page)).toBeFocused()
      await phone(page).fill('+1 202 555 0123')
      // Keyboard activation can uncheck and recheck the native SMS control.
      await checkbox(page).focus(); await page.keyboard.press('Space')
      await expect(checkbox(page)).not.toBeChecked()
      await page.keyboard.press('Space'); await expect(checkbox(page)).toBeChecked()
      failNext = true
      await submit(page).click()
      await expect(page.getByRole('status')).toContainText('Your inquiry was saved, but SMS consent')
      await expect(page.getByRole('status')).toBeInViewport()
      await capture(page, `retry-${width}`); await pause(page, 1600)
      await submit(page).click()
      await expect(page.getByRole('status')).toContainText('does not start text messages')
      await expect(page.getByRole('status')).toBeInViewport()
      await capture(page, `success-${width}`); await pause(page, 1800)
      if (before === 0) expect(records.size).toBe(1)
      // Repeat checked capture stays one action; then normal inquiry never clears it.
      const first = [...records.values()][0]
      await fillInquiry(page); await phone(page).fill('(202) 555-0123'); await checkbox(page).check(); await submit(page).click()
      await expect(page.getByRole('status')).toContainText('SMS consent was recorded')
      expect(records.size).toBe(1); expect([...records.values()][0]).toBe(first)
      await fillInquiry(page); await phone(page).fill('+12025550124'); await submit(page).click()
      await expect(page.getByRole('status')).toContainText('Message sent successfully')
      expect(records.size).toBe(1)
      checks.push({ width, flows: ['unchecked/no phone', 'phone without consent discarded', 'checked/no phone inline error', 'malformed phone error', 'keyboard checkbox', 'persistence failure/retry', 'checked success pending only', 'repeated submission deduplicated', 'unchecked does not revoke'] })
    }
    await page.getByRole('link', { name: 'Privacy Policy', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'SMS communications', exact: true })).toBeVisible()
    await noOverflow(page, width, '/legal/privacy')
    await page.getByRole('heading', { name: 'SMS communications' }).scrollIntoViewIfNeeded()
    await capture(page, `privacy-${width}`); if (recording) await pause(page, 1500)
    await page.goBack()
    // Back navigation remounts the Contact tab, so restore the real form if needed.
    if (!(await page.getByRole('link', { name: 'SMS Terms', exact: true }).isVisible())) {
      await page.getByRole('button', { name: 'Send Message', exact: true }).click()
    }
    await page.getByRole('link', { name: 'SMS Terms', exact: true }).click()
    await expect(page).toHaveURL(base+'/legal/terms#sms')
    await expect(page.getByRole('heading', { name: 'AmaduTown, LLC SMS program', exact: true })).toBeVisible()
    await noOverflow(page, width, '/legal/terms#sms')
    await capture(page, `terms-${width}`); if (recording) await pause(page, 1700)
    await page.getByRole('link', { name: 'Privacy Policy', exact: true }).click()
    await expect(page).toHaveURL(base+'/legal/privacy')
    for (const [route, label] of [['/legal/data-deletion','deletion'], ['/auth/login','login'], ['/auth/signup','signup'], ['/help','help'], ['/store','store'], ['/checkout','checkout'], ['/purchases','purchases'], ['/pricing','pricing'], ['/pricing/methodology','methodology'], ['/client/dashboard/synthetic-missing','client-portal']]) {
      if (label === 'checkout') await page.evaluate(() => localStorage.setItem('cart', JSON.stringify([{ productId: 901, quantity: 1, itemType: 'product' }])))
      await page.goto(base+route, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('body')).not.toBeEmpty()
      await noOverflow(page, width, route)
      if (label === 'store') await expect(page.getByText('AmaduTown, LLC store', { exact: true })).toBeVisible()
      if (label === 'checkout') await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
      if (label === 'pricing') {
        // Wait for React hydration/data loading before clicking server-rendered controls.
        await page.waitForLoadState('networkidle')
        for (const [button, heading] of [['Mid-Market (50-500)', 'Mid-Market Programs'], ['Nonprofit / Education', 'Community Impact Program'], ['Small Business (1-50)', 'Small Business Packages']]) {
          await page.getByRole('button', { name: button, exact: true }).click()
          await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
          await noOverflow(page, width, route+' / '+button)
        }
        await page.getByRole('button', { name: 'Small Business (1-50)', exact: true }).scrollIntoViewIfNeeded()
        checks.push({ surface: '/pricing', width, allThreeSegmentsInteractive: true })
      }
      await capture(page, label+'-'+width)
    }
    const exp = Math.floor(Date.now() / 1000) + 3600
    const token = [Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ aud: 'authenticated', exp, sub: syntheticUser.id, email: syntheticUser.email, role: 'authenticated' })).toString('base64url'), 'synthetic-signature'].join('.')
    await page.addInitScript(value => localStorage.setItem('sb-127-auth-token', JSON.stringify(value)), { access_token: token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp, user: syntheticUser })
    await page.goto(base+'/checkout', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('AmaduTown, LLC checkout', { exact: true })).toBeVisible()
    await noOverflow(page, width, '/checkout')
    await capture(page, 'checkout-authenticated-'+width)
    await page.goto(base+'/admin/social-content/naming-qa?step=copy', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('AmaduTown, LLC', { exact: true })).toBeVisible()
    await page.getByText('AmaduTown, LLC', { exact: true }).scrollIntoViewIfNeeded()
    await noOverflow(page, width, '/admin/social-content/naming-qa?step=copy')
    await capture(page, 'admin-preview-'+width)
    if (recording) videoPaths.push({ width, video: page.video() })
    await context.close()
  }
  expect(errors).toEqual([])
  for (const { width, video } of videoPaths) {
    const source = await video.path()
    execFileSync('ffmpeg', ['-y','-i', source,'-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out, `walkthrough-${width}.mp4`)], { stdio: 'ignore' })
  }
  const serverBlocked = await readFile('/tmp/llc-server-blocked.jsonl', 'utf8').catch(() => '')
  const receipt = { approvedParent: '10885ad25723127bf52db800519a00544cf6a0fa', disclosureVersion: 'amadutown-sms-2026-09-09-v2', base, source: '/#contact > Send Message', persistence: 'real Next contact API against loopback-only synthetic PostgREST mock; unchanged migration already isolated-validated in ../sms-consent-policy/migration-receipt.json', checks, inquiryWrites, evidenceAttempts, retainedEvidenceCount: records.size, allEvidencePending: [...records.values()].every(r => r.send_eligible === false && r.capture_state === 'pending_verification'), browserPageErrors: errors, blockedExternalAttempts, serverBlockedAttempts: serverBlocked.trim().split('\n').filter(Boolean).map(JSON.parse), externalRequests: [], boundaries: 'No live database, inquiry, credentials, provider or outbound messaging. Receipt covers this controlled recording run.' }
  await writeFile(path.join(out, 'browser-receipt.json'), JSON.stringify(receipt,null,2)+'\n')
  console.log(JSON.stringify({ result: 'passed', widths: [1440,390,360,768], retainedEvidenceCount: records.size, externalRequests: [], output: out }))
} finally { await browser.close(); await new Promise(resolve => mock.close(resolve)) }
