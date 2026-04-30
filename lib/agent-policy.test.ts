import { describe, expect, it } from 'vitest'
import { actionRequiresApproval, getApprovalGate, getRuntimePolicy } from './agent-policy'

describe('agent runtime policies', () => {
  it('keeps Hermes read-only without approval', () => {
    const policy = getRuntimePolicy('hermes')

    expect(policy.canReadFiles).toBe(true)
    expect(policy.canWriteFiles).toBe(false)
    expect(policy.canWriteProductionData).toBe('none')
    expect(actionRequiresApproval('hermes', 'write_files')).toBe(true)
    expect(actionRequiresApproval('hermes', 'client_data_access')).toBe(true)
  })

  it('requires approval for public publishing and email gates', () => {
    expect(getApprovalGate('publish_public_content')?.approvalType).toBe('publishing')
    expect(getApprovalGate('send_email')?.approvalType).toBe('send_email')
    expect(actionRequiresApproval('n8n', 'publish_public_content')).toBe(true)
    expect(actionRequiresApproval('n8n', 'send_email')).toBe(true)
  })
})
