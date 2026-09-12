// Start only an isolated localhost QA runtime. No real environment files or credentials.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
for (const name of ['.env', '.env.local', '.env.development', '.env.development.local']) {
 if (fs.existsSync(name)) throw new Error(`Use a clean worktree without ${name} for synthetic receipt QA`);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'slack-receipt-qa-'));
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
 NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:3999', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-anon-key',
 NEXT_PUBLIC_APP_ENV: 'development', APP_ENV: 'development', MOCK_N8N: 'true', N8N_DISABLE_OUTBOUND: 'true' };
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3197'], { env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 0));
