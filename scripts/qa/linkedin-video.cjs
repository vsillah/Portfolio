const { chromium, expect } = require('@playwright/test')
const esbuild = require('esbuild'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const base = 'http://127.0.0.1:4027', out = path.resolve('docs/social-content/qa/linkedin-video'), tmp = path.resolve('test-results/linkedin-video')
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(tmp, { recursive: true })
;(async () => {
 await esbuild.build({ stdin: { contents: `export {GET, POST} from './app/api/admin/social-content/[id]/review-handoff/route'; export {videoPlayback} from './lib/video-media-archive'; export {reset,tables,user,supabaseAdmin} from './scripts/qa/linkedin-video-fixture';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', packages: 'external', outfile: `${tmp}/handlers.cjs`, plugins: [{ name: 'fixture', setup(b) { b.onResolve({ filter: /^@\/lib\/(supabase|auth-server)$/ }, () => ({ path: path.resolve('scripts/qa/linkedin-video-fixture.ts') })) } }] })
 const h = require(`${tmp}/handlers.cjs`), { NextRequest } = require('next/server'), results = []
 const browser = await chromium.launch()
 for (const width of [390, 768, 1440]) {
  h.reset(); const external = [], errors = [], actions = []
  const context = await browser.newContext({ viewport: { width, height: 1000 }, recordVideo: { dir: tmp, size: { width, height: 1000 } }, serviceWorkers: 'block' })
  await context.addInitScript(user => { localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'synthetic-token', refresh_token: 'synthetic-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user })) }, h.user)
  await context.addInitScript(() => {
    const append = Node.prototype.appendChild, insert = Node.prototype.insertBefore
    const telemetry = n => n instanceof HTMLScriptElement && n.src.startsWith('https://va.vercel-scripts.com/')
    Node.prototype.appendChild = function(n) { return telemetry(n) ? n : append.call(this, n) }
    Node.prototype.insertBefore = function(n, r) { return telemetry(n) ? n : insert.call(this, n, r) }
  })
  await context.route('**/*', async r => {
   const u = new URL(r.request().url()), method = r.request().method()
   const json = (data, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
   if (u.origin === 'http://127.0.0.1:3999' && u.pathname === '/auth/v1/user') return json(h.user)
   if (u.hostname === 'media.example.invalid') return r.fulfill({ contentType: 'video/mp4', body: fs.readFileSync('public/prototypes/portfolio-pipeline-hero/higgsfield-light-mode-hero-loop-web-20260628.mp4') })
   if (u.origin !== base) { external.push(u.origin + u.pathname); return r.abort() }
   if (u.pathname === '/api/admin/video-generation/jobs') return json({ jobs: await Promise.all(h.tables.video_generation_jobs.map(async (job, index) => ({ ...job, ...await h.videoPlayback(h.supabaseAdmin, job.video_url), drive_file_name: `Synthetic workflow video ${index + 1}` }))) })
   if (u.pathname === '/api/user/profile') return json({ profile: { ...h.user, role: 'admin' } })
   const item = h.tables.social_content_queue[0]
   if (u.pathname === `/api/admin/social-content/${item.id}/review-handoff`) {
    if (method !== 'GET') actions.push(JSON.parse(r.request().postData()).action)
    const response = await h[method](new NextRequest(u, { method, ...(method !== 'GET' ? { body: r.request().postData() || '{}' } : {}) }), { params: { id: item.id } })
    return json(await response.json(), response.status)
   }
   if (u.pathname === `/api/admin/social-content/${item.id}`) return json({ item: { ...item, video_playback_url: item.video_url ? (await h.videoPlayback(h.supabaseAdmin, item.video_url)).playback_url : null } })
   if (u.pathname.startsWith('/api/')) { if (method !== 'GET') throw new Error('Unexpected mutation ' + u.pathname); return json({ data: [], items: [], configs: [], references: [], count: 0 }) }
   return r.continue()
  })
  const page = await context.newPage(); page.on('pageerror', e => { errors.push(e.message); console.error(e.message) })
  const url = `${base}/admin/social-content/video-review-qa?step=copy`
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  const panel = page.getByRole('region', { name: 'Campaign and video review' })
  await expect(panel).toBeVisible({ timeout: 90000 })
  async function shot(name) { await panel.scrollIntoViewIfNeeded(); await page.waitForTimeout(1000); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width} overflow`); await page.screenshot({ path: `${out}/${width}-${name}.png` }) }
  await panel.getByText('Compare approved campaign copy').click(); await expect(panel.getByText('Apply reviewed copy to this draft')).toBeEnabled()
  await shot('compare')
  await panel.getByText('Apply reviewed copy to this draft').click(); await expect(panel.getByText('Saved for internal review. External submission remains separate.')).toBeVisible()
  await panel.getByText('Compare approved campaign copy').click(); await expect(panel.getByText('Apply reviewed copy to this draft')).toBeDisabled()
  await panel.getByText('Load completed videos').click()
  await panel.getByLabel('Choose a completed video').selectOption(h.tables.video_generation_jobs[2].id)
  await panel.getByText('Preview completed job').click()
  await expect(panel.getByText('Attach this video · reset media approval')).toBeDisabled()
  await expect(panel.locator('video')).toHaveCount(0)
  await shot('expired-media-blocked')
  await panel.getByLabel('Choose a completed video').selectOption(h.tables.video_generation_jobs[0].id)
  await panel.getByText('Preview completed job').click(); await expect(panel.getByText('Attach this video · reset media approval')).toBeEnabled()
  await panel.getByText('Attach this video · reset media approval').click()
  await expect(page.getByLabel('LinkedIn post preview').getByLabel('Final LinkedIn video')).toBeVisible()
  await expect(panel.getByText('Approve this media version')).toBeDisabled()
  await shot('attached-copy-pending')
  // Existing copy approval is a fixture precondition; only changed review handlers mutate through the real API.
  h.tables.social_content_queue[0].status = 'approved'
  await page.reload(); await expect(panel).toBeVisible()
  await panel.getByRole('checkbox').check(); await panel.getByText('Approve this media version').click()
  await expect(panel.getByText(/Media: approved for this version/)).toBeVisible()
  const player = page.getByLabel('LinkedIn post preview').getByLabel('Final LinkedIn video')
  await player.scrollIntoViewIfNeeded(); await player.evaluate(v => v.play()); await page.waitForTimeout(1500); await player.evaluate(v => v.pause())
  await page.screenshot({ path: `${out}/${width}-combined-preview.png` })
  await shot('approved-blocked-submission')
  await panel.getByText('Load completed videos').click()
  await panel.getByLabel('Choose a completed video').selectOption(h.tables.video_generation_jobs[1].id)
  await panel.getByText('Preview completed job').click(); await panel.getByText('Attach this video · reset media approval').click()
  await expect(panel.getByText(/Media: review required/)).toBeVisible()
  await shot('replacement-invalidated')
  h.tables.social_content_queue[0].post_text = 'A later human edit stays intact.'
  await panel.getByText('Compare approved campaign copy').click(); await expect(panel.getByText(/Human copy edits differ/)).toBeVisible(); await expect(panel.getByText('Apply reviewed copy to this draft')).toBeDisabled()
  await shot('human-conflict')
  assert.equal(external.length, 0); assert.equal(errors.length, 0)
  results.push({ width, canonical_platform: h.tables.social_content_queue[0].platform, target_platforms: h.tables.social_content_queue[0].target_platforms, calendar_channel: h.tables.social_content_calendar_items[0].channel, actions, external_requests: external.length, page_errors: errors, copy_approval: 'fixture precondition; not exercised', route: url })
  const video = page.video(); await context.close(); execFileSync('ffmpeg', ['-y', '-i', await video.path(), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${out}/${width}-walkthrough.mp4`], { stdio: 'ignore' })
 }
 await browser.close(); fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2))
})().catch(e => { console.error(e); process.exit(1) })
