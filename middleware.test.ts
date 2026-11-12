import { afterEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { config, middleware } from './middleware'

const originalCurrent = process.env.N8N_INGEST_SECRET
const originalNext = process.env.N8N_INGEST_SECRET_NEXT

afterEach(() => {
  if (originalCurrent === undefined) delete process.env.N8N_INGEST_SECRET
  else process.env.N8N_INGEST_SECRET = originalCurrent
  if (originalNext === undefined) delete process.env.N8N_INGEST_SECRET_NEXT
  else process.env.N8N_INGEST_SECRET_NEXT = originalNext
})

function request(path: string, authorization?: string, origin?: string) {
  return new NextRequest(`https://amadutown.com${path}`, {
    method: 'POST',
    headers: {
      ...(authorization ? { authorization } : {}),
      ...(origin ? { origin } : {}),
    },
  })
}

describe('temporary n8n ingest secret transition', () => {
  it('passes the next token to existing route authorization as the current token', async () => {
    process.env.N8N_INGEST_SECRET = 'old-token'
    process.env.N8N_INGEST_SECRET_NEXT = 'new-token'

    const response = await middleware(request('/api/admin/outreach/ingest', 'Bearer new-token'))

    expect(response.headers.get('x-middleware-request-authorization')).toBe('Bearer old-token')
  })

  it('leaves other bearer tokens untouched', async () => {
    process.env.N8N_INGEST_SECRET = 'old-token'
    process.env.N8N_INGEST_SECRET_NEXT = 'new-token'

    const response = await middleware(request('/api/admin/outreach/ingest', 'Bearer unrelated'))

    expect(response.headers.get('x-middleware-request-authorization')).toBeNull()
  })

  it('does not bridge without both distinct configured tokens', async () => {
    process.env.N8N_INGEST_SECRET = 'old-token'
    delete process.env.N8N_INGEST_SECRET_NEXT

    const response = await middleware(request('/api/admin/outreach/ingest', 'Bearer new-token'))

    expect(response.headers.get('x-middleware-request-authorization')).toBeNull()
  })

  it('keeps the chat origin gate effective', async () => {
    process.env.N8N_INGEST_SECRET = 'old-token'
    process.env.N8N_INGEST_SECRET_NEXT = 'new-token'

    const response = await middleware(request('/api/chat', 'Bearer new-token', 'https://untrusted.example'))

    expect(response.status).toBe(403)
  })

  it('matches n8n routes without matching unrelated API routes', () => {
    expect(config.matcher).toContain('/api/admin/outreach/ingest')
    expect(config.matcher).toContain('/api/slack-meeting-dedupe')
    expect(config.matcher).not.toContain('/api/:path*')
  })
})
