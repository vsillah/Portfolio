// Synthetic data on the real Next Research page. API contract tests separately exercise real handlers.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs'); const path = require('node:path'); const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const base = 'http://127.0.0.1:3226'; const out = path.resolve('docs/campaign-autopilot/qa/research-binding');
fs.mkdirSync(out, { recursive: true });
(async () => {
 const browser = await chromium.launch(); const results = [];
 for (const width of [390, 768, 1440]) {
  let denied = false, empty = false;
  const packets = [0,1,2].map(i => ({ id: `packet-${i}`, title: ['Workflow boundaries before autonomy', 'Public framework for channel planning', 'Source too close to reuse'][i], source_url: `https://example.invalid/framework-${i}`, status: i === 1 ? 'approved' : 'review_ready', pattern_status: i === 2 ? 'too_close_to_source' : 'usable_framework', pattern_packet: { hook_structure: 'Open with an operator question' }, updated_at: '2026-10-06T12:00:00Z', platform: 'linkedin', metrics: {}, actor_metadata: {}, outlier_score: 80 }));
  const items = Array.from({ length: 14 }, (_, i) => ({ id: `work-${i}`, title: `Handoff ${i + 1}: Readiness workflow review`, source_type: 'social_content_calendar_authorization', metadata: { campaign_id: 'readiness', campaign_name: 'Agentic Operating System Readiness Challenge', calendar_item_id: `calendar-${i}`, social_content_id: `social-${i}`, channel: i % 2 ? 'youtube' : 'linkedin', campaign_phase: i % 2 ? 'teach' : 'tease', scheduled_for: `2026-10-${String(8 + i).padStart(2,'0')}T14:00:00Z`, draft_handoff_only: true, research_packet_ids: [] } }));
  const calendar = items.map((t,i) => ({ ...t.metadata, id: `calendar-${i}`, title: t.title, authorization_status: i === 13 ? 'pending' : 'authorized', metadata: { platform_draft_handoff: { work_item_id: t.id } } }));
  const writes = [], external = [], errors = [];
  const context = await browser.newContext({ viewport: { width, height: 1000 }, recordVideo: { dir: '/tmp/campaign-binding-video', size: { width, height: 1000 } }, serviceWorkers: 'block' });
  const user = { id: 'qa-admin', email: 'qa@example.invalid', aud: 'authenticated', role: 'authenticated' };
  await context.addInitScript(user => localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'synthetic-token', refresh_token: 'synthetic-refresh', expires_at: 4102444800, token_type: 'bearer', user })), user);
  await context.route('**/*', async r => {
   const u = new URL(r.request().url()); const json = (data, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
   if (u.origin === 'http://127.0.0.1:3999' && u.pathname === '/auth/v1/user') return json(user);
   if (u.pathname.includes('/_vercel/') || u.origin === 'https://va.vercel-scripts.com') return r.fulfill({ contentType: 'application/javascript', body: '' });
   if (u.origin !== base) { external.push(u.origin); return r.abort(); }
   if (u.pathname === '/api/user/profile') return json({ profile: { ...user, role: 'admin' } });
   if (r.request().method() === 'POST') {
    const body = JSON.parse(r.request().postData()); writes.push({ path: u.pathname, body });
    if (u.pathname.endsWith('/review')) { const p = packets.find(p => u.pathname.includes(p.id)); assert.equal(p.status, 'review_ready'); assert.equal(p.pattern_status, 'usable_framework'); p.status = 'approved'; return json({ packet: p }); }
    if (u.pathname.endsWith('/research-packets')) { const t = items.find(t => u.pathname.includes(`/${t.id}/`)); assert.equal(body.mode, 'link_approved'); assert(body.packet_ids.every(id => packets.find(p => p.id === id).status === 'approved')); t.metadata.research_packet_ids = [...new Set([...t.metadata.research_packet_ids, ...body.packet_ids])]; return json({ work_item: t, side_effects: { publish: false, schedule: false, upload: false, external_post: false, provider_generation: false } }); }
    throw new Error('Unexpected write: ' + u.pathname);
   }
   if (u.pathname.endsWith('/research-packets')) return json({ packets });
   if (u.pathname === '/api/admin/agents/work-items') return u.searchParams.get('source_type') === 'social_content_calendar_authorization' ? json({ work_items: empty ? [] : items, ...(denied ? { error: 'Unauthorized. Sign in as admin and retry.' } : {}) }, denied ? 401 : 200) : json({ work_items: [] });
   if (u.pathname === '/api/admin/social-content/calendar') return json({ items: calendar });
   if (u.pathname === '/api/admin/campaigns') return json({ data: [{ id: 'readiness', name: 'Agentic Operating System Readiness Challenge', status: 'active' }] });
   if (u.pathname.endsWith('/autoresearch-backlog')) return json({ error: 'Not part of this fixture' }, 503);
   if (u.pathname.startsWith('/api/')) return json({ items: [], data: [], count: 0 });
   return r.continue();
  });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/admin/agents/content-intelligence?section=research`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /Link research patterns/ }).click({ timeout: 15000 });
  await expect(page.getByText(/14 handoffs shown/)).toBeVisible();
  const panel = page.getByLabel('Campaign research binding');
  async function shot(name) { await panel.scrollIntoViewIfNeeded(); await page.waitForTimeout(500); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await page.screenshot({ path: `${out}/${width}-${name}.png` }); }
  await page.getByLabel('Campaign filter').selectOption('readiness');
  await expect(page.getByLabel(/Source too close to reuse/)).toBeDisabled();
  await expect(page.getByLabel(/^Handoff 14:/)).toBeDisabled();
  await page.getByLabel(/^Workflow boundaries/).check(); await page.getByLabel(/^Public framework/).check();
  await page.getByLabel(/^Handoff 1:/).check(); await page.getByLabel(/^Handoff 2:/).check();
  await page.getByLabel('Campaign evidence decision note').fill('Use public structure only; keep original claims and wording under human review.');
  await shot('selected');
  await page.getByRole('button', { name: /Approve & link 2 packet/ }).click();
  await expect(page.getByText(/2 packet\(s\) linked to 2 handoff/)).toBeVisible(); await shot('linked');
  assert.equal(writes.length, 3); assert.equal(packets[2].status, 'review_ready'); assert.deepEqual(items[0].metadata.research_packet_ids, ['packet-0','packet-1']);
  denied = true; await page.getByLabel('Evidence target').selectOption('social'); await page.getByLabel('Evidence target').selectOption('campaign');
  await expect(panel.getByRole('alert')).toContainText('Unauthorized'); await shot('unauthorized');
  denied = false; empty = true; await page.getByRole('button', { name: 'Retry loading handoffs' }).click();
  await expect(page.getByText(/No campaign handoffs found/)).toBeVisible(); await shot('empty');
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  results.push({ width, url: page.url(), handoffs: 14, writes, external_requests: 0, errors });
  const video = page.video(); await context.close(); execFileSync('ffmpeg', ['-y','-i',await video.path(),'-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',`${out}/${width}-walkthrough.mp4`], { stdio: 'ignore' });
 }
 await browser.close(); fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2)); console.log('PASS: 390, 768, 1440; 14 handoffs; explicit approval/linking; blocked, unauthorized, empty; external requests 0');
})().catch(e => { console.error(e); process.exit(1) });
