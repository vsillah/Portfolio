import { describe, expect, it } from 'vitest'

import { diagnosticGetSchema, diagnosticPutSchema } from './chat-validation'

describe('diagnosticGetSchema', () => {
  it('accepts numeric audit ids used by BIGINT-backed audits', () => {
    const parsed = diagnosticGetSchema.safeParse({ auditId: '42' })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.auditId).toBe('42')
    }
  })

  it('still accepts UUID audit ids for legacy callers', () => {
    const parsed = diagnosticGetSchema.safeParse({
      auditId: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.auditId).toBe('550e8400-e29b-41d4-a716-446655440000')
    }
  })

  it('rejects invalid audit ids that are neither UUID nor numeric', () => {
    const parsed = diagnosticGetSchema.safeParse({ auditId: 'audit-42' })

    expect(parsed.success).toBe(false)
  })

  it('requires either sessionId or auditId', () => {
    const parsed = diagnosticGetSchema.safeParse({})

    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe('sessionId or auditId is required')
    }
  })
})

describe('diagnosticPutSchema', () => {
  it('accepts numeric audit ids', () => {
    const parsed = diagnosticPutSchema.safeParse({
      auditId: '987654321',
      status: 'in_progress',
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.auditId).toBe('987654321')
    }
  })

  it('accepts UUID audit ids', () => {
    const parsed = diagnosticPutSchema.safeParse({
      auditId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'completed',
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.auditId).toBe('550e8400-e29b-41d4-a716-446655440000')
    }
  })

  it('rejects invalid audit ids', () => {
    const parsed = diagnosticPutSchema.safeParse({
      auditId: 'not-valid',
    })

    expect(parsed.success).toBe(false)
  })
})
