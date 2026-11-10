import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { GET } from './route'
import { DARK_CASTLE_VISUAL_SHA256 } from '@/lib/social-approved-visual-contract'

const originalVercelEnv = process.env.VERCEL_ENV
afterEach(() => { process.env.VERCEL_ENV = originalVercelEnv })

describe('local approved visual delivery', () => {
  it('serves only the exact approved PNG on localhost', async () => {
    delete process.env.VERCEL_ENV
    const response = await GET()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex')).toBe(DARK_CASTLE_VISUAL_SHA256)
  })

  it('does not publish the internal review image in a Vercel deployment', async () => {
    process.env.VERCEL_ENV = 'production'
    expect((await GET()).status).toBe(404)
    process.env.VERCEL_ENV = 'preview'
    expect((await GET()).status).toBe(404)
  })

  it('does not publish the internal review image when Node is production', async () => {
    const previousNodeEnv = process.env.NODE_ENV
    delete process.env.VERCEL_ENV
    process.env.NODE_ENV = 'production'
    try {
      expect((await GET()).status).toBe(404)
    } finally {
      process.env.NODE_ENV = previousNodeEnv
    }
  })
})
