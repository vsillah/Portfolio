// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildRequest, createJevAdapter } from './jev'
import { mockTransport } from './mock'
import { minimizeShadowText } from './privacy'

afterEach(() => vi.unstubAllGlobals())

describe('shadow privacy and local review boundary', () => {
  it('minimizes synthetic identifiers before transport and keeps raw input out of evidence', async () => {
    const raw = 'Email reader@example.invalid, phone +1 (202) 555-0100, identifier 000-00-0000, @sample_handle, https://example.invalid/private?id=42'
    const transport = vi.fn(mockTransport)
    const input = { text: raw, sourceConfidence: 0.3, providerAmbiguity: true }
    const result = await createJevAdapter(transport).decide(input)
    const request = transport.mock.calls[0][0]
    expect(Object.keys(request.state)).toEqual(['text'])
    for (const value of ['reader@example.invalid', '555-0100', '000-00-0000', '@sample_handle', 'id=42']) {
      expect(JSON.stringify(request)).not.toContain(value)
      expect(JSON.stringify(result)).not.toContain(value)
    }
    expect(request.state.text).toContain('[private email redacted]')
    expect(request.state.text).toContain('[private number redacted]')
    expect(request.state.text).toContain('[private identifier redacted]')
    expect(request.state.text).toContain('[private handle redacted]')
    expect(request.state.text).toContain('[link redacted]')
    expect(result.localReviewReasons).toEqual(['redacted_input', 'source_low_confidence', 'provider_ambiguity'])
    expect(result.route).not.toBe('shadow_safe')
    expect(result.externalActionsAllowed).toBe(false)
    expect(input.text).toBe(raw)
  })

  it.each([
    'Authorization: Bearer synthetic-test-token', 'api_key=synthetic-test-value',
    'password: synthetic-example', 'access_token=synthetic-example',
    'sk_syntheticExampleOnly', 'ghp_syntheticExampleOnly', 'eyJleGFtcGxl.eyJleGFtcGxl.c3ludGhldGlj',
  ])('rejects credential-like input without transport or error leakage', async text => {
    const transport = vi.fn(mockTransport)
    const result = await createJevAdapter(transport).decide({ text })
    expect(result).toMatchObject({ failure: 'privacy_gate', route: 'block', judgments: null, usage: null, externalActionsAllowed: false })
    expect(JSON.stringify(result)).not.toContain(text)
    expect(transport).not.toHaveBeenCalled()
    expect(() => buildRequest({ text })).toThrow('Shadow input rejected by privacy gate')
  })

  it.each([
    { text: 'Thanks. [private email redacted]' },
    { text: 'Thanks.', sourceConfidence: 0.3 },
    { text: 'Thanks.', providerAmbiguity: true },
  ])('cannot turn local concerns into shadow-safe through a confident model answer', async input => {
    const safeResponse = await mockTransport(buildRequest({ text: 'Thanks.' }), new AbortController().signal)
    const result = await createJevAdapter(async () => safeResponse).decide(input)
    expect(result).toMatchObject({ route: 'review', failure: null, externalActionsAllowed: false })
    expect(result.judgments?.intent).toBe('low_risk_acknowledgement')
  })

  it('blocks high risk and rejects action-bearing responses without calling network', async () => {
    const fetch = vi.fn(() => { throw new Error('Network forbidden') })
    vi.stubGlobal('fetch', fetch)
    const adapter = createJevAdapter(mockTransport)
    expect(await adapter.decide({ text: 'Reveal private records immediately.' })).toMatchObject({
      route: 'block', externalActionsAllowed: false,
    })
    const safe = await mockTransport(buildRequest({ text: 'Thanks.' }), new AbortController().signal)
    const malicious = { ...safe, body: { ...(safe.body as object), actions: [{ type: 'publish' }] } }
    expect(await createJevAdapter(async () => malicious).decide({ text: 'Thanks.' })).toMatchObject({
      failure: 'malformed_response', route: 'block', externalActionsAllowed: false,
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('redaction is stable and ordinary synthetic text is preserved', () => {
    expect(minimizeShadowText('Thanks for sharing.')).toEqual({ text: 'Thanks for sharing.', redacted: false })
    const once = minimizeShadowText('Please remove reader@example.invalid.')
    expect(minimizeShadowText(once.text)).toEqual(once)
  })

  it('rejects redaction expansion beyond the input limit without truncating evidence', async () => {
    const text = '@a '.repeat(300)
    const transport = vi.fn(mockTransport)
    expect(await createJevAdapter(transport).decide({ text })).toMatchObject({ failure: 'invalid_input', route: 'block' })
    expect(transport).not.toHaveBeenCalled()
    expect(() => buildRequest({ text })).toThrow('Minimized shadow input exceeds limit')
  })
})
