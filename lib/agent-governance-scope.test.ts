import { describe, expect, it } from 'vitest'
import { parseAgentGovernanceExportScope } from './agent-governance-scope'

describe('agent governance export scope parsing', () => {
  it('accepts run, client project, and date filters', () => {
    const result = parseAgentGovernanceExportScope(new URLSearchParams({
      runId: '11111111-1111-4111-8111-111111111111',
      clientProjectId: 'client-456',
      from: '2026-05-01',
      to: '2026-05-21',
    }))

    expect(result.errors).toEqual([])
    expect(result.has_scope).toBe(true)
    expect(result.scope).toMatchObject({
      run_id: '11111111-1111-4111-8111-111111111111',
      client_project_id: 'client-456',
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-21T23:59:59.999Z',
    })
  })

  it('accepts snake-case aliases', () => {
    const result = parseAgentGovernanceExportScope(new URLSearchParams({
      run_id: '22222222-2222-4222-8222-222222222222',
      client_project_id: 'client-snake',
    }))

    expect(result.errors).toEqual([])
    expect(result.scope.run_id).toBe('22222222-2222-4222-8222-222222222222')
    expect(result.scope.client_project_id).toBe('client-snake')
  })

  it('rejects invalid date windows and run IDs', () => {
    const invalidDate = parseAgentGovernanceExportScope(new URLSearchParams({ from: 'not-a-date' }))
    const invertedRange = parseAgentGovernanceExportScope(new URLSearchParams({
      from: '2026-05-22',
      to: '2026-05-21',
    }))
    const invalidRunId = parseAgentGovernanceExportScope(new URLSearchParams({ runId: 'run-123' }))

    expect(invalidDate.errors[0]).toContain('from must be an ISO date')
    expect(invertedRange.errors).toContain('from must be before or equal to to')
    expect(invalidRunId.errors).toContain('runId must be a UUID')
  })
})
