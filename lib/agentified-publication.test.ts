import { describe, expect, it } from 'vitest'
import {
  AGENTIFIED_SLUG,
  agentifiedPublication,
  mergeAgentifiedIntoPublications,
  type AgentifiedPublicationCardFields,
} from './agentified-publication'

describe('agentifiedPublication purchase contract', () => {
  it('exposes a published route, JPEG cover, and ISBN tied to the shared slug', () => {
    expect(agentifiedPublication.route).toBe(`/${AGENTIFIED_SLUG}`)
    expect(agentifiedPublication.statusLabel).toBe('Published')
    expect(agentifiedPublication.coverImage).toBe('/agentified-cover.jpg')
    expect(agentifiedPublication.coverImage.endsWith('.svg')).toBe(false)
    expect(agentifiedPublication.ebookIsbn).toMatch(/^\d{13}$/)
    expect(agentifiedPublication.publisher).toBe('AmaduTown Advisory Solutions')
  })

  it('keeps purchase CTAs unique, absolute HTTPS, and aligned with top-level storefront URLs', () => {
    const links = agentifiedPublication.purchaseLinks
    const hrefs = links.map((link) => link.href)

    expect(links).toHaveLength(3)
    expect(new Set(hrefs).size).toBe(hrefs.length)

    for (const link of links) {
      expect(link.href.startsWith('https://')).toBe(true)
      expect(link.label.trim().length).toBeGreaterThan(0)
      expect(link.status.trim().length).toBeGreaterThan(0)
      expect(['primary', 'secondary']).toContain(link.kind)
    }

    const primaryLinks = links.filter((link) => link.kind === 'primary')
    expect(primaryLinks).toHaveLength(1)
    expect(primaryLinks[0]?.href).toBe(agentifiedPublication.primaryPurchaseUrl)
    expect(primaryLinks[0]?.href).toBe(agentifiedPublication.books2readUrl)
    expect(primaryLinks[0]?.href).toContain('books2read.com')

    const amazonLink = links.find((link) => link.label.toLowerCase().includes('amazon'))
    expect(amazonLink?.href).toBe(agentifiedPublication.amazonPaperbackUrl)
    expect(amazonLink?.href).toMatch(/amazon\.com\/dp\//)
    expect(amazonLink?.kind).toBe('secondary')

    const smashwordsLink = links.find((link) => link.label.toLowerCase().includes('smashwords'))
    expect(smashwordsLink?.href).toContain('smashwords.com/books/view/')
    expect(smashwordsLink?.kind).toBe('secondary')
  })

  it('lists wide retailers for the published distribution notice', () => {
    expect(agentifiedPublication.wideRetailers.length).toBeGreaterThanOrEqual(3)
    expect(agentifiedPublication.wideRetailers).toEqual(
      expect.arrayContaining(['Books2Read', 'Smashwords', 'Kobo']),
    )
    expect(new Set(agentifiedPublication.wideRetailers).size).toBe(
      agentifiedPublication.wideRetailers.length,
    )
  })
})

describe('mergeAgentifiedIntoPublications', () => {
  const localCard: AgentifiedPublicationCardFields = {
    title: agentifiedPublication.title,
    description: agentifiedPublication.description,
    publication_url: agentifiedPublication.route,
    publication_url_label: 'Learn More',
    author: agentifiedPublication.author,
    publisher: agentifiedPublication.publisher,
    file_path: agentifiedPublication.coverImage,
    file_type: 'image/jpeg',
    status_label: agentifiedPublication.statusLabel,
  }

  it('prepends the local Agentified card when the remote list omits it', () => {
    const remote = [
      {
        title: 'The Equity Code',
        description: 'Remote only',
        publication_url: 'https://example.com/equity',
        author: null,
        publisher: 'Amazon',
        file_path: '/equity.png',
        file_type: 'image/png',
      },
    ]

    const merged = mergeAgentifiedIntoPublications(remote, localCard)

    expect(merged).toHaveLength(2)
    expect(merged[0]).toEqual(localCard)
    expect(merged[1]).toEqual(remote[0])
  })

  it('overwrites stale remote Agentified fields with the published source of truth', () => {
    const remote = [
      {
        title: '  agentified  ',
        description: 'Stale draft description',
        publication_url: null,
        publication_url_label: 'Buy now',
        author: null,
        publisher: 'AmaduTown Manuscript',
        file_path: '/agentified-cover.svg',
        file_type: 'image/svg+xml',
        status_label: 'Author review',
      },
      {
        title: 'Other Book',
        description: 'Leave me alone',
        publication_url: '/other',
        author: 'Someone',
        publisher: 'Press',
        file_path: '/other.png',
        file_type: 'image/png',
      },
    ]

    const merged = mergeAgentifiedIntoPublications(remote, localCard)

    expect(merged).toHaveLength(2)
    expect(merged[0]).toMatchObject({
      title: '  agentified  ',
      description: agentifiedPublication.description,
      publication_url: agentifiedPublication.route,
      publication_url_label: 'Learn More',
      author: agentifiedPublication.author,
      publisher: agentifiedPublication.publisher,
      file_path: agentifiedPublication.coverImage,
      file_type: 'image/jpeg',
      status_label: agentifiedPublication.statusLabel,
    })
    expect(merged[1]).toEqual(remote[1])
  })

  it('preserves an existing remote Agentified publication_url when present', () => {
    const remote = [
      {
        title: 'Agentified',
        description: 'ignored',
        publication_url: '/custom-agentified',
        author: 'Existing Author',
        publisher: 'Stale',
        file_path: '/stale.svg',
        file_type: 'image/svg+xml',
      },
    ]

    const [merged] = mergeAgentifiedIntoPublications(remote, localCard)

    expect(merged.publication_url).toBe('/custom-agentified')
    expect(merged.author).toBe('Existing Author')
    expect(merged.file_path).toBe(agentifiedPublication.coverImage)
    expect(merged.file_type).toBe('image/jpeg')
  })
})
