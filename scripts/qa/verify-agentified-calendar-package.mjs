import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const root = process.cwd()
const packetPath = 'agentified/campaign/portfolio-campaign-packet.json'
const manifestPath = 'public/agentified/campaign-review/2026-11-23/manifest.json'
const copyPath = 'agentified/campaign/draft-assets.md'
const packet = JSON.parse(readFileSync(resolve(root, packetPath), 'utf8'))
const manifest = JSON.parse(readFileSync(resolve(root, manifestPath), 'utf8'))
const ids = packet.calendar_items.map((item) => item.asset_id)

if (ids.length !== 10 || new Set(ids).size !== 10) {
  throw new Error('Expected ten unique Agentified Draft asset IDs')
}

const required = new Set([copyPath, packetPath, manifestPath])
for (const output of manifest.outputs) {
  if (!ids.some((id) => output.path.split('/').at(-1)?.startsWith(`${id.toLowerCase()}-`))) continue
  const actual = createHash('sha256').update(readFileSync(resolve(root, output.path))).digest('hex')
  if (actual !== output.sha256) throw new Error(`Agentified visual hash drift: ${output.path}`)
  required.add(output.path)
}

for (const tracePath of [
  '.next/server/app/api/admin/social-content/calendar/route.js.nft.json',
  '.next/server/app/admin/agents/content-intelligence/agentified-calendar/page.js.nft.json',
]) {
  const absoluteTrace = resolve(root, tracePath)
  const trace = JSON.parse(readFileSync(absoluteTrace, 'utf8'))
  const traced = new Set(trace.files.map((file) => resolve(dirname(absoluteTrace), file)))
  const missing = [...required].filter((file) => !traced.has(resolve(root, file)))
  if (missing.length) throw new Error(`${tracePath} lacks ${missing.join(', ')}`)
  console.log(`PASS ${tracePath}: ${required.size} immutable source files traced`)
}
