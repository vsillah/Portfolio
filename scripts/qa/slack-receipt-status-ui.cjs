// Real Portfolio route, synthetic browser API fixtures, no external requests.
// Start Next with synthetic localhost Supabase configuration and provider flags unset.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const base = new URL(process.env.QA_BASE_URL || 'http://127.0.0.1:3197');
assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname));
const out = path.resolve('local-private/slack-receipt-qa');
fs.mkdirSync(out, { recursive: true });
const id = '11111111-1111-4111-8111-111111111111';
const user = { id: '22222222-2222-4222-8222-222222222222', email: 'qa@example.invalid', aud: 'authenticated', role: 'authenticated' };
const session = { access_token: 'synthetic-qa-token', refresh_token: 'synthetic-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user };
(async () => {
 const browser = await chromium.launch();
 for (const width of [1440, 768, 390]) {
  let state = 'queued';
  const ctx = await browser.newContext({ viewport: { width, height: 950 }, recordVideo: { dir: out, size: { width, height: 950 } }, serviceWorkers: 'block' });
  await ctx.addInitScript(session => localStorage.setItem('sb-127-auth-token', JSON.stringify(session)), session);
  const page = await ctx.newPage();
  const errors = [], blocked = [], marks = [];
  page.on('pageerror', e => errors.push(e.message));
  const detail = () => ({ run: { id, title: 'Slack action receipt', kind: 'slack_action_receipt', runtime: 'manual',
    status: state === 'queued' ? 'queued' : state === 'reconciliation_required' ? 'waiting_for_approval' : 'completed',
    metadata: { state, envelope: { value: { action: 'warm_gmail_send.approve', contactId: 42 } } },
    outcome: ['queued', 'reconciliation_required'].includes(state) ? {} : { canonical: { actionStatus: 'completed', text: 'Approval intent saved for the synthetic recipient. Gmail send remains disabled; no email was sent.' },
      delivery: state === 'delivered' ? 'delivered' : 'failed', deliveryError: state === 'delivery_blocked' ? 'Verify Slack history scopes and conversation membership, then reconcile this receipt in Portfolio.' : 'Slack feedback unconfirmed' },
   }, steps: [], events: [], approvals: [], artifacts: [], handoffs: [], costs: [], evaluations: [], cost_total: 0 });
  await ctx.route('**/*', r => {
   const u = new URL(r.request().url());
   const json = data => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
   if (u.origin === 'http://127.0.0.1:3999' && u.pathname === '/auth/v1/user') return json(user);
   if (u.origin !== base.origin) { blocked.push(u.origin); return r.abort(); }
   if (u.pathname === '/api/user/profile') return json({ profile: { ...user, role: 'admin' } });
   if (u.pathname === `/api/admin/agents/runs/${id}`) return json(detail());
   if (u.pathname.startsWith('/api/')) return json({ items: [], count: 0 });
   return r.continue();
  });
  await page.goto(`${base.origin}/admin/agents/runs/${id}`, { waitUntil: 'domcontentloaded' });
  const panel = page.getByRole('region', { name: 'Slack action receipt' });
  await expect(panel).toBeVisible({ timeout: 60000 });
  const hold = async label => {
   await panel.scrollIntoViewIfNeeded();
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Page overflow');
   assert.equal(await panel.evaluate(el => el.scrollWidth > el.clientWidth), false, 'Receipt overflow');
   assert.equal(await page.locator('[data-nextjs-dialog]').count(), 0);
   marks.push(label);
   await page.screenshot({ path: `${out}/${width}-${state}.png` });
   await page.waitForTimeout(1500);
  };
  await expect(panel.getByText('Decision queued')).toBeVisible();
  await hold('Queued receipt; outcome unconfirmed');
  for (const [next, decision, delivery] of [
   ['outcome', 'Decision recorded', 'Slack update pending retry'],
   ['delivery_blocked', 'Decision recorded', 'Slack update blocked'],
   ['delivered', 'Decision recorded', 'Slack card updated'],
   ['reconciliation_required', 'Needs reconciliation', 'Slack update unconfirmed'],
  ]) {
   state = next;
   await page.getByRole('button', { name: 'Refresh', exact: true }).click();
   await expect(panel.getByText(decision, { exact: true })).toBeVisible();
   await expect(panel.getByText(delivery, { exact: true })).toBeVisible();
   if (state === 'delivery_blocked') { await panel.getByText('Receipt details').click(); await expect(panel.getByText(/Verify Slack history/)).toBeVisible(); }
   await hold(`${decision}; ${delivery}`);
  }
  await expect(panel.getByRole('link', { name: 'Review decision' })).toHaveAttribute('href', '/admin/outreach?tab=leads&filter=warm&id=42&contactId=42#warm-gmail-operating-loop');
  await panel.getByRole('link', { name: 'Review decision' }).click();
  await page.waitForURL('**/admin/outreach?**');
  assert.equal(new URL(page.url()).hash, '#warm-gmail-operating-loop');
  const video = page.video();
  await ctx.close();
  execFileSync('ffmpeg', ['-y', '-i', await video.path(), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${out}/slack-receipt-${width}.mp4`], { stdio: 'ignore' });
  fs.writeFileSync(`${out}/receipt-${width}.json`, JSON.stringify({ route: `/admin/agents/runs/${id}`, width, marks, errors, blocked, evidence: 'Actual local Portfolio route with synthetic API state; not live Slack receipt proof', external_requests: 0 }, null, 2));
  assert.deepEqual(errors, []);
  console.log(`PASS ${width}px: receipt states, refresh, details, review navigation; external requests 0`);
 }
 await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
