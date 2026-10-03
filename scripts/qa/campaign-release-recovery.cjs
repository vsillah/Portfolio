// Actual campaign route, durable synthetic journal projections, zero provider traffic.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs'); const path = require('node:path');
const { execFileSync } = require('node:child_process'); const assert = require('node:assert/strict');
const base = `http://127.0.0.1:${process.env.CAMPAIGN_QA_PORT || '3198'}`;
const frames = JSON.parse(fs.readFileSync('local-private/campaign-recovery/frames.json', 'utf8'));
const manifest = frames.pending.releases[0].manifest, id = manifest.campaignId, releaseId = manifest.releaseId;
const out = path.resolve(process.env.CAMPAIGN_QA_OUT || 'docs/campaign-autopilot/qa/phase2'); fs.mkdirSync(out, { recursive: true });
const user = { id, email: 'qa@example.invalid', aud: 'authenticated', role: 'authenticated' };
const session = { access_token: 'synthetic-token', refresh_token: 'synthetic-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user };
(async () => {
 const browser = await chromium.launch();
 for (const width of [390, 768, 1440]) {
  let frame = frames.pending, unavailable = false;
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, recordVideo: { dir: 'local-private/campaign-recovery', size: { width, height: 1000 } }, serviceWorkers: 'block' });
  await ctx.addInitScript(session => localStorage.setItem('sb-127-auth-token', JSON.stringify(session)), session);
  const page = await ctx.newPage(), errors = [], blocked = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await ctx.route('**/*', r => {
   const u = new URL(r.request().url()), json = data => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
   if (u.origin === 'http://127.0.0.1:3999' && u.pathname === '/auth/v1/user') return json(user);
   if (u.origin !== base) { blocked.push(u.origin); return r.abort(); }
   if (u.pathname === '/api/user/profile') return json({ profile: { ...user, role: 'admin' } });
   if (u.pathname === `/api/admin/campaigns/${id}/releases`) {
    if (unavailable) return r.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    if (r.request().method() === 'PATCH') {
     const body = r.request().postDataJSON(); assert.equal(body.hash, frame.releases[0].hash);
     frame = body.decision === 'stop' ? frames.stopped : frames.approved;
     return json({ record: frame.releases[0], providerExecutionEnabled: false });
    }
    return json(frame);
   }
   if (u.pathname === `/api/admin/campaigns/${id}`) return json({ data: { id, name: 'Synthetic Workshop', slug: 'synthetic-workshop', campaign_type: 'free_challenge', status: 'draft', description: 'Local recovery QA', completion_window_days: 30, campaign_eligible_bundles: [], campaign_criteria_templates: [], social_content_calendar_items: [], payout_type: 'refund', payout_amount_type: 'full', min_purchase_amount: 0 } });
   if (u.pathname.startsWith('/api/')) return json({ data: [], items: [], count: 0 });
   return r.continue();
  });
  const url = `${base}/admin/campaigns/${id}?release=${releaseId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const panel = page.getByRole('region', { name: 'Campaign releases' });
  await expect(panel).toBeVisible({ timeout: 60000 });
  const recovery = panel.locator('details').filter({ has: page.locator('summary', { hasText: /^Readiness and recovery$/ }) }).first();
  await recovery.locator('summary').first().click();
  const shot = async label => {
   await recovery.scrollIntoViewIfNeeded();
   assert.equal(await panel.evaluate(el => el.scrollWidth > el.clientWidth), false);
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
   await page.screenshot({ path: `${out}/${width}-${label}.png` }); await page.waitForTimeout(950);
  };
  await shot('pending');
  await panel.getByRole('button', { name: 'Approve release', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('approved'); await shot('provider-disabled');
  for (const [name, expected] of [['partial', 'Synthetic receipt confirmed'], ['submitted', 'Awaiting receipt'], ['uncertain', 'Reconcile outcome'], ['retryable', 'Retry eligible'], ['recovered', 'Synthetic receipt confirmed']]) {
   frame = frames[name]; await panel.getByRole('button', { name: 'Refresh releases' }).click();
   await expect(recovery.getByText(expected, { exact: true }).first()).toBeVisible();
   await shot(name);
  }
  for (const receipt of await recovery.getByText('Inspect synthetic receipt', { exact: true }).all()) { await receipt.click(); }
  await expect(recovery.getByText(`synthetic:${manifest.actions[1].id}`, { exact: true })).toBeVisible(); await shot('receipts');
  await panel.getByRole('button', { name: 'Emergency stop', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Approve release', exact: true })).toBeDisabled();
  await shot('stopped');
  unavailable = true; await panel.getByRole('button', { name: 'Refresh releases' }).click();
  await expect(panel.getByRole('status')).toContainText('unavailable');
  unavailable = false; frame = frames.recovered; await panel.getByRole('button', { name: 'Refresh releases' }).click();
  await expect(panel.getByRole('status')).toHaveCount(0);
  const link = recovery.getByRole('link', { name: 'Review step 2 evidence', exact: true });
  await expect(link).toHaveAttribute('href', `/admin/social-content/${manifest.actions[1].source.id}`);
  await link.click(); await page.waitForURL(`**/admin/social-content/${manifest.actions[1].source.id}`);
  const video = page.video(); await ctx.close();
  execFileSync('ffmpeg', ['-y', '-i', await video.path(), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${out}/campaign-recovery-${width}.mp4`], { stdio: 'ignore' });
  fs.writeFileSync(`${out}/results-${width}.json`, JSON.stringify({ url, width, errors, blocked, externalRequests: 0, states: Object.keys(frames), evidence: 'Actual route with persisted synthetic journal projections. Provider adapters disabled; production execution and distributed durability untested.' }, null, 2));
  assert.deepEqual(errors, []); console.log(`PASS ${width}px`);
 }
 await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
