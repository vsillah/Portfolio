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

type JsonRecord = Record<string, unknown>
type QueryMode = 'single' | 'maybeSingle' | 'many'
type QueryResult = { data: unknown; error: null | { message: string } }

type FakeDbState = {
  project: JsonRecord
  roadmap: JsonRecord | null
  phases: JsonRecord[]
  tasks: JsonRecord[]
  costItems: JsonRecord[]
  insertedRoadmap: JsonRecord | null
  selectCalls: Array<{ table: string; columns?: string }>
}

function createFakeDbState(): FakeDbState {
  return {
    project: {
      id: 'project-1',
      project_name: 'Implementation kickoff',
      client_name: 'Dana',
      client_company: 'North Star Youth',
      client_email: 'dana@example.com',
      contact_submission_id: null,
      proposal_id: 'proposal-1',
      product_purchased: 'White-label Open Brain companion app',
    },
    roadmap: null,
    phases: [],
    tasks: [],
    costItems: [],
    insertedRoadmap: null,
    selectCalls: [],
  }
}

function createQuery(table: string, state: FakeDbState) {
  const filters: Array<{ column: string; value: unknown }> = []
  let operation: 'select' | 'insert' | 'update' = 'select'
  let payload: unknown
  let selectedColumns: string | undefined

  const query: Record<string, unknown> = {
    select: vi.fn((columns?: string) => {
      selectedColumns = columns
      state.selectCalls.push({ table, columns })
      return query
    }),
    eq: vi.fn((column: string, value: unknown) => {
      filters.push({ column, value })
      return query
    }),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(() => Promise.resolve(resolveQueryResult(table, state, operation, payload, filters, 'maybeSingle'))),
    single: vi.fn(() => Promise.resolve(resolveQueryResult(table, state, operation, payload, filters, 'single'))),
    insert: vi.fn((insertPayload: unknown) => {
      operation = 'insert'
      payload = insertPayload
      return query
    }),
    update: vi.fn((updatePayload: unknown) => {
      operation = 'update'
      payload = updatePayload
      return query
    }),
    then: (
      onFulfilled?: (value: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise
      .resolve(resolveQueryResult(table, state, operation, payload, filters, 'many', selectedColumns))
      .then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise
      .resolve(resolveQueryResult(table, state, operation, payload, filters, 'many', selectedColumns))
      .catch(onRejected),
  }

  return query
}

function resolveQueryResult(
  table: string,
  state: FakeDbState,
  operation: 'select' | 'insert' | 'update',
  payload: unknown,
  filters: Array<{ column: string; value: unknown }>,
  mode: QueryMode,
  selectedColumns?: string,
): QueryResult {
  if (table === 'client_projects') {
    return { data: state.project, error: null }
  }

  if (table === 'client_ai_ops_roadmaps') {
    if (operation === 'insert') {
      const insert = payload as JsonRecord
      state.insertedRoadmap = insert
      state.roadmap = {
        id: 'roadmap-1',
        created_at: '2026-05-30T10:00:00.000Z',
        updated_at: '2026-05-30T10:00:00.000Z',
        ...insert,
      }
      return { data: state.roadmap, error: null }
    }

    if (operation === 'update') {
      state.roadmap = {
        ...(state.roadmap ?? {}),
        ...(payload as JsonRecord),
      }
      return { data: null, error: null }
    }

    return { data: mode === 'maybeSingle' ? state.roadmap : state.roadmap ? [state.roadmap] : [], error: null }
  }

  if (table === 'client_ai_ops_roadmap_phases') {
    if (operation === 'insert') {
      state.phases = (payload as JsonRecord[]).map((phase, index) => ({
        id: `phase-${index + 1}`,
        ...phase,
      }))
      return { data: state.phases, error: null }
    }

    if (operation === 'update') {
      const phaseId = filters.find((filter) => filter.column === 'id')?.value
      state.phases = state.phases.map((phase) => (
        phase.id === phaseId ? { ...phase, ...(payload as JsonRecord) } : phase
      ))
      return { data: null, error: null }
    }

    if (selectedColumns === 'id') {
      return { data: state.phases.map((phase) => ({ id: phase.id })), error: null }
    }
    return { data: state.phases, error: null }
  }

  if (table === 'client_ai_ops_roadmap_tasks') {
    if (operation === 'insert') {
      state.tasks = (payload as JsonRecord[]).map((task, index) => ({
        id: `task-${index + 1}`,
        ...task,
      }))
      return { data: state.tasks, error: null }
    }

    if (operation === 'update') {
      const taskId = filters.find((filter) => filter.column === 'id')?.value
      state.tasks = state.tasks.map((task) => (
        task.id === taskId ? { ...task, ...(payload as JsonRecord) } : task
      ))
      return { data: null, error: null }
    }

    const phaseId = filters.find((filter) => filter.column === 'phase_id')?.value
    const tasks = phaseId ? state.tasks.filter((task) => task.phase_id === phaseId) : state.tasks
    return { data: selectedColumns === 'status' ? tasks.map((task) => ({ status: task.status })) : tasks, error: null }
  }

  if (table === 'client_ai_ops_roadmap_cost_items') {
    if (operation === 'insert') {
      state.costItems = (payload as JsonRecord[]).map((item, index) => ({
        id: `cost-${index + 1}`,
        ...item,
      }))
      return { data: state.costItems, error: null }
    }

    return { data: state.costItems, error: null }
  }

  if (table === 'client_ai_ops_roadmap_reports') {
    return { data: [], error: null }
  }

  if (table === 'diagnostic_audits') {
    return { data: [], error: null }
  }

  return { data: null, error: { message: `Unexpected table ${table}` } }
}

describe('ensureRoadmapForProject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('persists an inferred Open Brain service profile from product_purchased into the roadmap snapshot', async () => {
    const state = createFakeDbState()
    mocks.from.mockImplementation((table: string) => createQuery(table, state))

    const bundle = await ensureRoadmapForProject('project-1', {
      generatedFrom: 'proposal_acceptance',
      userId: 'admin-1',
    })

    expect(state.selectCalls).toContainEqual(expect.objectContaining({
      table: 'client_projects',
      columns: expect.stringContaining('product_purchased'),
    }))
    expect(state.insertedRoadmap?.snapshot).toMatchObject({
      service_profile: {
        key: 'open_brain_companion_app',
        label: 'North Star Youth Open Brain Console',
        componentLabel: 'Client AI Ops / white-label Open Brain',
        status: 'needs_client_setup',
      },
    })
    expect(state.tasks.map((task) => task.task_key)).toEqual(expect.arrayContaining([
      'open-brain-source-crosswalk',
      'protected-companion-app',
      'portfolio-client-projection',
    ]))
    expect(bundle.clientView.serviceProfile).toMatchObject({
      key: 'open_brain_companion_app',
      label: 'North Star Youth Open Brain Console',
      clientOwner: 'Dana',
    })
  })
})
