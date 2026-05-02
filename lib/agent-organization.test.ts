import { describe, expect, it } from 'vitest'
import {
  AGENT_ORGANIZATION,
  AGENT_PODS,
  getAgentOrganizationSummary,
  getN8nWorkflowCoverage,
} from './agent-organization'

describe('agent organization registry', () => {
  it('keeps every agent assigned to a known pod', () => {
    const podKeys = new Set(AGENT_PODS.map((pod) => pod.key))

    expect(AGENT_ORGANIZATION.length).toBeGreaterThan(10)
    expect(AGENT_ORGANIZATION.every((agent) => podKeys.has(agent.podKey))).toBe(true)
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
    expect(summary.find((pod) => pod.key === 'strategy_narrative')?.plannedAgentCount).toBe(3)
  })
})
