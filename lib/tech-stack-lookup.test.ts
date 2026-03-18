import { afterEach, describe, expect, it, vi } from 'vitest'
import { domainForLookup, technologiesFromBuiltWithPayload } from './tech-stack-lookup'

describe('domainForLookup', () => {
  it('strips protocol, path, and www', () => {
    expect(domainForLookup('https://www.example.com/foo')).toBe('example.com')
    expect(domainForLookup('http://sub.example.com')).toBe('sub.example.com')
    expect(domainForLookup('https://www.Example.com/path?q=1')).toBe('example.com')
  })

  it('accepts bare host and host/path without scheme', () => {
    expect(domainForLookup('berinpsych.org')).toBe('berinpsych.org')
    expect(domainForLookup('www.berinpsych.org/about')).toBe('berinpsych.org')
    expect(domainForLookup('WWW.Example.com/sales')).toBe('example.com')
  })

  it('returns null for empty or invalid input', () => {
    expect(domainForLookup('')).toBeNull()
    expect(domainForLookup('   ')).toBeNull()
    expect(domainForLookup('http://')).toBeNull()
    expect(domainForLookup('x')).toBeNull()
  })
})

describe('technologiesFromBuiltWithPayload', () => {
  it('parses v22 Results[0].Result.Paths with flat Technologies[]', () => {
    const { technologies, byTag } = technologiesFromBuiltWithPayload({
      Results: [
        {
          Lookup: 'example.com',
          Result: {
            Paths: [
              {
                Technologies: [
                  { Name: 'React', Tag: 'javascript' },
                  { Name: 'nginx', Tag: 'Web Server' },
                ],
              },
            ],
          },
        },
      ],
    })
    expect(technologies.map((t) => t.name).sort()).toEqual(['React', 'nginx'])
    expect(byTag.javascript).toContain('React')
    expect(byTag['Web Server']).toContain('nginx')
  })

  it('supports Result as an array of path-holders', () => {
    const { technologies } = technologiesFromBuiltWithPayload({
      Results: [
        {
          Result: [
            { Paths: [{ Technologies: [{ Name: 'A', Tag: 't1' }] }] },
            { Paths: [{ Technologies: [{ Name: 'B', Tag: 't2' }] }] },
          ],
        },
      ],
    })
    expect(technologies.map((t) => t.name).sort()).toEqual(['A', 'B'])
  })

  it('supports Paths on the result block and legacy Technology wrapper', () => {
    const { technologies } = technologiesFromBuiltWithPayload({
      Results: [
        {
          Paths: [{ Technologies: [{ Technology: { Name: 'Legacy', Tag: 'cms' } }] }],
        },
      ],
    })
    expect(technologies).toEqual([expect.objectContaining({ name: 'Legacy', tag: 'cms' })])
  })

  it('falls back to top-level Result when Results is empty', () => {
    const { technologies } = technologiesFromBuiltWithPayload({
      Results: [],
      Result: { Paths: [{ Technologies: [{ Name: 'Top', Tag: 'x' }] }] },
    })
    expect(technologies).toEqual([expect.objectContaining({ name: 'Top' })])
  })

  it('reads name/tag with lowercase keys', () => {
    const { technologies } = technologiesFromBuiltWithPayload({
      Results: [
        {
          Result: {
            Paths: [{ Technologies: [{ name: 'Lower', tag: 'js' }] }],
          },
        },
      ],
    })
    expect(technologies).toEqual([expect.objectContaining({ name: 'Lower', tag: 'js' })])
  })
})

const ORIGINAL_BUILTWITH_API_KEY = process.env.BUILTWITH_API_KEY

async function loadTechStackModule(apiKey?: string) {
  if (typeof apiKey === 'string') {
    process.env.BUILTWITH_API_KEY = apiKey
  } else {
    delete process.env.BUILTWITH_API_KEY
  }
  vi.resetModules()
  return import('./tech-stack-lookup')
}

afterEach(() => {
  if (typeof ORIGINAL_BUILTWITH_API_KEY === 'string') {
    process.env.BUILTWITH_API_KEY = ORIGINAL_BUILTWITH_API_KEY
  } else {
    delete process.env.BUILTWITH_API_KEY
  }
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('fetchTechStackByDomain', () => {
  it('returns a configuration error when API key is missing', async () => {
    const { fetchTechStackByDomain } = await loadTechStackModule()
    const result = await fetchTechStackByDomain('https://www.example.com')

    expect(result).toMatchObject({
      ok: false,
      domain: 'example.com',
      error: 'Tech stack lookup is not configured. Add BUILTWITH_API_KEY to enable.',
    })
  })

  it('surfaces rate-limit details and credits remaining', async () => {
    const { fetchTechStackByDomain } = await loadTechStackModule('live-key')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ retryAfterSeconds: 30 }), {
        status: 429,
        headers: { 'X-API-CREDITS-REMAINING': '12' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchTechStackByDomain('example.com')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const requestUrl = String(fetchMock.mock.calls[0]?.[0] ?? '')
    expect(requestUrl).toContain('KEY=live-key')
    expect(requestUrl).toContain('LOOKUP=example.com')
    expect(result).toMatchObject({
      ok: false,
      domain: 'example.com',
      creditsRemaining: 12,
    })
    expect(result.error).toContain('Rate limit exceeded.')
    expect(result.error).toContain('Retry after 30s.')
  })

  it('parses successful responses, dedupes technologies, and groups by tag', async () => {
    const { fetchTechStackByDomain } = await loadTechStackModule('live-key')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          Lookup: 'example.com',
          Result: {
            Paths: [
              {
                Path: [
                  {
                    Technologies: [
                      {
                        Technology: {
                          Name: 'Google Analytics',
                          Tag: 'Analytics',
                          Categories: ['Analytics'],
                        },
                      },
                      {
                        Technology: {
                          Name: 'HubSpot',
                          Tag: 'Marketing Automation',
                          Parent: 'HubSpot',
                        },
                      },
                    ],
                  },
                  {
                    Technologies: [
                      { Technology: { Name: 'Google Analytics', Tag: 'Analytics' } },
                      { Technology: { Name: 'Cloudflare', Tag: 'CDN' } },
                    ],
                  },
                ],
              },
            ],
          },
        }),
        {
          status: 200,
          headers: { 'X-API-CREDITS-REMAINING': '77' },
        }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchTechStackByDomain('example.com')

    expect(result.ok).toBe(true)
    expect(result.domain).toBe('example.com')
    expect(result.creditsRemaining).toBe(77)
    expect(result.technologies?.map((t) => t.name)).toEqual([
      'Google Analytics',
      'HubSpot',
      'Cloudflare',
    ])
    expect(result.byTag).toEqual({
      Analytics: ['Google Analytics'],
      'Marketing Automation': ['HubSpot'],
      CDN: ['Cloudflare'],
    })
  })
})
