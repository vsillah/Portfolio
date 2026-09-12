import { describe, expect, it } from 'vitest'
import { normalizeSmsPhone } from './contact-sms-consent'
import { buildContactSmsEvidence } from './contact-sms-evidence'
describe('SMS format and evidence identity', () => {
  it.each(['2025550123', '1 202 555 0123', '+1 (202) 555-0123'])('normalizes %s', (phone) => expect(normalizeSmsPhone(phone)).toBe('+12025550123'))
  it('accepts international E.164 format without claiming ownership', () => expect(normalizeSmsPhone('+44 7700 900123')).toBe('+447700900123'))
  it('gives separate unverified email assertions distinct evidence identities', () => {
    const input = { email: 'a@example.test', phone: '+12025550123', submittedPhone: '+12025550123', inquiryId: 1 }
    const first = buildContactSmsEvidence(input)
    expect(buildContactSmsEvidence({ ...input, email: ' A@EXAMPLE.TEST ', inquiryId: 2 }).evidence_key).toBe(first.evidence_key)
    expect(buildContactSmsEvidence({ ...input, email: 'b@example.test' }).evidence_key).not.toBe(first.evidence_key)
  })
})
