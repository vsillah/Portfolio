import { describe, expect, it } from 'vitest'
import { mergeAcceleratedIntoPublications } from './accelerated-publication'

const acceleratedRow = {
  title: 'Accelerated: Building Smarter Products with AI',
  description: 'Old copy',
  publication_url: null,
  publication_url_label: null,
  author: null,
  publisher: 'Amazon',
  file_path: '/accelerated_cover_ebook.jpg',
  file_type: 'image/jpeg',
  status_label: null,
  linked_lead_magnet: { id: 'lead-1', slug: 'accelerated' },
}

describe('mergeAcceleratedIntoPublications', () => {
  it('connects the existing publication to the public book and workshop landing page', () => {
    const [publication] = mergeAcceleratedIntoPublications([acceleratedRow], acceleratedRow)

    expect(publication).toMatchObject({
      publication_url: '/accelerated',
      publication_url_label: 'Explore the book and workshop',
      status_label: 'Workshop open',
      author: 'Vambah Sillah',
      publisher: 'AmaduTown Advisory Solutions',
    })
  })

  it('preserves the existing download relationship', () => {
    const [publication] = mergeAcceleratedIntoPublications([acceleratedRow], acceleratedRow)

    expect(publication.linked_lead_magnet).toEqual({ id: 'lead-1', slug: 'accelerated' })
  })

  it('leaves unrelated publications unchanged', () => {
    const equityCode = { ...acceleratedRow, title: 'The Equity Code' }

    expect(mergeAcceleratedIntoPublications([equityCode], acceleratedRow)).toEqual([
      acceleratedRow,
      equityCode,
    ])
  })
})
