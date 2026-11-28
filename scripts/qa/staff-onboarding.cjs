// Integration test of the real Next route. Synthetic auth only; block every external request.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const base = 'http://127.0.0.1:3199';
const route = '/admin/help/onboarding';
const out = path.resolve('docs/staff-onboarding/qa');
const raw = path.resolve('local-private/staff-onboarding-qa');
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(raw, { recursive: true });
const user = { id: '22222222-2222-4222-8222-222222222222', email: 'qa@example.invalid', aud: 'authenticated', role: 'authenticated' };
const session = { access_token: 'synthetic-qa-token', refresh_token: 'synthetic-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user };
(async () => {
 const browser = await chromium.launch();
 const reports = [];
 for (const theme of ['dark', 'light']) {
 for (const width of [360, 390, 430, 768, 1440]) {
  const record = theme === 'dark' && [390, 1440].includes(width);
  const screenshotOut = theme === 'dark' ? out : raw;
  const ctx = await browser.newContext({ viewport: { width, height: 960 }, serviceWorkers: 'block', ...(record ? { recordVideo: { dir: raw, size: { width, height: 960 } } } : {}) });
  await ctx.addInitScript(({ session, theme }) => { localStorage.setItem('sb-127-auth-token', JSON.stringify(session)); localStorage.setItem('theme', theme); }, { session, theme });
  const externalBlocked = [], errors = [], writes = [];
  await ctx.route('**/*', request => {
   const req = request.request(), url = new URL(req.url());
   const json = body => request.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
   if (!['GET', 'HEAD'].includes(req.method())) writes.push(`${req.method()} ${url.pathname}`);
   if (url.origin === 'http://127.0.0.1:3999' && url.pathname === '/auth/v1/user') return json(user);
   if (url.origin !== base) { externalBlocked.push(url.origin); return request.abort(); }
   if (url.pathname === '/api/user/profile') return json({ profile: { ...user, role: 'admin' } });
   if (url.pathname.startsWith('/api/')) return json({ items: [], count: 0 });
   return request.continue();
  });
  const page = await ctx.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + route);
  const guide = page.getByTestId('staff-onboarding');
  await expect(guide.getByRole('heading', { name: 'Welcome to your workspace' })).toBeVisible({ timeout: 60000 });
  await expect(guide.getByRole('img', { name: 'AmaduTown shield' })).toBeVisible();
  await guide.getByRole('img', { name: 'AmaduTown shield' }).evaluate(image => image.decode());
  await expect(page.locator('html')).toHaveClass(new RegExp(theme));
  const presentation = await guide.evaluate(el => ({
   backgroundToken: getComputedStyle(el).getPropertyValue('--background').trim(),
   foreground: getComputedStyle(el).color,
   forcedDarkAdmin: Boolean(el.closest('div.dark')),
   headingFont: getComputedStyle(el.querySelector('h1')).fontFamily,
  }));
  assert.equal(presentation.forcedDarkAdmin, true);
  assert.equal(presentation.backgroundToken.toLowerCase(), '#121e31');
  assert.equal(presentation.foreground, 'rgb(234, 236, 238)');
  await page.screenshot({ path: `${out}/${width}-${theme === 'dark' ? 'welcome' : 'light-preference'}.png` });
  const overflow = async () => {
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'page overflow');
   const clipped = await guide.locator('*').evaluateAll(elements => elements.filter(el => el.getClientRects().length && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1).map(el => el.tagName + ':' + el.textContent.slice(0,60)));
   assert.deepEqual(clipped, [], 'clipped guide content');
  };
  await overflow();
  await page.waitForTimeout(record ? 1800 : 0);
  for (const id of ['workspace','day','boundaries','tools','glossary','help']) {
   const summary = guide.locator(`#${id} summary`);
   await summary.click();
   await expect(guide.locator(`#${id}`)).toHaveAttribute('open', '');
   await overflow();
   await page.screenshot({ path: `${raw}/${width}-${id}.png`, fullPage: true });
   if (['workspace','boundaries','tools'].includes(id)) {
    await guide.locator(`#${id}`).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${screenshotOut}/${width}-${id}.png` });
    if (record) {
     await page.waitForTimeout(1800);
     await guide.locator(`#${id} > div`).evaluate(el => el.scrollIntoView({ block: 'start' }));
     await page.waitForTimeout(1800);
    }
   }
   await summary.click();
   await expect(guide.locator(`#${id}`)).not.toHaveAttribute('open');
  }
  await guide.getByRole('button', { name: 'Start your first week' }).click();
  await expect(guide.locator('#week')).toHaveAttribute('open', '');
  for (const checkbox of await guide.getByRole('checkbox').all()) await checkbox.check();
  await expect(guide.getByText(/5 of 5 practice steps checked/)).toBeVisible();
  await overflow();
  await page.screenshot({ path: `${screenshotOut}/${width}-week.png` });
  if (record) await page.waitForTimeout(2000);
  // Reloading a bookmark reopens the section and resets the explicitly session-only practice checks.
  await page.reload();
  await expect(guide.locator('#week')).toHaveAttribute('open', '', { timeout: 60000 });
  await expect(guide.getByText(/0 of 5 practice steps checked/)).toBeVisible();
  await guide.locator('#week summary').press('Enter');
  await expect(guide.locator('#week')).not.toHaveAttribute('open');
  await page.goto(base + route + '#boundaries');
  await expect(guide.locator('#boundaries')).toHaveAttribute('open', '');
  await page.goto(base + route);
  if (theme === 'dark' && width === 1440) {
   const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
   await guide.getByRole('button', { name: 'Download PDF' }).click();
   const download = await downloadPromise;
   await download.saveAs(`${out}/amadutown-staff-onboarding.pdf`);
   await expect(guide.getByText(/PDF prepared/)).toBeVisible();
   await page.waitForTimeout(1500);
  }
  // Existing Help navigation and onboarding entry point remain connected.
  await guide.getByRole('link', { name: 'Help', exact: true }).click();
  await expect(page.getByRole('link', { name: /New to AmaduTown/ })).toBeVisible({ timeout: 60000 });
  await page.getByRole('link', { name: /New to AmaduTown/ }).click();
  await expect(guide).toBeVisible();
  if (width < 1024) {
   await page.getByRole('button', { name: 'Open admin menu' }).click();
   await expect(page.getByRole('dialog', { name: 'Admin navigation' })).toBeVisible();
   await page.getByRole('button', { name: 'Close menu' }).click();
   await expect(page.getByRole('dialog', { name: 'Admin navigation' })).not.toBeVisible();
  }
  await overflow();
  const laneWidth = await guide.evaluate(el => Math.round(el.getBoundingClientRect().width));
  const video = page.video(); await ctx.close();
  if (record) execFileSync('ffmpeg', ['-y','-i',await video.path(),'-c:v','libx264','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart',`${out}/onboarding-${width}.mp4`], { stdio:'ignore' });
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  reports.push({ themePreference: theme, effectiveGuideTheme: 'dark', presentation, width, contentLaneWidth: laneWidth, status: 'pass', pageErrors: errors, browserWriteRequests: writes, blockedExternalOrigins: [...new Set(externalBlocked)], externalRequestsAllowed: 0 });
  console.log(`PASS ${theme} preference, ${width}px: disclosure, checklist, bookmarks, Help navigation, overflow, keyboard${theme === 'dark' && width === 1440 ? ', PDF' : ''}`);
 }
 }
 const guest = await browser.newContext({ serviceWorkers:'block' });
 const unproxied = 'http://127.0.0.1:3198';
 await guest.route('**/*', request => new URL(request.request().url()).origin === unproxied ? request.continue() : request.abort());
 const page = await guest.newPage(); await page.goto(unproxied + route);
 await page.waitForURL('**/auth/login?redirect=**', { timeout: 30000 });
 assert.equal(new URL(page.url()).searchParams.get('redirect'), route);
 await guest.close(); await browser.close();
 fs.writeFileSync(`${out}/results.json`, JSON.stringify({ route, base, inAppReview: 'http://127.0.0.1:3199' + route, evidence: 'Real local Next route with synthetic auth and intercepted APIs. No live provider or production validation.', unauthenticatedRedirect: 'pass', themeBehavior: 'Both light and dark preferences tested. Existing admin layout forces dark presentation; no light-mode admin UI is implemented by this PR.', reports }, null, 2));
})().catch(error => { console.error(error); process.exit(1); });
