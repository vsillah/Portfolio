import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { requireSourceProtocolBearer } from './source-protocol-auth'

describe('requireSourceProtocolBearer', () => {
  beforeEach(() => {
    process.env.SOURCE_PROTOCOL_INGEST_SECRET = 'source-secret'
  })

  afterEach(() => {
    delete process.env.SOURCE_PROTOCOL_INGEST_SECRET
  })

  it('returns null when the bearer token matches the ingest secret', () => {
    expect(requireSourceProtocolBearer('Bearer source-secret')).toBeNull()
  })

  it('accepts bearer tokens case-insensitively on the scheme prefix', () => {
    expect(requireSourceProtocolBearer('bearer source-secret')).toBeNull()
  })

  it('rejects missing headers', async () => {
    const response = requireSourceProtocolBearer(null)

    expect(response).not.toBeNull()
    expect(response!.status).toBe(401)
    expect(await response!.json()).toEqual({ error: 'Unauthorized' })
  })

  it('rejects wrong tokens and unset secrets', async () => {
    const wrong = requireSourceProtocolBearer('Bearer other')
    expect(wrong!.status).toBe(401)

    delete process.env.SOURCE_PROTOCOL_INGEST_SECRET
    const unset = requireSourceProtocolBearer('Bearer source-secret')
    expect(unset!.status).toBe(401)
    expect(await unset!.json()).toEqual({ error: 'Unauthorized' })
  })
})
