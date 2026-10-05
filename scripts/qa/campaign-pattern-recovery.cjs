// Real Next page and real route handlers, backed only by an in-memory fixture.
// Run the no-egress Next server on 3218 first. No credentials or production writes.
const { chromium, expect } = require('@playwright/test');
const esbuild = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:3218';
const id = '78060cc6-9f1c-4679-873f-4b651257a8d4';
const tmp = path.resolve('local-private/campaign-pattern-recovery');
const out = path.resolve('docs/campaign-autopilot/qa/pattern-recovery');
fs.mkdirSync(tmp, { recursive: true }); fs.mkdirSync(out, { recursive: true });
const shim = `
export let item;
export const packet = { id: 'approved-framework-qa', title: 'Practical question to review checklist', status: 'approved', pattern_status: 'usable_framework', source_url: 'https://example.invalid/public-framework', platform: 'linkedin', creator_name: 'Synthetic research example', pattern_packet: { hook_structure: 'Open with a practical question, then offer a review checklist.', promise_value: 'A concrete next step for a team reviewing its first workflow.' } };
export function reset() { item = { id: '${id}', title: 'Prepare LinkedIn draft handoff: Tease: Agentic Operating System Readiness Challenge', source_type: 'social_content_calendar_authorization', metadata: { source: 'social_content_calendar_authorization', calendar_item_id: 'calendar-qa', campaign_id: '66ab9bc9-0f6f-4d6b-8640-0b0e5e028676', campaign_name: 'Agentic Operating System Readiness Challenge', social_content_id: 'ddf4feca-1445-4bdb-8a6a-8ff7a0ddb850', channel: 'linkedin', campaign_phase: 'tease', draft_handoff_only: true, external_execution_enabled: false } }; }
export const verifyAdmin = async () => ({ user: { id: 'synthetic-admin' } });
export const isAuthError = () => false;
export const getAgentWorkItem = async () => structuredClone(item);
export const updateAgentWorkItemMetadata = async ({ metadata }) => { item = { ...item, metadata }; return structuredClone(item); };
export const supabaseAdmin = { from(table) {
 if (table === 'social_content_research_packets') return { select: () => ({ in: async (_column, ids) => ({ data: ids.includes(packet.id) ? [packet] : [], error: null }) }) };
 if (table === 'social_content_calendar_items') return { select: () => ({ eq: () => ({ single: async () => ({ data: { ...item.metadata, id: 'calendar-qa', title: 'Tease: Agentic Operating System Readiness Challenge', planned_angle: 'Which workflow would your team trust an AI assistant to handle, and where would a person still need to decide?', authorization_status: 'authorized', metadata: { platform_draft_handoff: { work_item_id: item.id } } }, error: null }) }) }) };
 throw new Error('Unexpected database access: ' + table);
} };
reset();
`;
(async () => {
 await esbuild.build({ stdin: { contents: `export { POST as link } from './app/api/admin/agents/work-items/[id]/research-packets/route'; export { POST as prepare } from './app/api/admin/agents/work-items/[id]/social-channels/prepare-review-drafts/route'; export { reset, getAgentWorkItem, packet } from 'qa-memory';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', packages: 'external', outfile: `${tmp}/handlers.cjs`, plugins: [{ name: 'fixture', setup(b) { b.onResolve({ filter: /^(qa-memory|@\/lib\/(auth-server|agent-work-items|supabase))$/ }, a => ({ path: 'qa-memory', namespace: 'fixture' })); b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: shim, loader: 'ts' })); } }] });
 const handlers = require(`${tmp}/handlers.cjs`);
 const browser = await chromium.launch(); const results = [];
 for (const width of [390, 768, 1440]) {
  handlers.reset(); let packetsAvailable = false; const calls = [], errors = [], external = [];
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, recordVideo: { dir: tmp, size: { width, height: 1000 } }, serviceWorkers: 'block' });
  const user = { id: 'synthetic-admin', email: 'qa@example.invalid', aud: 'authenticated', role: 'authenticated' };
  await ctx.addInitScript(user => { localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'synthetic-token', refresh_token: 'synthetic-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user })); }, user);
  await ctx.route('**/*', async r => {
   const u = new URL(r.request().url()); const json = (data, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
   if (u.origin === 'http://127.0.0.1:3999' && u.pathname === '/auth/v1/user') return json(user);
   if (u.pathname.includes('/_vercel/') || u.origin === 'https://va.vercel-scripts.com') return r.fulfill({ contentType: 'application/javascript', body: '' });
   if (u.origin !== base) { external.push(u.origin); return r.abort(); }
   if (u.pathname === '/api/user/profile') return json({ profile: { ...user, role: 'admin' } });
   if (u.pathname === `/api/admin/agents/work-items/${id}`) return json({ work_item: await handlers.getAgentWorkItem() });
   if (u.pathname === '/api/admin/social-content/intelligence/research-packets') return json({ packets: packetsAvailable ? [handlers.packet] : [] });
   if (u.pathname.endsWith('/research-packets') || u.pathname.endsWith('/prepare-review-drafts')) {
    calls.push({ method: r.request().method(), path: u.pathname });
    const fn = u.pathname.endsWith('/research-packets') ? handlers.link : handlers.prepare;
    const response = await fn(new Request(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: r.request().postData() || '{}' }), { params: { id } });
    return json(await response.json(), response.status);
   }
   if (u.pathname.startsWith('/api/')) return json({ items: [], data: [], count: 0 });
   return r.continue();
  });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/admin/agents/social-insights/${id}`, { waitUntil: 'domcontentloaded' });
  const prepare = page.getByRole('button', { name: 'Prepare Channel Review Drafts' });
  await expect(page.getByRole('button', { name: 'Find approved patterns' })).toBeVisible({ timeout: 60000 });
  await expect(prepare).toBeDisabled();
  async function shot(name, locator) {
   if (locator) await locator.scrollIntoViewIfNeeded();
   if (name === 'linkedin-copy') { await locator.evaluate(el => el.parentElement.scrollIntoView({ block: 'start' })); await page.mouse.wheel(0, -85); }
   await page.waitForTimeout(1600);
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width} ${name} page overflow`);
   await page.screenshot({ path: `${out}/${width}-${name}.png` });
  }
  await shot('blocked', page.getByText('Shared evidence', { exact: true }));
  await page.getByRole('button', { name: 'Find approved patterns' }).click();
  await expect(page.getByText(/No eligible approved frameworks found/)).toBeVisible();
  await shot('no-evidence', page.getByRole('link', { name: 'Review evidence in Content Intelligence' }));
  packetsAvailable = true;
  await page.getByRole('button', { name: 'Refresh approved patterns' }).click();
  await page.getByLabel('Approved framework').selectOption(handlers.packet.id);
  await shot('selected-evidence', page.getByRole('button', { name: 'Link selected pattern' }));
  await page.getByRole('button', { name: 'Link selected pattern' }).click();
  await expect(prepare).toBeEnabled();
  await prepare.click();
  await expect(page.getByText('Review draft packet', { exact: true })).toBeVisible();
  await shot('review-copy', page.getByText('Review draft packet', { exact: true }));
  await shot('linkedin-copy', page.getByText('Post text', { exact: false }).first());
  const item = await handlers.getAgentWorkItem();
  for (const lane of Object.values(item.metadata.channel_lanes)) {
   assert.equal(lane.status, 'in_review');
   assert.equal(lane.draft_packet.shared_source.calendar_item_id, 'calendar-qa');
   assert.equal(lane.draft_packet.shared_source.campaign_id, item.metadata.campaign_id);
   assert(Object.values(lane.draft_packet.side_effects).every(value => value === false));
  }
  assert.equal(calls.length, 2); assert.equal(external.length, 0); assert.deepEqual(errors, []);
  results.push({ width, url: page.url(), calls, errors, external_requests: external.length, campaign_provenance: true, packets_in_review: 7 });
  const video = page.video(); await ctx.close();
  execFileSync('ffmpeg', ['-y', '-i', await video.path(), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${out}/${width}-walkthrough.mp4`], { stdio: 'ignore' });
 }
 await browser.close(); fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2)); console.log(JSON.stringify(results, null, 2));
})().catch(error => { console.error(error); process.exit(1); });
