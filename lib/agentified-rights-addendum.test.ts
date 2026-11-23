import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import content from './agentified-workshop-content.json'
import bindings from './agentified-qualified-bindings.json'
import receipt from '../docs/agentified-distribution-readiness/phase-6a/owner-rights-addendum-2026-11-23.json'

const sha256 = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex')
const sorted = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sorted)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sorted(item)]))
  }
  return value
}

describe('Agentified L02-L04 owner-rights addendum', () => {
  it('binds only the exact transcript, worksheet, and diagram source bytes', () => {
    expect(receipt.productionCommit).toBe('aef8c3ec2a3415f0c84f21cfbd3f143c1a299f85')
    expect(receipt.contentSource.version).toBe(content.version)
    expect(sha256(readFileSync(receipt.contentSource.path))).toBe(receipt.contentSource.sha256)
    expect(Object.keys(receipt.coveredLessons)).toEqual(['L02', 'L03', 'L04'])
    expect(bindings.releaseScope).toBe(receipt.formatContract.releaseScope)
    for (const [id, covered] of Object.entries(receipt.coveredLessons)) {
      const lesson = content.lessons.find((item) => item.id === id)
      expect(lesson).toBeDefined()
      expect(sha256(JSON.stringify(sorted(lesson)))).toBe(covered.lessonSha256)
      expect(lesson?.visuals).toHaveLength(1)
      expect(`public${lesson?.visuals[0].src}`).toBe(covered.diagram.path)
      expect(sha256(readFileSync(covered.diagram.path))).toBe(covered.diagram.sha256)
      expect(bindings.bindings).not.toHaveProperty(id)
    }
  })
})
