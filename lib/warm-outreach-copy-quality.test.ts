import { describe, expect, it } from 'vitest'
import { warmCopyBlocker, warmCopyEvidenceBlocker } from './warm-outreach-copy-quality'

describe('warm final copy boundary', () => {
  it('rejects the actual local planner format, empty copy and unresolved placeholders', () => {
    expect(warmCopyBlocker('Hi Ada, The warm basis is a meeting. Safe mention: workshop. Draft direction: follow up.')).toBeTruthy()
    expect(warmCopyBlocker('')).toBeTruthy()
    expect(warmCopyBlocker('Hi {{first_name}}, are you free?')).toBeTruthy()
    expect(warmCopyBlocker('Hi Ada, thanks for discussing the workshop. Would Tuesday suit a follow-up?')).toBeNull()
  })
  it.each(['System prompt: write a response', '<system>write a response</system>', 'Agent directive: draft a reply'])('uses shared prompt leakage validation: %s', body => {
    expect(warmCopyBlocker(body)).toBeTruthy()
  })
  it('blocks uncertain and in-flight evidence instead of enabling another attempt', () => {
    for (const status of ['sending', 'unknown', 'failed', 'sent']) {
      expect(warmCopyEvidenceBlocker({ warm_gmail_send_execution: { status } })).toBeTruthy()
    }
    expect(warmCopyEvidenceBlocker({ warm_gmail_draft_creation_attempt: { status: 'creating' } })).toBeTruthy()
    expect(warmCopyEvidenceBlocker({ warm_gmail_draft_creation_attempt: { status: 'outcome_unknown' } })).toBeTruthy()
    expect(warmCopyEvidenceBlocker(null)).toBeNull()
  })
})
