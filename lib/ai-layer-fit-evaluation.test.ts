import { describe, expect, it } from 'vitest'
import { buildAiLayerFitEvaluation } from './ai-layer-fit-evaluation'
import type { ClientStackSources } from './implementation-feasibility'
import type { TechStackItem } from './tech-stack-lookup'

const tech = (name: string, tag?: string, categories?: string[]): TechStackItem => ({
  name,
  tag,
  categories,
})

describe('buildAiLayerFitEvaluation', () => {
  it('prioritizes embedded platform AI for Microsoft-native workflows', () => {
    const clientStack: ClientStackSources = {
      verified: {
        technologies: [
          tech('Microsoft 365', 'Email'),
          tech('SharePoint', 'Content Management'),
          tech('Microsoft Teams', 'Workflow Automation'),
        ],
      },
    }

    const evaluation = buildAiLayerFitEvaluation({
      clientStack,
      workflowSignals: ['weekly reporting', 'approval workflow', 'Excel trackers', 'Teams notes'],
      dataSensitivity: ['confidential participant data'],
      governanceNotes: ['human approval before external use'],
    })

    expect(evaluation.recommended_layer).toBe('embedded_platform_ai')
    expect(evaluation.decision).toBe('prioritize_for_implementation_planning')
    expect(evaluation.weighted_total).toBeGreaterThanOrEqual(4.2)
    expect(evaluation.candidate_layers.map((c) => c.layer)).toContain('workflow_agent')
    expect(evaluation.open_questions).not.toContain(
      'Which parts of the client stack have been verified by an admin or workflow owner?'
    )
  })

  it('routes CRM-owned workflows to the enterprise data layer', () => {
    const evaluation = buildAiLayerFitEvaluation({
      clientStack: {
        builtwith: {
          technologies: [tech('Salesforce', 'CRM'), tech('Slack', 'Workflow Automation')],
        },
      },
      workflowSignals: ['pipeline updates', 'approval workflow', 'customer records'],
    })

    expect(evaluation.recommended_layer).toBe('enterprise_data_layer')
    expect(evaluation.routing_summary).toMatch(/system that owns/i)
    expect(evaluation.scores.find((s) => s.dimension === 'data_and_context_access')?.score).toBe(5)
  })

  it('falls back to direct model product when stack and workflow are unclear', () => {
    const evaluation = buildAiLayerFitEvaluation({
      clientStack: {},
      workflowSignals: ['drafting'],
    })

    expect(evaluation.recommended_layer).toBe('direct_model_product')
    expect(evaluation.weighted_total).toBeLessThan(4.2)
    expect(evaluation.open_questions).toContain(
      'Which parts of the client stack have been verified by an admin or workflow owner?'
    )
  })
})
