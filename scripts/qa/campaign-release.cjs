// Actual campaign route with synthetic state; all external requests are blocked.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:3197';
const out = path.resolve('local-private/campaign-release-qa'); fs.mkdirSync(out, { recursive: true });
const id = '11111111-1111-4111-8111-111111111111';
const releaseId = '22222222-2222-4222-8222-222222222222';
const user = { id, email: 'qa@example.invalid', aud: 'authenticated', role: 'authenticated' };
const session = { access_token: 'synthetic-qa-token', refresh_token: 'synthetic-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user };
const fixture = () => ({ hash: 'a'.repeat(64), state: 'pending', version: 1, audit: [], manifest: {
 schemaVersion: 'campaign-release/v1', releaseId, campaignId: id, revision: 1, class: 'broadcast_release', objective: 'Synthetic community workshop release',
 createdAt: '2026-10-01T00:00:00Z', expiresAt: '2099-10-04T00:00:00Z', currency: 'USD', spendCapCents: 0,
 stopConditions: ['operator_stop', 'source_changed', 'consent_revoked', 'suppression_changed', 'provider_uncertain', 'budget_exceeded'],
 actions: [{ id, provider: 'linkedin', operation: 'publish', accountId: 'synthetic-community-account', source: { table: 'social_content_queue', id, fingerprint: 'b'.repeat(64) },
 copy: { title: 'Build practical tools together', body: 'Join our synthetic workshop demonstration. This content is for local QA only.', metadata: { visibility: 'public' } },
 assets: [{ ref: 'synthetic-workshop.png', sha256: 'c'.repeat(64), privacyReviewId: 'synthetic-review' }], recipients: [], audience: 'Public workshop audience',
 scheduledFor: '2099-10-03T12:00:00Z', evidenceExpiresAt: '2099-10-04T00:00:00Z', maxSpendCents: 0, expectedReceipt: 'platform_post_id', dependsOn: [] }] } });
(async () => {
 const browser = await chromium.launch();
 for (const width of [390, 768, 1440]) {
  let record = fixture(), unavailable = false, empty = false;
  const ctx = await browser.newContext({ viewport: { width, height: 950 }, recordVideo: { dir: out, size: { width, height: 950 } }, serviceWorkers: 'block' });
  await ctx.addInitScript(session => localStorage.setItem('sb-127-auth-token', JSON.stringify(session)), session);
  const page = await ctx.newPage(), errors = [], blocked = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  await ctx.route('**/*', r => {
   const u = new URL(r.request().url()), json = data => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
   if (u.origin === 'http://127.0.0.1:3999' && u.pathname === '/auth/v1/user') return json(user);
   if (u.origin !== base) { blocked.push(u.origin); return r.abort(); }
   if (u.pathname === '/api/user/profile') return json({ profile: { ...user, role: 'admin' } });
   if (u.pathname === `/api/admin/campaigns/${id}/releases`) {
    if (unavailable) return r.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    if (r.request().method() === 'PATCH') { const body = r.request().postDataJSON(); assert.equal(body.hash, record.hash);
     record.state = ({ approve: 'approved', hold: 'held', revise: 'revision_requested', stop: 'stopped' })[body.decision];
     record.audit.push({ at: new Date().toISOString(), decision: body.decision, actor: 'synthetic-admin' });
     return json({ record, providerExecutionEnabled: false }); }
    return json({ releases: empty ? [] : [record], providerExecutionEnabled: false });
   }
   if (u.pathname === `/api/admin/campaigns/${id}`) return json({ data: { id, name: 'Synthetic Workshop', slug: 'synthetic-workshop', campaign_type: 'free_challenge', status: 'draft', description: 'Local campaign QA', completion_window_days: 30, campaign_eligible_bundles: [], campaign_criteria_templates: [], social_content_calendar_items: [], payout_type: 'refund', payout_amount_type: 'full', min_purchase_amount: 0 } });
   if (u.pathname.startsWith('/api/')) return json({ data: [], items: [], count: 0 });
   return r.continue();
  });
  await page.goto(`${base}/admin/campaigns/${id}?release=${releaseId}`, { waitUntil: 'domcontentloaded' });
  const panel = page.getByRole('region', { name: 'Campaign releases' });
  await expect(panel).toBeVisible({ timeout: 60000 });
  const shot = async label => {
   if (['approved', 'stopped', 'Hold', 'Request-revision', 'expired', 'evidence-expired'].includes(label)) {
    await panel.getByRole('button', { name: 'Approve release', exact: true }).scrollIntoViewIfNeeded();
   } else await panel.scrollIntoViewIfNeeded();
   assert.equal(await panel.evaluate(el => el.scrollWidth > el.clientWidth), false, 'Panel overflow');
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Page overflow');
   await page.screenshot({ path: `${out}/${width}-${label}.png` }); await page.waitForTimeout(800); };
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${out}/${width}-campaign-summary.png` });
  await shot('pending');
  await panel.getByText('Review content and scope', { exact: true }).click();
  await panel.getByText('Assets, consent, and exact metadata', { exact: true }).click();
  for (const [label, hash] of [['Content hash', 'c'.repeat(64)], ['Manifest hash', record.hash]]) {
   const summary = panel.locator('summary').filter({ hasText: label });
   await expect(summary).toHaveAttribute('title', hash);
   await expect(summary).toHaveText(`${label}: ${hash.slice(0, 8)}…${hash.slice(-6)}`);
   await summary.click();
   await expect(panel.getByLabel(`Full ${label.toLowerCase()}`)).toBeVisible();
   await expect(panel.getByLabel(`Full ${label.toLowerCase()}`)).toHaveText(hash);
   await summary.click();
  }
  await shot('scope');
  await panel.getByRole('button', { name: 'Approve release', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Release approved'); await shot('approved');
  await panel.getByRole('button', { name: 'Emergency stop', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Release stopped');
  await expect(panel.getByRole('button', { name: 'Approve release', exact: true })).toBeDisabled();
  await panel.getByText('Decision history (2)', { exact: true }).click(); await shot('stopped');
  for (const decision of ['Hold', 'Request revision']) {
   record = fixture(); await panel.getByRole('button', { name: 'Refresh releases' }).click();
   await panel.getByRole('button', { name: decision, exact: true }).click();
   await expect(panel.getByRole('button', { name: 'Approve release', exact: true })).toBeDisabled(); await shot(decision.replaceAll(' ', '-'));
  }
  record = fixture(); record.manifest.expiresAt = '2020-01-01T00:00:00Z'; await panel.getByRole('button', { name: 'Refresh releases' }).click();
  await expect(panel.getByRole('button', { name: 'Approve release', exact: true })).toBeDisabled(); await shot('expired');
  record = fixture(); record.manifest.actions[0].evidenceExpiresAt = '2020-01-01T00:00:00Z'; await panel.getByRole('button', { name: 'Refresh releases' }).click();
  await expect(panel.getByRole('button', { name: 'Approve release', exact: true })).toBeDisabled();
  await expect(panel.getByText(/Evidence expired or missing/)).toBeVisible(); await shot('evidence-expired');
  unavailable = true; await panel.getByRole('button', { name: 'Refresh releases' }).click(); await expect(panel.getByRole('status')).toContainText('unavailable'); await shot('unavailable');
  unavailable = false; empty = true; await panel.getByRole('button', { name: 'Refresh releases' }).click(); await expect(panel.getByText(/No release prepared/)).toBeVisible(); await shot('empty');
  empty = false; record = fixture(); await panel.getByRole('button', { name: 'Refresh releases' }).click();
  await panel.getByText('Review content and scope', { exact: true }).click();
  const source = panel.getByRole('link', { name: 'Open channel review' }); await expect(source).toHaveAttribute('href', `/admin/social-content/${id}`);
  await source.click(); await page.waitForURL(`**/admin/social-content/${id}`);
  const video = page.video(); await ctx.close();
  execFileSync('ffmpeg', ['-y', '-i', await video.path(), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${out}/campaign-release-${width}.mp4`], { stdio: 'ignore' });
  fs.writeFileSync(`${out}/results-${width}.json`, JSON.stringify({ route: `/admin/campaigns/${id}?release=${releaseId}`, width, errors, blocked, externalRequests: 0, evidence: 'Actual localhost route; synthetic API fixtures. Not live authorization or provider execution proof.' }, null, 2));
  assert.deepEqual(errors, []); console.log(`PASS ${width}px`);
 }
 await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
