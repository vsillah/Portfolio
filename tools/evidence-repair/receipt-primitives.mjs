import { createHash } from 'node:crypto'

const HASH = /^sha256:[a-f0-9]{64}$/
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join('|') === [...keys].sort().join('|')
const canonical = (value) => JSON.stringify(value, (_, entry) => entry && typeof entry === 'object' && !Array.isArray(entry) ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b))) : entry)
const sha = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`

// Runtime-safe primitives: callers must supply their own read-only byte resolver.
export function fixtureHash(fixture) {
  const { fixture_sha256, ...body } = fixture
  return sha(canonical(body))
}

export function verifySource(source, readSource) {
  if (!exactKeys(source, ['path', 'sha256']) || !HASH.test(source.sha256) || typeof readSource !== 'function') throw new Error('invalid source binding')
  if (sha(readSource(source.path)) !== source.sha256) throw new Error(`source hash mismatch: ${source.path}`)
}
