// Actual campaign route with synthetic state; all external requests are blocked.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:3199';
const out = path.resolve('docs/campaign-autopilot/qa/phase12'); fs.mkdirSync(out, { recursive: true });
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
  let record = fixture(), unavailable = false;
  let projection = { gate: { enabled: false, reason: 'Slack dispatch is disabled. Ask the Integration Captain to qualify the signed callback canary and enable campaign review dispatch for this environment.' }, intents: [], receipts: [] };
  const intentId = '33333333-3333-4333-8333-333333333333', receiptId = '44444444-4444-4444-8444-444444444444';
  const ctx = await browser.newContext({ viewport: { width, height: 950 }, recordVideo: { dir: out, size: { width, height: 950 } }, serviceWorkers: 'block' });
  await ctx.addInitScript(session => localStorage.setItem('sb-127-auth-token', JSON.stringify(session)), session);
  const page = await ctx.newPage(), errors = [], blocked = [], posts = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await ctx.route('**/*', r => {
   const u = new URL(r.request().url()), json = data => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
   if (u.origin === 'http://127.0.0.1:3999' && u.pathname === '/auth/v1/user') return json(user);
   if (u.origin !== base) { blocked.push(u.origin); return r.abort(); }
   if (u.pathname === '/api/user/profile') return json({ profile: { ...user, role: 'admin' } });
   if (u.pathname === `/api/admin/campaigns/${id}/releases/slack`) {
    if (unavailable) return r.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    if (r.request().method() === 'POST') {
     const body = r.request().postDataJSON(); posts.push(body); assert.equal(body.hash, record.hash); assert.equal(body.version, record.version);
     projection.intents = [{ id: intentId, version: record.version, state: body.dispatch ? 'sent' : 'prepared' }];
     return json({ sent: body.dispatch, intent: projection.intents[0] });
    }
    return json({ ...projection, release: record });
   }
   if (u.pathname === `/api/admin/campaigns/${id}/releases`) {
    if (r.request().method() === 'PATCH') { const body = r.request().postDataJSON(); record.version++; record.state = ({ approve: 'approved', hold: 'held', revise: 'revision_requested', stop: 'stopped' })[body.decision]; return json({ record }); }
    return json({ releases: [record], providerExecutionEnabled: false });
   }
   if (u.pathname === `/api/admin/campaigns/${id}`) return json({ data: { id, name: 'Synthetic Workshop', slug: 'synthetic-workshop', campaign_type: 'free_challenge', status: 'draft', description: 'Local campaign QA', completion_window_days: 30, campaign_eligible_bundles: [], campaign_criteria_templates: [], social_content_calendar_items: [], payout_type: 'refund', payout_amount_type: 'full', min_purchase_amount: 0 } });
   if (u.pathname.startsWith('/api/admin/agents/runs/')) return json({ run: { id: u.pathname.split('/').pop(), title: 'Synthetic campaign Slack receipt', status: 'completed', kind: 'slack_action_receipt', runtime: 'manual', created_at: '2026-10-03T00:00:00Z', updated_at: '2026-10-03T00:00:00Z', metadata: {}, outcome: {} }, events: [], approvals: [], workItems: [], artifacts: [], steps: [], handoffs: [], costs: [], evaluations: [], cost_total: 0 });
   if (u.pathname.startsWith('/api/')) return json({ data: [], items: [], count: 0 });
   return r.continue();
  });
  const url = `${base}/admin/campaigns/${id}?release=${releaseId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const panel = page.getByRole('region', { name: 'Campaign releases' });
  await expect(panel).toBeVisible({ timeout: 60000 });
  const slack = panel.getByLabel('Slack release review');
  await slack.locator('summary').click();
  const refresh = async () => { await slack.getByRole('button', { name: 'Refresh Slack status' }).click(); await expect(slack.getByRole('button', { name: 'Refresh Slack status' })).toBeEnabled(); };
  const shot = async label => {
   await slack.scrollIntoViewIfNeeded();
   assert.equal(await slack.evaluate(el => el.scrollWidth > el.clientWidth), false, 'Slack section overflow');
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Page overflow');
   await page.screenshot({ path: `${out}/${width}-${label}.png` }); await page.waitForTimeout(1000);
  };
  await expect(slack.getByRole('button', { name: 'Prepare Slack review' })).toBeEnabled(); await shot('no-dispatch');
  await slack.getByRole('button', { name: 'Prepare Slack review' }).click();
  await expect(slack.getByRole('status')).toContainText('Intent saved');
  await expect(slack.getByRole('button', { name: 'Send review to Slack' })).toBeDisabled(); await shot('default-off');
  // Synthetic authorized configuration, never a real environment change or Slack request.
  projection.gate = { enabled: true, reason: 'Synthetic qualified dispatch. Provider execution remains disabled.' }; await refresh();
  await slack.getByRole('button', { name: 'Send review to Slack' }).click();
  await expect(slack.getByRole('status')).toContainText('Review card sent'); await shot('sent');
  projection.receipts = [{ id: receiptId, state: 'queued', action: 'campaign_release.approve', version: '1' }]; await refresh();
  await expect(slack).toContainText('Callback accepted'); await shot('accepted');
  record.state = 'approved'; record.version++; record.audit = [{ decision: 'approve', actor: 'slack:synthetic-operator', at: '2026-10-03T01:00:00Z', hash: record.hash }];
  projection.receipts[0] = { ...projection.receipts[0], state: 'delivered', status: 'completed', text: 'Campaign release approved. Provider execution remains gated.', delivery: 'delivered' }; await refresh();
  await expect(slack).toContainText('Original Slack card updated'); await shot('recorded');
  projection.receipts[0].status = 'already_recorded'; await refresh(); await expect(slack).toContainText('Duplicate decision recorded'); await shot('duplicate');
  projection.receipts[0] = { ...projection.receipts[0], state: 'delivery_blocked', status: 'completed', delivery: 'failed', deliveryError: 'Configure the source-environment Slack bot token, verify access, then reconcile this receipt in Portfolio.' }; await refresh();
  await expect(slack).toContainText('Original card update failed or blocked'); await shot('card-blocked');
  projection.receipts[0] = { id: receiptId, state: 'reconciliation_required', action: 'campaign_release.approve', version: '1' }; await refresh();
  await expect(slack).toContainText('Callback outcome unconfirmed'); await shot('callback-unconfirmed');
  projection.receipts = []; projection.intents[0].state = 'unconfirmed'; await refresh();
  await expect(slack).toContainText('this intent cannot resend'); await expect(slack.getByRole('button', { name: 'Send review to Slack' })).toHaveCount(0); await shot('dispatch-unconfirmed');
  unavailable = true; await refresh(); await expect(slack.getByRole('status')).toContainText('unavailable'); await shot('unavailable'); unavailable = false;
  projection.receipts = [{ id: receiptId, state: 'delivered', status: 'blocked', text: 'Stale campaign decision. Refresh the current release in Portfolio; do not reuse this card.', delivery: 'delivered' }]; await refresh(); await shot('stale');
  // Exercise both evidence links through the existing run route, then return to the campaign.
  for (const [label, target] of [['Inspect dispatch record', intentId], ['Inspect callback receipt', receiptId]]) {
   await slack.getByRole('link', { name: label }).click(); await page.waitForURL(`**/admin/agents/runs/${target}`);
   await expect(page.getByText('Synthetic campaign Slack receipt', { exact: true })).toBeVisible({ timeout: 60000 });
   await page.goto(url); await expect(panel).toBeVisible(); await slack.locator('summary').click();
  }
  record = fixture(); projection.receipts = []; projection.intents = []; await panel.getByRole('button', { name: 'Refresh releases' }).click();
  await expect(panel.getByRole('button', { name: 'Approve release', exact: true })).toBeEnabled();
  await panel.getByRole('button', { name: 'Approve release', exact: true }).click(); await expect(panel.getByRole('status').first()).toContainText('Release approved');
  await panel.getByRole('button', { name: 'Emergency stop', exact: true }).click(); await expect(panel.getByRole('status').first()).toContainText('Release stopped');
  await shot('portfolio-stop');
  const video = page.video(); await ctx.close();
  execFileSync('ffmpeg', ['-y', '-i', await video.path(), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${out}/campaign-slack-${width}.mp4`], { stdio: 'ignore' });
  fs.unlinkSync(await video.path());
  fs.writeFileSync(`${out}/results-${width}.json`, JSON.stringify({ route: url, width, errors, blocked, externalRequests: 0, posts, evidence: 'Actual localhost route; synthetic API fixtures. No live authorization, database, Slack or provider execution proof.' }, null, 2));
  assert.deepEqual(errors, []); console.log(`PASS ${width}px`);
 }
 await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
