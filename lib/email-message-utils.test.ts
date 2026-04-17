import { describe, expect, it } from 'vitest'
import { inferTransportFromCommunication, previewFromBody } from '@/lib/email-message-utils'

describe('inferTransportFromCommunication', () => {
  it('uses explicit emailTransport when set', () => {
    expect(
      inferTransportFromCommunication({
        sourceSystem: 'outreach_queue',
        messageType: 'manual',
        emailTransport: 'gmail_smtp',
      }),
    ).toBe('gmail_smtp')
  })

  it('treats outreach_queue + cold as n8n', () => {
    expect(
      inferTransportFromCommunication({
        sourceSystem: 'outreach_queue',
        messageType: 'cold_outreach',
      }),
    ).toBe('n8n')
  })

  it('treats outreach_queue + manual as unknown without override', () => {
    expect(
      inferTransportFromCommunication({
        sourceSystem: 'outreach_queue',
        messageType: 'manual',
      }),
    ).toBe('unknown')
  })

  it('treats delivery_email as gmail_smtp', () => {
    expect(
      inferTransportFromCommunication({ sourceSystem: 'delivery_email' }),
    ).toBe('gmail_smtp')
  })
})

describe('previewFromBody', () => {
  it('strips HTML and truncates', () => {
    const long = '<p>' + 'word '.repeat(200) + '</p>'
    const p = previewFromBody(long, 40)
    expect(p.length).toBeLessThanOrEqual(41)
    expect(p).not.toContain('<p>')
  })
})
