import { describe, expect, it, vi } from 'vitest'

vi.mock('./agent-run', () => ({
  startAgentRun: vi.fn(),
  recordAgentEvent: vi.fn(),
  recordAgentStep: vi.fn(),
  attachAgentArtifact: vi.fn(),
  endAgentRun: vi.fn(),
}))

import { buildReadOnlyAgentDispatch } from './agent-engagement'
import { getAgentByKey } from './agent-organization'

describe('agent engagement first tasks', () => {
  it('adds a concrete first task for research source register dispatches', () => {
    const agent = getAgentByKey('research-source-register')
    if (!agent) throw new Error('Missing research-source-register agent')

    const dispatch = buildReadOnlyAgentDispatch(agent, 'Find evidence for the next post.')

    expect(dispatch.firstTask.objective).toContain('source-backed research brief')
    expect(dispatch.firstTask.checklist).toContain(
      'Return a citation-ready source register and flag material requiring approval before public use.',
    )
    expect(dispatch.summaryMarkdown).toContain('### First task')
    expect(dispatch.summaryMarkdown).toContain('### Expected output')
  })

  it('falls back to a safe read-only first task for unmapped templates', () => {
    const agent = getAgentByKey('engineering-copilot')
    if (!agent) throw new Error('Missing engineering-copilot agent')

    const dispatch = buildReadOnlyAgentDispatch(agent, null)

    expect(dispatch.firstTask.objective).toContain('Define the next narrow read-only task')
    expect(dispatch.firstTask.output).toContain('Read-only work brief')
  })
})
