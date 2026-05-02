import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: null,
}))

vi.mock('@/lib/agent-ops-morning-review', () => ({
  runAgentOpsMorningReview: vi.fn(),
}))

import { agentSlackCommandInternals } from '@/lib/agent-slack-command'

describe('agent Slack command parsing', () => {
  it('maps supported aliases to command handlers', () => {
    expect(agentSlackCommandInternals.commandFromText('status')).toBe('status')
    expect(agentSlackCommandInternals.commandFromText('failed')).toBe('failed')
    expect(agentSlackCommandInternals.commandFromText('failures')).toBe('failed')
    expect(agentSlackCommandInternals.commandFromText('approval')).toBe('approvals')
    expect(agentSlackCommandInternals.commandFromText('approvals')).toBe('approvals')
    expect(agentSlackCommandInternals.commandFromText('morning-review')).toBe('morning-review')
    expect(agentSlackCommandInternals.commandFromText('morning')).toBe('morning-review')
  })

  it('falls back to help for empty or unknown commands', () => {
    expect(agentSlackCommandInternals.commandFromText('')).toBe('help')
    expect(agentSlackCommandInternals.commandFromText('unknown')).toBe('help')
    expect(agentSlackCommandInternals.formatHelp()).toContain('/agent status')
  })
})
