// Only for local synthetic QA. Prevent server fetches from leaving loopback.
const originalFetch = globalThis.fetch
const fs = require('node:fs')
globalThis.fetch = async function (input, init) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    if (process.env.SMS_QA_BLOCKED_FETCH_LOG) fs.appendFileSync(process.env.SMS_QA_BLOCKED_FETCH_LOG, JSON.stringify({ host: url.hostname, blocked: true })+'\n')
    throw new Error('Nonlocal fetch blocked by synthetic SMS QA guard')
  }
  return originalFetch(input, init)
}
