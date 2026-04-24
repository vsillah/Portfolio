import { describe, expect, it } from 'vitest'

import {
  diagnosticGetSchema,
  diagnosticPutSchema,
  zodErrorResponse,
} from './chat-validation'

describe('diagnosticGetSchema', () => {
  it('accepts a numeric auditId for BIGINT-backed diagnostic audits', () => {
    const parsed = diagnosticGetSchema.safeParse({ auditId: '1234567890123' })

    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.auditId).toBe('1234567890123')
  })

  it('accepts a UUID auditId for legacy callers', () => {
    const parsed = diagnosticGetSchema.safeParse({
      auditId: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(parsed.success).toBe(true)
  })

  it('rejects invalid auditId formats', () => {
    const parsed = diagnosticGetSchema.safeParse({ auditId: 'audit_123' })

    expect(parsed.success).toBe(false)
    if (parsed.success) return
    const response = zodErrorResponse(parsed.error)
    expect(response.status).toBe(400)
    expect(response.error).toBe('Invalid request')
    expect(response.detail).toContain('auditId')
  })

  it('requires either sessionId or auditId', () => {
    const parsed = diagnosticGetSchema.safeParse({})

    expect(parsed.success).toBe(false)
    if (parsed.success) return
    const response = zodErrorResponse(parsed.error)
    expect(response.status).toBe(400)
    expect(response.detail).toContain('sessionId or auditId is required')
  })
})

describe('diagnosticPutSchema', () => {
  it('accepts numeric auditId in update payloads', () => {
    const parsed = diagnosticPutSchema.safeParse({
      auditId: '987654321',
      status: 'in_progress',
      progress: {
        completedCategories: ['tech_stack'],
        questionsAsked: ['What tools are you using?'],
        responsesReceived: { tools: 'Shopify, Zapier' },
        currentCategory: 'tech_stack',
      },
    })

    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.auditId).toBe('987654321')
  })
})
