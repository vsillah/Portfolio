import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AgentGovernancePage from './page'

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: () => null,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

const governance = {
  generated_at: '2026-05-13T12:00:00.000Z',
  summary: {
    total_agents: 3,
    reviewed_agents: 2,
    planned_agents: 1,
    least_privilege_attention: 1,
    pending_authority_approvals: 1,
    payment_authority_actions: 2,
  },
  capability_profiles: [
    {
      agent_key: 'chief-of-staff',
      display_name: 'Shaka (Zulu) - Chief of Staff',
      pod: 'Command',
      status: 'active',
      primary_runtime: 'portfolio',
      allowed_tools: ['chat', 'war_room'],
      allowed_data_classes: ['agent_ops'],
      allowed_write_classes: ['work_items'],
      outbound_authority: 'draft_only',
      spend_authority: 'none',
      approval_required_for: ['delegate_goal'],
      sensitive_boundaries: ['No autonomous publishing'],
      last_reviewed_at: '2026-05-13T12:00:00.000Z',
      review_status: 'reviewed',
      governance_status: 'green',
    },
    {
      agent_key: 'automation-systems',
      display_name: 'Yaa Asantewaa (Ashanti) - Automation Systems',
      pod: 'Automation',
      status: 'partial',
      primary_runtime: 'n8n',
      allowed_tools: ['n8n'],
      allowed_data_classes: ['agent_ops'],
      allowed_write_classes: ['drafts'],
      outbound_authority: 'approval_required',
      spend_authority: 'approval_required',
      approval_required_for: ['payment_create_refund'],
      sensitive_boundaries: ['Approval before payment action'],
      last_reviewed_at: '2026-05-13T12:00:00.000Z',
      review_status: 'reviewed',
      governance_status: 'yellow',
    },
  ],
  payment_authority_actions: [
    {
      action: 'create_refund',
      approval_type: 'payment_create_refund',
      label: 'Create refund',
      description: 'Refund creation requires approval.',
    },
  ],
  pending_authority_approvals: [
    {
      id: 'approval-1',
      run_id: 'payment-run',
      approval_type: 'payment_create_refund',
      status: 'pending',
      requested_at: '2026-05-13T12:00:00.000Z',
      metadata: {
        authority_packet: {
          label: 'Create refund',
          risk_level: 'high',
          side_effect_boundary: 'No refund is issued until this payment authority checkpoint is approved and linked to a trace.',
          executes_action: false,
        },
      },
    },
  ],
  recent_delegation_decisions: [
    {
      run_id: 'delegation-run',
      selected_agent_key: 'automation-systems',
      selected_agent_name: 'Yaa Asantewaa (Ashanti) - Automation Systems',
      task_type: 'payment',
      risk_class: 'high',
      confidence: 0.9,
      occurred_at: '2026-05-13T12:00:00.000Z',
      reason: 'Payment task requires automation owner.',
      required_evidence: ['approval_record', 'payment_object', 'trace_id'],
      approval_gate: 'payment_create_refund',
      fallback_agent_key: 'chief-of-staff',
      alternatives_considered: [],
    },
  ],
  recent_decision_trust_frames: [
    {
      run_id: 'trust-run',
      decision_id: 'decision-trust-1',
      agent_key: 'chief-of-staff',
      decision_type: 'spend',
      objective: 'Create approval checkpoint for vendor payment.',
      selected_candidate: 'make_vendor_payment',
      candidates_considered: ['make_vendor_payment'],
      trust_signals: ['Agent Ops source run linked', 'Existing agent approval gate selected'],
      risk_signals: ['Payment or spend authority requested'],
      missing_evidence: ['Human approval decision', 'Post-approval execution trace'],
      scores: {
        relationshipTrust: 0.57,
        decisionRisk: 0.62,
        evidenceCompleteness: 0.6,
      },
      recommended_gate: 'human_review',
      approval_type: 'payment_make_vendor_payment',
      reversibility: 'hard',
      occurred_at: '2026-05-13T12:00:00.000Z',
    },
  ],
  recent_governance_exports: [
    {
      id: 'export-1',
      export_type: 'agent_governance_client_audit',
      format: 'markdown',
      classification: 'client_safe',
      run_id: 'delegation-run',
      client_project_id: 'client-456',
      from_at: '2026-05-01T00:00:00.000Z',
      to_at: '2026-05-21T00:00:00.000Z',
      matching_run_count: 1,
      requested_by_user_id: 'user-1',
      generated_at: '2026-05-13T12:00:00.000Z',
      created_at: '2026-05-13T12:00:00.000Z',
    },
  ],
}

describe('AgentGovernancePage', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ governance }),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the full governance controls on the L2 governance page', async () => {
    render(<AgentGovernancePage />)

    const governancePanel = await screen.findByLabelText('Agent Governance')
    expect(governancePanel).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Agent Governance' })).toBeInTheDocument()
    expect(within(governancePanel).getByText('Scope, delegation, spend authority, and audit state for the agentic operating system.')).toBeInTheDocument()
    expect(within(governancePanel).getByText('2/3')).toBeInTheDocument()
    expect(within(governancePanel).getAllByText('Yaa Asantewaa (Ashanti) - Automation Systems').length).toBeGreaterThan(0)
    expect(within(governancePanel).getByText('Spend gated')).toBeInTheDocument()
    expect(within(governancePanel).getByText(/payment · 90% confidence/i)).toBeInTheDocument()
    expect(within(governancePanel).getByText(/Evidence: approval_record, payment_object, trace_id/i)).toBeInTheDocument()
    expect(within(governancePanel).getByText(/Approval: payment_create_refund · Fallback: chief-of-staff/i)).toBeInTheDocument()
    expect(within(governancePanel).getByText('Create refund')).toBeInTheDocument()
    expect(within(governancePanel).getByText('No refund is issued until this payment authority checkpoint is approved and linked to a trace.')).toBeInTheDocument()
    expect(within(governancePanel).getByText(/Risk: high · Executes now: no/i)).toBeInTheDocument()
    const decisionTrust = within(governancePanel).getByLabelText('Decision Trust')
    expect(within(decisionTrust).getByText('make_vendor_payment')).toBeInTheDocument()
    expect(within(decisionTrust).getByText(/spend · Create approval checkpoint for vendor payment/i)).toBeInTheDocument()
    expect(within(decisionTrust).getAllByText('human review').length).toBeGreaterThan(0)
    expect(within(decisionTrust).getByText('Trust')).toBeInTheDocument()
    expect(within(decisionTrust).getByText('57%')).toBeInTheDocument()
    expect(within(decisionTrust).getByText('62%')).toBeInTheDocument()
    expect(within(decisionTrust).getByText('60%')).toBeInTheDocument()
    expect(within(decisionTrust).getByText(/Missing evidence: Human approval decision, Post-approval execution trace/i)).toBeInTheDocument()
    expect(within(decisionTrust).getByText(/Approval: payment_make_vendor_payment · Reversibility: hard/i)).toBeInTheDocument()
    expect(within(decisionTrust).getByRole('link', { name: /make_vendor_payment/i })).toHaveAttribute('href', '/admin/agents/runs/trust-run')
    expect(within(governancePanel).getByRole('link', { name: /Export client audit/i })).toHaveAttribute('href', '/api/admin/agents/governance/export?format=markdown')
    expect(within(governancePanel).getByRole('link', { name: /Export audit JSON/i })).toHaveAttribute('href', '/api/admin/agents/governance/export?format=json')
    expect(within(governancePanel).getByRole('link', { name: /Export latest trace/i })).toHaveAttribute('href', '/api/admin/agents/governance/export?format=markdown&runId=delegation-run')
    expect(within(governancePanel).getByRole('link', { name: /Export authority trace/i })).toHaveAttribute('href', '/api/admin/agents/governance/export?format=markdown&runId=payment-run')

    const exportBuilder = within(governancePanel).getByLabelText('Scoped governance export builder')
    fireEvent.change(within(exportBuilder).getByLabelText('Run ID'), { target: { value: '11111111-1111-4111-8111-111111111111' } })
    fireEvent.change(within(exportBuilder).getByLabelText('Client project ID'), { target: { value: 'client-456' } })
    fireEvent.change(within(exportBuilder).getByLabelText('From'), { target: { value: '2026-05-01' } })
    fireEvent.change(within(exportBuilder).getByLabelText('To'), { target: { value: '2026-05-21' } })
    expect(within(exportBuilder).getByRole('link', { name: /Export scoped audit/i })).toHaveAttribute('href', '/api/admin/agents/governance/export?format=markdown&runId=11111111-1111-4111-8111-111111111111&clientProjectId=client-456&from=2026-05-01&to=2026-05-21')
    expect(within(exportBuilder).getByRole('link', { name: /Export scoped JSON/i })).toHaveAttribute('href', '/api/admin/agents/governance/export?format=json&runId=11111111-1111-4111-8111-111111111111&clientProjectId=client-456&from=2026-05-01&to=2026-05-21')
    fireEvent.change(within(exportBuilder).getByLabelText('From'), { target: { value: '2026-05-22' } })
    expect(within(exportBuilder).getByText('Date range is inverted.')).toBeInTheDocument()
    expect(within(exportBuilder).queryByRole('link', { name: /Export scoped audit/i })).not.toBeInTheDocument()
    fireEvent.click(within(exportBuilder).getByRole('button', { name: 'Reset' }))
    expect(within(exportBuilder).getByLabelText('Run ID')).toHaveValue('')

    const exportLedger = within(governancePanel).getByLabelText('Recent governance exports')
    expect(within(exportLedger).getByText('Client audit')).toBeInTheDocument()
    expect(within(exportLedger).getByText(/client_safe/i)).toBeInTheDocument()
    expect(within(exportLedger).getByText(/Run delegati · Client client-456 · From 2026-05-01 · To 2026-05-21/i)).toBeInTheDocument()
    expect(within(exportLedger).getByRole('link', { name: /Open trace/i })).toHaveAttribute('href', '/admin/agents/runs/delegation-run')

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/agents/mission-control', {
      headers: { Authorization: 'Bearer admin-token' },
    }))
  })

  it('renders a decision trust empty state when no frames exist', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        governance: {
          ...governance,
          recent_decision_trust_frames: [],
        },
      }),
    })

    render(<AgentGovernancePage />)

    const governancePanel = await screen.findByLabelText('Agent Governance')
    const decisionTrust = within(governancePanel).getByLabelText('Decision Trust')
    expect(within(decisionTrust).getByText('shadow mode')).toBeInTheDocument()
    expect(within(decisionTrust).getByText(/No decision trust frames recorded yet/i)).toBeInTheDocument()
  })
})
