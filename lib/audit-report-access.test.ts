import { beforeEach, describe, expect, it, vi } from 'vitest'

type Scenario = {
  byUser?: boolean
  byEmail?: boolean
  byContact?: boolean
  contactSubmissionIds?: number[]
}

type ExecutedQuery = {
  table: string
  mode: 'single' | 'list'
  eq: Record<string, unknown>
  in: Record<string, unknown[]>
}

let supabaseAdminMock: { from: ReturnType<typeof vi.fn> } | null = null
const fromMock = vi.fn()
const executedQueries: ExecutedQuery[] = []

function snapshotMap<T>(input: Map<string, T>): Record<string, T> {
  const output: Record<string, T> = {}
  for (const [key, value] of input.entries()) {
    output[key] = value
  }
  return output
}

function createSupabaseAdminStub(scenario: Scenario) {
  fromMock.mockImplementation((table: string) => {
    const eqFilters = new Map<string, unknown>()
    const inFilters = new Map<string, unknown[]>()

    const executeMaybeSingle = async () => {
      executedQueries.push({
        table,
        mode: 'single',
        eq: snapshotMap(eqFilters),
        in: snapshotMap(inFilters),
      })

      if (table !== 'diagnostic_audits') return { data: null }

      if (eqFilters.has('user_id')) {
        return { data: scenario.byUser ? { id: 'matched-by-user' } : null }
      }
      if (eqFilters.has('contact_email')) {
        return { data: scenario.byEmail ? { id: 'matched-by-email' } : null }
      }
      if (inFilters.has('contact_submission_id')) {
        return { data: scenario.byContact ? { id: 'matched-by-contact' } : null }
      }

      return { data: null }
    }

    const executeList = async () => {
      executedQueries.push({
        table,
        mode: 'list',
        eq: snapshotMap(eqFilters),
        in: snapshotMap(inFilters),
      })

      if (table === 'contact_submissions') {
        const ids = scenario.contactSubmissionIds ?? []
        return { data: ids.map((id) => ({ id })) }
      }

      return { data: [] }
    }

    const builder: {
      select: ReturnType<typeof vi.fn>
      eq: ReturnType<typeof vi.fn>
      in: ReturnType<typeof vi.fn>
      maybeSingle: ReturnType<typeof vi.fn>
      then: Promise<{ data: Array<{ id: number }> }>['then']
    } = {
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: unknown) => {
        eqFilters.set(column, value)
        return builder
      }),
      in: vi.fn((column: string, values: unknown[]) => {
        inFilters.set(column, values)
        return builder
      }),
      maybeSingle: vi.fn(executeMaybeSingle),
      then: (onFulfilled, onRejected) => executeList().then(onFulfilled, onRejected),
    }

    return builder
  })

  return { from: fromMock }
}

vi.mock('@/lib/supabase', () => ({
  get supabaseAdmin() {
    return supabaseAdminMock
  },
}))

import { userOwnsAudit } from './audit-report-access'

describe('userOwnsAudit', () => {
  beforeEach(() => {
    supabaseAdminMock = null
    fromMock.mockReset()
    executedQueries.length = 0
  })

  it('returns false when supabase admin client is unavailable', async () => {
    const result = await userOwnsAudit('audit-1', 'user-1', 'owner@example.com')
    expect(result).toBe(false)
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('returns true immediately when the audit is owned by user_id', async () => {
    supabaseAdminMock = createSupabaseAdminStub({ byUser: true })

    const result = await userOwnsAudit('audit-1', 'user-1', 'owner@example.com')

    expect(result).toBe(true)
    expect(fromMock).toHaveBeenCalledTimes(1)
    expect(executedQueries).toHaveLength(1)
    expect(executedQueries[0]).toMatchObject({
      table: 'diagnostic_audits',
      mode: 'single',
      eq: { id: 'audit-1', user_id: 'user-1' },
    })
  })

  it('normalizes email and returns true when contact_email matches', async () => {
    supabaseAdminMock = createSupabaseAdminStub({ byEmail: true })

    const result = await userOwnsAudit('audit-2', 'user-2', '  OWNER@Example.com ')

    expect(result).toBe(true)
    expect(fromMock).toHaveBeenCalledTimes(2)
    const emailQuery = executedQueries.find(
      (query) => query.table === 'diagnostic_audits' && query.eq.contact_email
    )
    expect(emailQuery?.eq.contact_email).toBe('owner@example.com')
  })

  it('returns false after user check when normalized email is empty', async () => {
    supabaseAdminMock = createSupabaseAdminStub({})

    const result = await userOwnsAudit('audit-3', 'user-3', '   ')

    expect(result).toBe(false)
    expect(fromMock).toHaveBeenCalledTimes(1)
    expect(executedQueries).toHaveLength(1)
    expect(executedQueries[0].eq.user_id).toBe('user-3')
  })

  it('returns true when linked contact submission id owns the audit', async () => {
    supabaseAdminMock = createSupabaseAdminStub({
      byContact: true,
      contactSubmissionIds: [11, 12],
    })

    const result = await userOwnsAudit('audit-4', 'user-4', 'owner@example.com')

    expect(result).toBe(true)
    expect(fromMock).toHaveBeenCalledTimes(4)

    const contactLookup = executedQueries.find(
      (query) => query.table === 'contact_submissions' && query.mode === 'list'
    )
    expect(contactLookup?.eq.email).toBe('owner@example.com')

    const byContactQuery = executedQueries.find(
      (query) => query.in.contact_submission_id !== undefined
    )
    expect(byContactQuery?.in.contact_submission_id).toEqual([11, 12])
  })

  it('returns false when no linked contact submissions are found', async () => {
    supabaseAdminMock = createSupabaseAdminStub({
      contactSubmissionIds: [],
    })

    const result = await userOwnsAudit('audit-5', 'user-5', 'owner@example.com')

    expect(result).toBe(false)
    expect(fromMock).toHaveBeenCalledTimes(3)
    expect(
      executedQueries.some((query) => query.in.contact_submission_id !== undefined)
    ).toBe(false)
  })
})
