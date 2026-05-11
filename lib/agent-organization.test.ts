import { describe, expect, it } from 'vitest'
import {
  AGENT_ORGANIZATION,
  AGENT_PODS,
  getAgentByKey,
  getAgentOrganizationSummary,
  getN8nWorkflowCoverage,
} from './agent-organization'

describe('agent organization registry', () => {
  it('keeps every agent assigned to a known pod', () => {
    const podKeys = new Set(AGENT_PODS.map((pod) => pod.key))

    expect(AGENT_ORGANIZATION.length).toBeGreaterThan(10)
    expect(AGENT_ORGANIZATION.every((agent) => podKeys.has(agent.podKey))).toBe(true)
  })

  it('uses African warrior and royalty display identities while keeping stable keys', () => {
    expect(getAgentByKey('chief-of-staff')).toMatchObject({
      key: 'chief-of-staff',
      name: 'Shaka (Zulu) - Chief of Staff',
    })
    expect(AGENT_ORGANIZATION.every((agent) => agent.name.includes(' - '))).toBe(true)
    expect(AGENT_ORGANIZATION.some((agent) => agent.name === 'Chief of Staff Agent')).toBe(false)
  })

  it('maps active n8n workflows into the operating model', () => {
    const coverage = getN8nWorkflowCoverage()

    expect(coverage.length).toBeGreaterThan(50)
    expect(coverage.some((workflow) => workflow.name === 'WF-AGENT-OPS: Morning Review')).toBe(true)
    expect(coverage.some((workflow) => workflow.name === 'WF-VEP-002: Social Listening Pipeline')).toBe(true)
    expect(coverage.some((workflow) => workflow.name === 'WF-GDR: Gmail Draft Reply')).toBe(true)
  })

  it('summarizes pods with agent and workflow counts', () => {
    const summary = getAgentOrganizationSummary()

    expect(summary).toHaveLength(6)
    expect(summary.find((pod) => pod.key === 'product_automation')?.activeWorkflowCount).toBeGreaterThan(10)
    expect(summary.find((pod) => pod.key === 'publishing_follow_up')).toMatchObject({
      agentCount: 4,
      activeAgentCount: 3,
      activeWorkflowCount: 29,
    })
    expect(summary.find((pod) => pod.key === 'strategy_narrative')?.plannedAgentCount).toBe(3)
  })

  it('splits overloaded publishing and follow-up work into narrow agents', () => {
    const inbox = getAgentByKey('inbox-follow-up')
    const warmLead = getAgentByKey('warm-lead-capture')
    const meeting = getAgentByKey('meeting-intake-follow-up')

    expect(inbox?.responsibility).toContain('cold outreach sends')
    expect(inbox?.n8nWorkflows.map((workflow) => workflow.name)).toEqual(expect.arrayContaining([
      'WF-CLG-003: Send and Follow-Up',
      'WF-GDR: Gmail Draft Reply',
      'WF-LMN-001: Ebook Nurture Sequence',
    ]))
    expect(inbox?.n8nWorkflows.some((workflow) => workflow.name.includes('Warm Lead Scraper'))).toBe(false)
    expect(inbox?.n8nWorkflows.some((workflow) => workflow.name.includes('Meeting'))).toBe(false)

    expect(warmLead).toMatchObject({
      name: 'Behanzin (Dahomey) - Warm Lead Capture',
      podKey: 'publishing_follow_up',
      status: 'active',
      primaryRuntime: 'n8n',
    })
    expect(warmLead?.n8nWorkflows.map((workflow) => workflow.name)).toEqual(expect.arrayContaining([
      'WF-WRM-001: Facebook Warm Lead Scraper',
      'WF-WRM-002: Google Contacts Sync',
      'WF-WRM-003: LinkedIn Warm Lead Scraper',
    ]))

    expect(meeting).toMatchObject({
      name: 'Amanirenas (Kush) - Meeting Intake & Follow-Up',
      podKey: 'publishing_follow_up',
      status: 'active',
      primaryRuntime: 'n8n',
    })
    expect(meeting?.n8nWorkflows.map((workflow) => workflow.name)).toEqual(expect.arrayContaining([
      'WF-SLK: Slack Meeting Intake',
      'WF-CAL: Calendly Webhook Router',
      'WF-MCH: Meeting Complete Handler',
      'WF-FUP: Follow-Up Meeting Scheduler',
    ]))
    expect(meeting?.approvalGate).toContain('agenda emails')
  })

  it('assigns governed RAG ownership and approval gates to the Research & Knowledge pod', () => {
    const librarian = getAgentByKey('private-knowledge-librarian')
    const sourceRegister = getAgentByKey('research-source-register')

    expect(librarian?.responsibility).toContain('metadata completeness')
    expect(librarian?.responsibility).toContain('privacy checks')
    expect(librarian?.approvalGate).toContain('Production cutover')
    expect(librarian?.approvalGate).toContain('public chatbot/RAG policy changes')
    expect(sourceRegister?.approvalGate).toContain('unclassified material')
  })

  it('adds a narrow AI risk and compliance owner without taking over source intake', () => {
    const riskAgent = getAgentByKey('risk-compliance-intelligence')
    const sourceRegister = getAgentByKey('research-source-register')

    expect(riskAgent).toMatchObject({
      name: 'Moremi (Ife) - Risk & Compliance',
      podKey: 'research_knowledge',
      status: 'partial',
      primaryRuntime: 'mixed',
      n8nWorkflows: [],
    })
    expect(riskAgent?.responsibility).toContain('map them to Portfolio exposure')
    expect(riskAgent?.responsibility).toContain('open upgrade requests')
    expect(riskAgent?.approvalGate).toContain('Read-only exposure assessment')
    expect(sourceRegister?.responsibility).toContain('Collect and classify source-backed evidence')
  })
})
