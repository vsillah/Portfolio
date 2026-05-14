import { describe, expect, it } from 'vitest'
import { AGENT_ORGANIZATION } from '@/lib/agent-organization'
import { AGENT_AVATARS, getMissingAgentAvatarKeys } from '@/lib/agent-avatars'

describe('agent avatar manifest', () => {
  it('covers every stable agent organization key', () => {
    expect(getMissingAgentAvatarKeys()).toEqual([])
  })

  it('provides accessible labels for every organization avatar', () => {
    for (const agent of AGENT_ORGANIZATION) {
      expect(AGENT_AVATARS[agent.key]?.label).toContain('Illustrated avatar')
      expect(AGENT_AVATARS[agent.key]?.initials.length).toBeGreaterThan(1)
    }
  })
})
