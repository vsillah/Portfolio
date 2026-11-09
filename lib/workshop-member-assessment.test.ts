import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  project: vi.fn(),
  calls: [] as { table: string; filters: Record<string, unknown> }[],
}))
vi.mock('@/lib/client-dashboard', () => ({ getDashboardByToken: fixture.project }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: {
  from: (table: string) => {
    const filters: Record<string, unknown> = {}
    const execute = () => {
      fixture.calls.push({ table, filters: { ...filters } })
      const rows = (fixture.tables[table] ?? []).filter((row) => Object.entries(filters).every(([key, value]) =>
        Array.isArray(value) ? value.includes(row[key]) : row[key] === value))
      return { data: rows, error: null }
    }
    const builder = {
      select: () => builder,
      eq: (key: string, value: unknown) => { filters[key] = value; return builder },
      in: (key: string, value: unknown[]) => { filters[key] = value; return builder },
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => { const result = execute(); return { data: result.data[0] ?? null, error: null } },
      then: (resolve: (result: ReturnType<typeof execute>) => unknown) => Promise.resolve(resolve(execute())),
    }
    return builder
  },
} }))

import { loadWorkshopMemberAssessment } from './workshop-member-assessment'

describe('exact workshop assessment projection', () => {
  beforeEach(() => {
    fixture.calls.length = 0
    fixture.project.mockReset().mockResolvedValue({ error: null, stage: 'lead', data: { marker: 'Accelerated assessment' } })
    fixture.tables = {
      accelerated_decision_file_owners: [{ intake_id: 'accelerated-intake', user_id: 'member' }, { intake_id: 'agentified-intake', user_id: 'member' }, { intake_id: 'foreign-intake', user_id: 'other' }],
      accelerated_decision_file_intakes: [
        { id: 'accelerated-intake', content_version: 'accelerated-v1', review_status: 'linked', linked_audit_id: 11 },
        { id: 'agentified-intake', content_version: 'agentified-v1', review_status: 'linked', linked_audit_id: 22 },
        { id: 'foreign-intake', content_version: 'agentified-v1', review_status: 'linked', linked_audit_id: 33 },
      ],
      diagnostic_audits: [
        { id: 11, user_id: 'member', status: 'completed', diagnostic_summary: 'Accelerated summary' },
        { id: 22, user_id: 'member', status: 'completed', diagnostic_summary: 'Agentified summary' },
        { id: 33, user_id: 'other', status: 'completed', diagnostic_summary: 'Foreign summary' },
      ],
      accelerated_member_recommendations: [
        { id: 'accelerated-offer', user_id: 'member', intake_id: 'accelerated-intake', audit_id: 11, review_status: 'approved' },
        { id: 'agentified-offer', user_id: 'member', intake_id: 'agentified-intake', audit_id: 22, review_status: 'approved' },
      ],
      client_dashboard_access: [{ diagnostic_audit_id: 11, is_active: true, access_token: 'accelerated-token' }, { diagnostic_audit_id: 22, is_active: true, access_token: 'agentified-token' }],
    }
  })

  it('isolates assessments and offers for two workshops owned by one account', async () => {
    const accelerated = await loadWorkshopMemberAssessment('member', 'accelerated-v1')
    const agentified = await loadWorkshopMemberAssessment('member', 'agentified-v1')
    expect(accelerated.assessmentStatus?.summary).toBe('Accelerated summary')
    expect(agentified.assessmentStatus?.summary).toBe('Agentified summary')
    expect(accelerated.recommendations.map((row: { id: string }) => row.id)).toEqual(['accelerated-offer'])
    expect(agentified.recommendations.map((row: { id: string }) => row.id)).toEqual(['agentified-offer'])
    expect(fixture.calls.filter((call) => call.table === 'diagnostic_audits').map((call) => call.filters.id)).toEqual([11, 22])
    expect(fixture.project).toHaveBeenCalledWith('accelerated-token')
    expect(fixture.project).toHaveBeenCalledWith('agentified-token')
  })

  it('withholds assessment and offers when the reviewed audit is not owned by the member', async () => {
    fixture.tables.diagnostic_audits[1].user_id = 'other'
    const agentified = await loadWorkshopMemberAssessment('member', 'agentified-v1')
    expect(agentified.assessment).toBeNull()
    expect(agentified.recommendations).toEqual([])
    expect(fixture.project).not.toHaveBeenCalled()
  })

  it('does not use an unreviewed intake or a latest unrelated audit', async () => {
    fixture.tables.accelerated_decision_file_intakes[1].review_status = 'reviewing'
    const agentified = await loadWorkshopMemberAssessment('member', 'agentified-v1')
    expect(agentified.assessmentStatus).toBeNull()
    expect(agentified.recommendations).toEqual([])
    expect(fixture.calls.some((call) => call.table === 'diagnostic_audits')).toBe(false)
  })
})
