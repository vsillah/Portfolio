import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { applyValidatedEvidenceFilter, getFaithfulnessMode } from './index'

interface FakeQuery {
  eqs: Array<[string, unknown]>
  neqs: Array<[string, unknown]>
  eq(col: string, v: unknown): FakeQuery
  neq(col: string, v: unknown): FakeQuery
}

function mkQuery(): FakeQuery {
  const q: FakeQuery = {
    eqs: [],
    neqs: [],
    eq(col, v) {
      this.eqs.push([col, v])
      return this
    },
    neq(col, v) {
      this.neqs.push([col, v])
      return this
    },
  }
  return q
}

describe('getFaithfulnessMode', () => {
  const ORIGINAL = process.env.VEP_FAITHFULNESS_MODE
  beforeEach(() => {
    delete process.env.VEP_FAITHFULNESS_MODE
  })
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.VEP_FAITHFULNESS_MODE
    else process.env.VEP_FAITHFULNESS_MODE = ORIGINAL
  })

  it('defaults to "off" when env not set', () => {
    expect(getFaithfulnessMode()).toBe('off')
  })

  it('reads permissive / strict and ignores anything else', () => {
    process.env.VEP_FAITHFULNESS_MODE = 'permissive'
    expect(getFaithfulnessMode()).toBe('permissive')
    process.env.VEP_FAITHFULNESS_MODE = 'STRICT'
    expect(getFaithfulnessMode()).toBe('strict')
    process.env.VEP_FAITHFULNESS_MODE = 'garbage'
    expect(getFaithfulnessMode()).toBe('off')
  })
})

describe('applyValidatedEvidenceFilter', () => {
  it('mode=off is a no-op (Phase 2a default)', () => {
    const q = mkQuery()
    applyValidatedEvidenceFilter(q, 'off')
    expect(q.eqs).toEqual([])
    expect(q.neqs).toEqual([])
  })

  it('mode=permissive excludes rejected sources and unfaithful excerpts — but NOT pending', () => {
    const q = mkQuery()
    applyValidatedEvidenceFilter(q, 'permissive')
    expect(q.neqs).toContainEqual(['source_validation_status', 'rejected'])
    expect(q.neqs).toContainEqual(['excerpt_faithfulness_status', 'unfaithful'])
    // Phase 2a invariant: permissive must NOT exclude pending rows.
    expect(q.neqs.find(([c, v]) => c === 'excerpt_faithfulness_status' && v === 'pending')).toBeUndefined()
    expect(q.eqs).toEqual([])
  })

  it('mode=strict keeps only faithful excerpts and excludes rejected sources', () => {
    const q = mkQuery()
    applyValidatedEvidenceFilter(q, 'strict')
    expect(q.neqs).toContainEqual(['source_validation_status', 'rejected'])
    expect(q.eqs).toContainEqual(['excerpt_faithfulness_status', 'faithful'])
  })
})
