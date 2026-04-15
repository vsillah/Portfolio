import { describe, expect, it } from 'vitest'
import { domainForLookup, technologiesFromBuiltWithPayload } from './tech-stack-lookup'

describe('domainForLookup', () => {
  it('strips protocol, path, and www', () => {
    expect(domainForLookup('https://www.example.com/foo')).toBe('example.com')
    expect(domainForLookup('http://sub.example.com')).toBe('sub.example.com')
  })

  it('accepts bare host and host/path without scheme', () => {
    expect(domainForLookup('berinpsych.org')).toBe('berinpsych.org')
    expect(domainForLookup('www.berinpsych.org/about')).toBe('berinpsych.org')
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
