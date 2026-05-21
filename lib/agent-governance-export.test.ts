import { describe, expect, it } from 'vitest'
import { buildAgentGovernanceClientExport, formatAgentGovernanceClientMarkdown } from './agent-governance-export'
import type { AgentGovernanceSnapshot } from './agent-governance'

const governance = {
  generated_at: '2026-05-21T00:00:00.000Z',
  summary: {
    total_agents: 2,
    reviewed_agents: 2,
    planned_agents: 0,
    least_privilege_attention: 1,
    pending_authority_approvals: 1,
    payment_authority_actions: 1,
  },
  capability_profiles: [
    {
      agent_key: 'chief-of-staff',
      display_name: 'Shaka (Zulu) - Chief of Staff',
      pod: 'Chief of Staff',
      status: 'active',
      primary_runtime: 'mixed',
      allowed_tools: ['Agent Ops traces', 'Mission Control context'],
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
    {
      agent_key: 'automation-systems',
      display_name: 'Yaa Asantewaa (Ashanti) - Automation Systems',
      pod: 'Product & Automation Pod',
      status: 'active',
      primary_runtime: 'n8n',
      allowed_tools: ['n8n workflow hooks'],
      allowed_data_classes: ['workflow_config'],
      allowed_write_classes: ['known_workflow_records'],
      outbound_authority: 'known_workflow',
      spend_authority: 'approval_required',
      approval_required_for: ['create_refund'],
      sensitive_boundaries: ['Payment actions require approval.'],
      last_reviewed_at: '2026-05-21',
      review_status: 'reviewed',
      governance_status: 'yellow',
    },
  ],
  payment_authority_actions: [
    {
      action: 'create_refund',
      approval_type: 'payment_create_refund',
      label: 'Create refund',
      description: 'Creating a refund that returns funds to a customer.',
    },
  ],
  pending_authority_approvals: [
    {
      run_id: 'run-payment',
      approval_type: 'payment_create_refund',
      status: 'pending',
      requested_at: '2026-05-21T00:01:00.000Z',
    },
  ],
  recent_delegation_decisions: [
    {
      run_id: 'run-delegation',
      selected_agent_key: 'automation-systems',
      selected_agent_name: 'Yaa Asantewaa (Ashanti) - Automation Systems',
      task_type: 'payment',
      risk_class: 'payment_spend',
      confidence: 0.9,
      occurred_at: '2026-05-21T00:02:00.000Z',
      reason: 'Payment work routes to automation systems.',
    },
  ],
} satisfies AgentGovernanceSnapshot

describe('agent governance client export', () => {
  it('creates a client-safe export without raw governance metadata', () => {
    const clientExport = buildAgentGovernanceClientExport(governance)

    expect(clientExport.classification).toBe('client_safe')
    expect(clientExport.scope.description).toBe('Current governance snapshot.')
    expect(clientExport.summary.pending_authority_approvals).toBe(1)
    expect(clientExport.capability_inventory[1]).toMatchObject({
      agent: 'Yaa Asantewaa (Ashanti) - Automation Systems',
      spend_authority: 'approval_required',
    })
    expect(clientExport.delegation_trace[0]).toMatchObject({
      trace_reference: 'run-delegation',
      confidence: '90%',
    })
    expect(JSON.stringify(clientExport)).not.toContain('selected_agent_key')
    expect(clientExport.audit_boundaries.join(' ')).toContain('excludes raw prompts')
  })

  it('formats the export as client-readable markdown', () => {
    const markdown = formatAgentGovernanceClientMarkdown(buildAgentGovernanceClientExport(governance))

    expect(markdown).toContain('# Agentic Operating System Governance Audit')
    expect(markdown).toContain('## Export Scope')
    expect(markdown).toContain('- Run ID: All visible governance runs')
    expect(markdown).toContain('## Capability Inventory')
    expect(markdown).toContain('| Yaa Asantewaa (Ashanti) - Automation Systems | active | n8n | yellow | approval_required | known_workflow |')
    expect(markdown).toContain('| run-delegation | Yaa Asantewaa (Ashanti) - Automation Systems | payment | payment_spend | 90% |')
    expect(markdown).toContain('Payment and paid-job actions are represented as approval gates')
  })

  it('includes run, client, and date scope in exports', () => {
    const clientExport = buildAgentGovernanceClientExport(governance, {
      run_id: 'run-delegation',
      client_project_id: 'client-123',
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-21T23:59:59.999Z',
      matching_run_count: 1,
    })
    const markdown = formatAgentGovernanceClientMarkdown(clientExport)

    expect(clientExport.scope).toMatchObject({
      description: 'Scoped governance export.',
      run_id: 'run-delegation',
      client_project_id: 'client-123',
      matching_run_count: 1,
    })
    expect(markdown).toContain('- Run ID: run-delegation')
    expect(markdown).toContain('- Client project ID: client-123')
    expect(markdown).toContain('- Matching runs: 1')
  })
})
