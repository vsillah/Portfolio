import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  buildAgentMissionControlSnapshot: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-mission-control', () => ({
  buildAgentMissionControlSnapshot: mocks.buildAgentMissionControlSnapshot,
}))

import { GET } from './route'

const governance = {
  generated_at: '2026-05-21T00:00:00.000Z',
  summary: {
    total_agents: 1,
    reviewed_agents: 1,
    planned_agents: 0,
    least_privilege_attention: 0,
    pending_authority_approvals: 0,
    payment_authority_actions: 1,
  },
  capability_profiles: [
    {
      agent_key: 'chief-of-staff',
      display_name: 'Shaka (Zulu) - Chief of Staff',
      pod: 'Chief of Staff',
      status: 'active',
      primary_runtime: 'mixed',
      allowed_tools: ['Agent Ops traces'],
      allowed_data_classes: ['agent_ops_traces'],
      allowed_write_classes: ['agent_run_events'],
      outbound_authority: 'draft_only',
      spend_authority: 'none',
      approval_required_for: ['production_config_change'],
      sensitive_boundaries: ['Production config changes require approval.'],
      last_reviewed_at: '2026-05-21',
      review_status: 'reviewed',
      governance_status: 'green',
    },
  ],
  payment_authority_actions: [
    {
      action: 'create_checkout_session',
      approval_type: 'payment_create_checkout_session',
      label: 'Create checkout session',
      description: 'Creating a payment checkout session.',
    },
  ],
  pending_authority_approvals: [],
  recent_delegation_decisions: [],
}

function request(format?: string) {
  const url = new URL('http://localhost/api/admin/agents/governance/export')
  if (format) url.searchParams.set('format', format)
  return new Request(url, {
    headers: { authorization: 'Bearer token' },
  })
}

describe('GET /api/admin/agents/governance/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.buildAgentMissionControlSnapshot.mockResolvedValue({ governance })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.buildAgentMissionControlSnapshot).not.toHaveBeenCalled()
  })

  it('returns a client-safe JSON export by default', async () => {
    const response = await GET(request() as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toMatch(/agent-governance-audit-\d{4}-\d{2}-\d{2}\.json/)
    expect(body.ok).toBe(true)
    expect(body.export.classification).toBe('client_safe')
    expect(body.export.capability_inventory[0].agent).toBe('Shaka (Zulu) - Chief of Staff')
  })

  it('returns markdown when requested', async () => {
    const response = await GET(request('markdown') as never)
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/markdown')
    expect(response.headers.get('Content-Disposition')).toMatch(/agent-governance-audit-\d{4}-\d{2}-\d{2}\.md/)
    expect(text).toContain('# Agentic Operating System Governance Audit')
    expect(text).toContain('## Audit Boundaries')
  })
})
