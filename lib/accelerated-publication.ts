export const acceleratedPublication = {
  title: 'Accelerated: Building Smarter Products with AI',
  author: 'Vambah Sillah',
  publisher: 'AmaduTown Advisory Solutions',
  statusLabel: 'Workshop open',
  route: '/accelerated',
  coverImage: '/accelerated_cover_ebook.jpg',
  description:
    'A book and sixteen-lesson working system for turning faster AI output into better decisions, stronger evidence, and accountable action.',
} as const

export type AcceleratedPublicationCardFields = {
  title: string
  description: string | null
  publication_url: string | null
  publication_url_label?: string | null
  author: string | null
  publisher: string | null
  file_path: string | null
  file_type: string | null
  status_label?: string | null
}

function isAcceleratedTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase()
  return normalized === 'accelerated' || normalized.startsWith('accelerated:')
}

/**
 * Connect the published Accelerated card to its public book and workshop landing page
 * while preserving remote lead-magnet and product relationships.
 */
export function mergeAcceleratedIntoPublications<T extends AcceleratedPublicationCardFields>(
  publications: T[],
  localCard: T,
): T[] {
  const connected = publications.map((publication) => {
    if (!isAcceleratedTitle(publication.title)) {
      return publication
    }

    return {
      ...publication,
      title: acceleratedPublication.title,
      description: acceleratedPublication.description,
      publication_url: acceleratedPublication.route,
      publication_url_label: 'Explore the book and workshop',
      author: publication.author || acceleratedPublication.author,
      publisher: acceleratedPublication.publisher,
      file_path: publication.file_path || acceleratedPublication.coverImage,
      file_type: publication.file_type || 'image/jpeg',
      status_label: acceleratedPublication.statusLabel,
    }
  })

  const hasAccelerated = publications.some((publication) => isAcceleratedTitle(publication.title))
  return hasAccelerated ? connected : [localCard, ...connected]
}
