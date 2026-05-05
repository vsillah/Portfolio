import { describe, expect, it } from 'vitest'

import { buildClientConnectorReadiness } from './client-connector-readiness'

describe('buildClientConnectorReadiness', () => {
  it('maps audit stack and readiness fields into connector requirements', () => {
    const readiness = buildClientConnectorReadiness({
      auditSignals: [
        {
          id: 'audit-1',
          audit_type: 'standalone',
          tech_stack: {
            crm: 'hubspot',
            email: 'gmail',
            marketing: 'mailchimp',
            analytics: 'ga',
            other_tools: ['Slack', 'Notion'],
            website_technologies: ['Webflow'],
            integration_readiness: 'some_apis',
          },
          automation_needs: { priority_areas: ['lead_follow_up', 'reporting'] },
          ai_readiness: { data_quality: 'integrated', previous_ai_experience: 'team_tools' },
          budget_timeline: { budget_range: 'medium' },
          decision_making: { decision_maker: true, approval_process: 'solo' },
          enriched_tech_stack: { technologies: [{ name: 'Pinecone' }] },
        },
      ],
    })

    expect(readiness.items.map((item) => item.key)).toEqual(expect.arrayContaining([
      'webflow',
      'hubspot',
      'google_workspace',
      'mailchimp',
      'google_analytics',
      'slack',
      'notion',
      'pinecone',
    ]))
    expect(readiness.requiredConnectorCount).toBeGreaterThanOrEqual(8)
    expect(readiness.connectorNextAction).toContain('setup packet')
  })

  it('uses verified stack ahead of audit and BuiltWith for the same category', () => {
    const readiness = buildClientConnectorReadiness({
      verifiedStack: { technologies: [{ name: 'Salesforce' }] },
      auditSignals: [{ id: 'audit-1', tech_stack: { crm: 'hubspot' } }],
      builtWithStack: { technologies: [{ name: 'Pipedrive' }] },
    })

    const crm = readiness.items.find((item) => item.category === 'crm')
    expect(crm).toMatchObject({
      key: 'salesforce',
      source: 'verified',
    })
  })

  it('flags same-tier audit conflicts for review', () => {
    const readiness = buildClientConnectorReadiness({
      auditSignals: [
        { id: 'audit-1', tech_stack: { crm: 'hubspot' } },
        { id: 'audit-2', tech_stack: { crm: 'salesforce' } },
      ],
    })

    expect(readiness.conflicts).toEqual([
      expect.objectContaining({
        category: 'crm',
        providers: expect.arrayContaining(['HubSpot', 'Salesforce']),
      }),
    ])
    expect(readiness.items.find((item) => item.category === 'crm')).toMatchObject({
      status: 'review',
    })
  })

  it('routes connector setup through approval when audit decision authority is blocked', () => {
    const readiness = buildClientConnectorReadiness({
      auditSignals: [
        {
          id: 'audit-1',
          tech_stack: { crm: 'hubspot', email: 'gmail' },
          decision_making: { decision_maker: false, approval_process: 'committee' },
        },
      ],
    })

    expect(readiness.approvalBlockedConnectorCount).toBeGreaterThan(0)
    expect(readiness.items.filter((item) => item.status === 'approval_blocked').map((item) => item.key)).toEqual(
      expect.arrayContaining(['hubspot', 'google_workspace']),
    )
  })

  it('treats local device and cloud runtime placement as connector readiness decisions', () => {
    const readiness = buildClientConnectorReadiness({
      roadmapTasks: [
        {
          task_key: 'hardware-decision',
          title: 'Select Mac mini, PC equivalent, or cloud fallback for 24/7 access',
          metadata: {},
        },
      ],
    })

    const runtime = readiness.items.find((item) => item.category === 'runtime_hosting')
    expect(runtime).toMatchObject({
      category: 'runtime_hosting',
      status: 'review',
    })
    expect(readiness.conflicts[0]).toMatchObject({
      category: 'runtime_hosting',
      providers: expect.arrayContaining(['Client Mac mini node', 'Client PC node', 'Cloud runtime host']),
    })
    expect(runtime?.nextAction).toContain('Resolve conflicting Runtime/hosting signals')
  })
})
