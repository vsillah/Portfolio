const { chromium, expect } = require('@playwright/test')
const esbuild = require('esbuild')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:4021'
const out = path.resolve('docs/campaign-autopilot/qa/rolling-review'), tmp = path.resolve('test-results/rolling-review')
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(tmp, { recursive: true })
;(async () => {
 await esbuild.build({ stdin: { contents: `export {GET, POST, PATCH} from './app/api/admin/campaigns/[id]/review-backlog/route'; export {reset,tables,campaignId,user} from './scripts/qa/campaign-review-backlog-fixture';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', packages: 'external', outfile: `${tmp}/handlers.cjs`, plugins: [{ name: 'local-fixture', setup(b) { b.onResolve({ filter: /^@\/lib\/(supabase|auth-server)$/ }, () => ({ path: path.resolve('scripts/qa/campaign-review-backlog-fixture.ts') })) } }] })
 const h = require(`${tmp}/handlers.cjs`), { NextRequest } = require('next/server')
 const browser = await chromium.launch(), results = []
 for (const width of [390, 768, 1440]) {
  h.reset(); const external = [], errors = [], mutations = []
  const context = await browser.newContext({ viewport: { width, height: 1000 }, recordVideo: { dir: tmp, size: { width, height: 1000 } }, serviceWorkers: 'block' })
  await context.addInitScript(user => { localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'synthetic-token', refresh_token: 'synthetic-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user })) }, h.user)
  // Suppress only the existing telemetry script before insertion, rather than masking a network request.
  await context.addInitScript(() => {
    const append = Node.prototype.appendChild, insert = Node.prototype.insertBefore
    const telemetry = node => node instanceof HTMLScriptElement && node.src.startsWith('https://va.vercel-scripts.com/')
    Node.prototype.appendChild = function(node) { return telemetry(node) ? node : append.call(this, node) }
    Node.prototype.insertBefore = function(node, ref) { return telemetry(node) ? node : insert.call(this, node, ref) }
  })
  await context.route('**/*', async r => {
   const u = new URL(r.request().url()), method = r.request().method()
   const json = (data, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
   if (u.origin === 'http://127.0.0.1:3999' && u.pathname === '/auth/v1/user') return json(h.user)
   if (u.origin !== base) { external.push(u.origin + u.pathname); return r.abort() }
   if (u.pathname === '/api/user/profile') return json({ profile: { ...h.user, role: 'admin' } })
   if (u.pathname === `/api/admin/campaigns/${h.campaignId}/review-backlog`) {
    if (method !== 'GET') mutations.push({ method, path: u.pathname })
    const response = await h[method](new NextRequest(u, { method, ...(method !== 'GET' ? { body: r.request().postData() || '{}' } : {}) }), { params: { id: h.campaignId } })
    return json(await response.json(), response.status)
   }
   if (u.pathname === `/api/admin/campaigns/${h.campaignId}`) return json({ data: { ...h.tables.attraction_campaigns[0], social_content_calendar_items: h.tables.social_content_calendar_items, calendar_item_count: 12 } })
   if (u.pathname.startsWith('/api/admin/agents/work-items/')) return json({ work_item: h.tables.agent_work_items.find(w => u.pathname.endsWith(w.id)) })
   if (u.pathname.startsWith('/api/')) { if (method !== 'GET') throw new Error('Unexpected mutation ' + u.pathname); return json({ data: [], items: [], releases: [], count: 0 }) }
   return r.continue()
  })
  const page = await context.newPage(); page.on('pageerror', e => { errors.push(e.message); console.error('PAGE', e.stack) })
  const url = `${base}/admin/campaigns/${h.campaignId}?tab=content-calendar`
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  console.log('Loaded', width, page.url())
  const panel = page.getByRole('region', { name: 'Rolling review backlog' })
  await expect(panel.getByRole('button', { name: 'Prepare next review batch' })).toBeEnabled({ timeout: 90000 })
  async function shot(name) {
   await panel.scrollIntoViewIfNeeded(); await page.waitForTimeout(1600)
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}: page overflow`)
   await page.screenshot({ path: `${out}/${width}-${name}.png` })
  }
  await shot('coverage')
  await panel.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(panel.getByText('2/3', { exact: true })).toBeVisible()
  await panel.getByRole('button', { name: 'Previous', exact: true }).click()
  await panel.getByText('Provenance', { exact: true }).first().click()
  await expect(panel.getByText('Calendar calendar-qa-0', { exact: false })).toBeVisible()
  await panel.getByText('Provenance', { exact: true }).first().click()
  await panel.getByRole('button', { name: '0 Ready', exact: true }).click()
  await expect(panel.getByText('No ready items', { exact: false })).toBeVisible()
  await panel.getByRole('button', { name: 'Clear filter' }).click()
  await panel.getByRole('button', { name: '10 To prepare', exact: true }).click()
  await expect(panel.getByRole('heading', { name: 'To prepare items (10)' })).toBeVisible()
  await panel.getByRole('button', { name: 'Clear filter' }).click()
  await panel.getByRole('button', { name: '2 Blocked' }).click(); await expect(panel.getByRole('link', { name: 'Resolve blocker' })).toHaveCount(2)
  await shot('blocked')
  const recovery = panel.getByRole('link', { name: 'Resolve blocker' }).last()
  assert.match(await recovery.getAttribute('href'), /social-insights\/work-qa-11/)
  await recovery.click(); await expect(page.getByRole('heading', { name: /Shared evidence/ })).toBeVisible({ timeout: 60000 })
  await page.waitForTimeout(1600)
  await page.screenshot({ path: `${out}/${width}-evidence-recovery.png` })
  await page.goto(url); await expect(panel.getByRole('button', { name: 'Prepare next review batch' })).toBeEnabled()
  await panel.getByRole('button', { name: 'Prepare next review batch' }).click()
  await expect(panel.getByRole('status')).toContainText('prepared for review')
  const firstCount = h.tables.agent_work_items.filter(w => w.metadata.channel_lanes?.linkedin?.status === 'in_review').length
  assert.ok(firstCount > 0 && firstCount <= 5)
  await shot('prepared')
  await expect(panel.getByRole('button', { name: 'Prepare next review batch' })).toBeDisabled()
  const retry = await h.POST(new NextRequest(`${base}/api/admin/campaigns/${h.campaignId}/review-backlog`, { method: 'POST', body: JSON.stringify({ action: 'prepare' }) }), { params: { id: h.campaignId } }); assert.equal((await retry.json()).prepared_count, 0)
  assert.equal(h.tables.agent_work_items.filter(w => w.metadata.channel_lanes?.linkedin?.status === 'in_review').length, firstCount)
  await panel.getByRole('link', { name: 'Review copy', exact: true }).first().click()
  await expect(page.getByText('Generated from the shared insight', { exact: false })).toBeVisible({ timeout: 60000 })
  await page.waitForTimeout(1600)
  await page.screenshot({ path: `${out}/${width}-review-copy.png` })
  await page.goto(url); await expect(panel.getByText('Review cadence', { exact: true })).toBeVisible()
  await panel.getByText('Review cadence', { exact: true }).click()
  await panel.getByLabel('Ready target', { exact: true }).fill('12')
  await panel.getByRole('button', { name: 'Save cadence' }).click(); await expect(panel.getByRole('status')).toHaveText('Review cadence saved.')
  await shot('cadence')
  await page.reload(); await expect(panel.getByText(`${firstCount}/12 ready`, { exact: false })).toBeVisible()
  await panel.scrollIntoViewIfNeeded(); await page.waitForTimeout(1000)
  assert.equal(external.length, 0, JSON.stringify(external)); assert.deepEqual(errors, [])
  const video = page.video(); await context.close(); const source = await video.path()
  execFileSync('ffmpeg', ['-y', '-i', source, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${out}/${width}-walkthrough.mp4`], { stdio: 'ignore' })
  results.push({ width, url, first_batch_count: firstCount, persisted_ready_target: 12, external_requests: external, page_errors: errors, mutations })
 }
 await browser.close(); fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2)); console.log(JSON.stringify(results))
})().catch(e => { console.error(e); process.exit(1) })
