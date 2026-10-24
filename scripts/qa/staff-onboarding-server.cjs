// Isolated real-route QA, following slack-receipt-status-server.cjs. Never load real env files.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
for (const name of ['.env', '.env.local', '.env.development', '.env.development.local', '.env.production', '.env.production.local']) {
  if (fs.existsSync(name)) throw new Error(`Use a clean worktree without ${name}`);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'staff-onboarding-qa-'));
const guard = path.join(tmp, 'no-egress.cjs');
const fonts = path.join(tmp, 'fonts.cjs');
fs.writeFileSync(fonts, `module.exports = new Proxy({}, { get: () => "@font-face { font-family: 'QA Offline'; src: local('Arial'); font-style: normal; font-weight: 100 900; }" });`);
fs.writeFileSync(guard, `
const allowed = input => {
 const host = typeof input === 'object' && !(input instanceof URL) ? input.hostname || input.host : new URL(String(input)).hostname;
 if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) throw new Error('QA external network blocked');
};
const originalFetch = global.fetch;
global.fetch = (input, options) => { allowed(input.url || input); return originalFetch(input, options); };
for (const name of ['http', 'https']) {
 const client = require(name);
 for (const method of ['request', 'get']) {
  const original = client[method];
  client[method] = function(input, ...args) { allowed(input); return original.call(this, input, ...args); };
 }
}
`);
const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
 NODE_OPTIONS: `--require=${guard}`, NEXT_FONT_GOOGLE_MOCKED_RESPONSES: fonts, NEXT_TELEMETRY_DISABLED: '1',
 NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:3999', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-qa-key',
 MOCK_N8N: 'true', N8N_DISABLE_OUTBOUND: 'true' };
const build = process.argv.includes('--build');
const user = { id: '22222222-2222-4222-8222-222222222222', email: 'qa@example.invalid', aud: 'authenticated', role: 'authenticated' };
const session = { access_token: 'synthetic-qa-token', refresh_token: 'synthetic-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user };
// Optional local-only proxy makes the same rendered Next route reviewable in the in-app Browser.
// Synthetic identity and API interception exist only here, never in application code.
let proxy;
let auth;
if (!build) {
 auth = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:3199');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, apikey, x-client-info, content-type, x-supabase-api-version');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.url === '/auth/v1/user') { res.end(JSON.stringify(user)); return; }
  res.writeHead(403); res.end('{}');
 }).listen(3999, '127.0.0.1');
 proxy = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:3199');
  if (url.pathname.startsWith('/api/')) {
   res.setHeader('Content-Type', 'application/json');
   res.end(JSON.stringify(url.pathname === '/api/user/profile' ? { profile: { ...user, role: 'admin' } } : { items: [], count: 0 }));
   return;
  }
  if (!['/admin/help', '/admin/help/onboarding'].includes(url.pathname) && !url.pathname.startsWith('/_next/') && url.pathname !== '/amadutown-logo-upscaled.png' && url.pathname !== '/favicon.ico') {
   res.writeHead(403); res.end('QA proxy is limited to Help. Return to /admin/help/onboarding.'); return;
  }
  const upstream = http.request({ hostname: '127.0.0.1', port: 3198, path: req.url, method: 'GET', headers: { ...req.headers, 'accept-encoding': 'identity' } }, response => {
   const chunks = [];
   response.on('data', chunk => chunks.push(chunk));
   response.on('end', () => {
    if (res.headersSent || res.destroyed) return;
    const html = (response.headers['content-type'] || '').includes('text/html');
    const headers = { ...response.headers };
    delete headers['transfer-encoding']; delete headers['content-length']; delete headers['content-encoding'];
    headers['content-security-policy'] = "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' http://127.0.0.1:3999; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:";
    res.writeHead(response.statusCode, headers);
    let body = Buffer.concat(chunks);
    if (html) body = Buffer.from(body.toString().replace('<head>', `<head><script>localStorage.setItem('sb-127-auth-token', ${JSON.stringify(JSON.stringify(session))});</script>`));
    res.end(body);
   });
  });
  upstream.on('error', () => { if (!res.headersSent && !res.destroyed) { res.writeHead(503); res.end('Next preview is starting. Refresh shortly.'); } });
  upstream.end();
 }).listen(3199, '127.0.0.1', () => console.log('Synthetic Help-only review: http://127.0.0.1:3199/admin/help/onboarding'));
}
const child = spawn(build ? 'npm' : process.execPath, build ? ['run', 'build'] : [require.resolve('next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3198'], { env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { proxy?.close(); auth?.close(); child.kill(signal); });
child.on('exit', code => { proxy?.close(); auth?.close(); process.exit(code ?? 0); });
