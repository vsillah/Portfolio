import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { deterministicSha256Hex } from './deterministic-sha256.mjs'

describe('browser-safe deterministic SHA-256', () => {
  it.each(['', 'abc', 'receipt:thumbnail:✓', JSON.stringify({ nested: ['evidence', 75, false] })])('matches Node SHA-256 for %j', (value) => {
    expect(deterministicSha256Hex(value)).toBe(createHash('sha256').update(value).digest('hex'))
  })
})
