import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(await readFile(path.join(root, 'v2/manifest.json'), 'utf8'))
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

if (manifest.schema !== 'portfolio-youtube-homepage-evidence/v2' ||
    manifest.state !== 'review_only_local_preview_not_provider_ready' ||
    manifest.uploaded !== false || manifest.submitted !== false ||
    manifest.provider_write !== false || manifest.production_data_write !== false ||
    manifest.address_bar_capture_status !== 'pending_integration_captain') {
  throw new Error('Evidence package safety state changed')
}

for (const [relativePath, expectedHash] of Object.entries(manifest.source_sha256)) {
  const bytes = await readFile(path.join(root, '../../..', relativePath))
  if (sha256(bytes) !== expectedHash) throw new Error(`Source drift: ${relativePath}`)
}

for (const file of manifest.files) {
  if (!file.path || file.path.includes('..') || path.isAbsolute(file.path)) throw new Error('Invalid evidence path')
  if (file.status === 'provider_ready') throw new Error('Local preview cannot be provider-ready')
  const fullPath = path.join(root, 'v2', file.path)
  const [bytes, details] = await Promise.all([readFile(fullPath), stat(fullPath)])
  if (sha256(bytes) !== file.sha256 || details.size !== file.bytes) throw new Error(`Evidence drift: ${file.path}`)
}

console.log(`PASS: v2 review-only manifest, ${manifest.files.length} evidence files and source hashes`)
