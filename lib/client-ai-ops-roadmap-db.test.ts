import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { ensureRoadmapForProject } from './client-ai-ops-roadmap-db'

type JsonRecord = Record<string, any>

const tableRows: Record<string, JsonRecord[]> = {
  client_projects: [],
  diagnostic_audits: [],
  client_ai_ops_roadmaps: [],
  client_ai_ops_roadmap_phases: [],
  client_ai_ops_roadmap_tasks: [],
  client_ai_ops_roadmap_cost_items: [],
  client_ai_ops_roadmap_reports: [],
}

const tableCounters: Record<string, number> = {}

function resetTables() {
  for (const key of Object.keys(tableRows)) {
    tableRows[key] = []
    tableCounters[key] = 0
  }
}

function nextId(table: string, row: JsonRecord): string {
  if (table === 'client_ai_ops_roadmaps') return 'roadmap-1'
  if (table === 'client_ai_ops_roadmap_phases') return `phase-${row.phase_key}`
  if (table === 'client_ai_ops_roadmap_tasks') return `task-${row.task_key}`
  tableCounters[table] = (tableCounters[table] ?? 0) + 1
  return `${table}-${tableCounters[table]}`
}

class SupabaseQueryStub {
  private operation: 'select' | 'insert' | 'update' = 'select'
  private filters: Array<{ column: string; value: unknown }> = []
  private limitCount: number | null = null
  private singleMode: 'single' | 'maybeSingle' | null = null
  private payload: JsonRecord | JsonRecord[] | null = null
  private patch: JsonRecord | null = null

  constructor(private readonly table: string) {}

  select() {
    this.operation = this.operation === 'insert' ? 'insert' : 'select'
    return this
  }

  insert(payload: JsonRecord | JsonRecord[]) {
    this.operation = 'insert'
    this.payload = payload
    return this
  }

  update(patch: JsonRecord) {
    this.operation = 'update'
    this.patch = patch
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value })
    return this
  }

  order() {
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  maybeSingle() {
    this.singleMode = 'maybeSingle'
    return Promise.resolve(this.execute())
  }

  single() {
    this.singleMode = 'single'
    return Promise.resolve(this.execute())
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected)
  }

  private execute() {
    if (!tableRows[this.table]) {
      throw new Error(`Unexpected supabase table in test: ${this.table}`)
    }

    if (this.operation === 'insert') {
      const rows = (Array.isArray(this.payload) ? this.payload : [this.payload])
        .filter(Boolean)
        .map((row) => {
          const inserted = { ...row } as JsonRecord
          inserted.id = inserted.id ?? nextId(this.table, inserted)
          tableRows[this.table].push(inserted)
          return inserted
        })

      return {
        data: this.singleMode ? rows[0] ?? null : rows,
        error: null,
      }
    }

    if (this.operation === 'update') {
      const rows = this.matchRows()
      for (const row of rows) {
        Object.assign(row, this.patch)
      }
      return { data: rows, error: null }
    }

    const rows = this.matchRows()
    const limited = this.limitCount == null ? rows : rows.slice(0, this.limitCount)
    if (this.singleMode === 'single') {
      return limited[0]
        ? { data: limited[0], error: null }
        : { data: null, error: { message: 'No rows found' } }
    }
    if (this.singleMode === 'maybeSingle') {
      return { data: limited[0] ?? null, error: null }
    }
    return { data: limited, error: null }
  }

  private matchRows(): JsonRecord[] {
    return tableRows[this.table].filter((row) => (
      this.filters.every((filter) => row[filter.column] === filter.value)
    ))
  }
}

describe('client AI ops roadmap persistence', () => {
  beforeEach(() => {
    resetTables()
    mocks.from.mockImplementation((table: string) => new SupabaseQueryStub(table))
  })

  it('persists the Open Brain service profile and task metadata from project context', async () => {
    tableRows.client_projects.push({
      id: 'project-mentorri',
      project_name: 'MentorRI Open Brain Console',
      client_name: 'Janine Achen',
      client_company: 'Mentor Rhode Island',
      client_email: 'janine@example.org',
      contact_submission_id: null,
      proposal_id: 'proposal-1',
      product_purchased: 'Client AI Ops / white-label Open Brain',
    })

    const bundle = await ensureRoadmapForProject('project-mentorri', {
      generatedFrom: 'proposal_acceptance',
      userId: 'admin-1',
    })

    const roadmap = tableRows.client_ai_ops_roadmaps[0]
    expect(roadmap).toMatchObject({
      client_project_id: 'project-mentorri',
      proposal_id: 'proposal-1',
      generated_from: 'proposal_acceptance',
      created_by: 'admin-1',
    })
    expect(roadmap.snapshot.service_profile).toMatchObject({
      key: 'open_brain_companion_app',
      label: 'MentorRI Open Brain Console',
      clientOwner: 'Janine Achen',
      status: 'staging_ready',
    })

    const taskKeys = tableRows.client_ai_ops_roadmap_tasks.map((task) => task.task_key)
    expect(taskKeys).toEqual(expect.arrayContaining([
      'open-brain-source-crosswalk',
      'protected-companion-app',
      'crm-readonly-context',
      'portfolio-client-projection',
    ]))

    const protectedAppTask = tableRows.client_ai_ops_roadmap_tasks.find((task) => (
      task.task_key === 'protected-companion-app'
    ))
    expect(protectedAppTask?.metadata).toMatchObject({
      org_board: {
        approval_posture: 'required',
        isolation_required: true,
        client_visible_label: 'Prepare protected app',
      },
    })

    expect(tableRows.client_ai_ops_roadmap_cost_items.map((item) => item.label)).toEqual(expect.arrayContaining([
      'Protected companion app hosting',
      'Open Brain data plane',
      'CRM read-only context intake',
    ]))
    expect(bundle.clientView.serviceProfile).toMatchObject({
      key: 'open_brain_companion_app',
      label: 'MentorRI Open Brain Console',
    })
    expect(bundle.clientView.projectionStatus.approvalNeededCount).toBeGreaterThanOrEqual(2)
    expect(bundle.clientView.connectorReadiness.items.map((item) => item.key)).toEqual(expect.arrayContaining([
      'wordpress',
      'bonterra_network_for_good',
      'supabase_vector',
    ]))
  })
})
