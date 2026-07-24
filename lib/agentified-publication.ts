export const AGENTIFIED_SLUG = 'agentified'

export const agentifiedPublication = {
  title: 'Agentified',
  subtitle: 'Achieve agentic scale through trust',
  longSubtitle: "The Product Leader's Guide to Superhuman Acceleration Built on Trust",
  author: 'Vambah Sillah',
  publisher: 'AmaduTown Advisory Solutions',
  statusLabel: 'Published',
  route: `/${AGENTIFIED_SLUG}`,
  coverImage: '/agentified-cover.jpg',
  primaryPurchaseUrl: 'https://books2read.com/u/m2g5v6',
  amazonPaperbackUrl: 'https://www.amazon.com/dp/B0H9Z44FVF',
  books2readUrl: 'https://books2read.com/u/m2g5v6',
  draft2digitalProjectId: '4335094',
  ebookIsbn: '9798235024045',
  productionDraftPath: 'agentified/manuscript/production-draft/agentified-production-draft.md',
  workbookDraftPath: 'agentified/manuscript/workbook-enhanced/agentified-workbook-enhanced-draft.md',
  workbookPath: 'agentified/manuscript/workbook/agentified-operating-system-workbook.md',
  blueprintPath: 'agentified/agentified-book-blueprint.md',
  fableHandoffPath: 'agentified/claude-code-fable5-handoff.md',
  description:
    'A practical guide for leaders moving from AI demos to governed agentic work: memory, routing, approvals, evals, drift checks, cost controls, and receipts.',
  promise:
    'AI agents can move work faster. Trust decides whether that work should move.',
  operatingThesis:
    'Product leaders are moving from managing shipped features to governing systems that can draft, route, recommend, evaluate, and prepare work on their behalf.',
  purchaseLinks: [
    {
      label: 'Get the book',
      description: 'Universal Books2Read link for available ebook retailers.',
      href: 'https://books2read.com/u/m2g5v6',
      kind: 'primary',
      status: 'Verified',
    },
    {
      label: 'Amazon paperback',
      description: 'Direct Amazon listing from the KDP publication confirmation.',
      href: 'https://www.amazon.com/dp/B0H9Z44FVF',
      kind: 'secondary',
      status: 'KDP confirmed',
    },
    {
      label: 'Smashwords ebook',
      description: 'Draft2Digital-distributed ebook listing.',
      href: 'https://www.smashwords.com/books/view/2064969',
      kind: 'secondary',
      status: 'Verified',
    },
  ],
  wideRetailers: [
    'Books2Read',
    'Smashwords',
    'Kobo',
    'Fable',
    'Thalia',
    'Angus & Robertson',
  ],
  publicSafeProof:
    [
      'Portfolio-first corpus and source boundaries',
      'Open Brain memory proposals and governed promotion',
      'Shaka routing and role delineation',
      'Agent Kanban, trace receipts, approvals, evals, and drift assessment',
      'Mission Control as the operator cockpit',
    ],
  reviewGates: [
    'Opening pages deliver on trusted acceleration',
    'Portfolio examples stay structural unless explicitly approved',
    'Fable 5 line edit keeps the voice human and product-led',
    'Formal endnotes remain public-safe',
    'Open Brain summaries avoid raw manuscript text',
  ],
  buildCommands: [
    'cd /Users/vambahsillah/Projects/Portfolio/agentified',
    './scripts/assemble-production-draft.sh',
    './scripts/assemble-workbook-enhanced-draft.sh',
  ],
  openBrainCommand:
    'npm run open-brain:manuscript-summaries -- --export-dir /Users/vambahsillah/Projects/Portfolio/agentified/manuscript/production-draft',
} as const

export type AgentifiedPublication = typeof agentifiedPublication

/** Fields the homepage Publications merge overwrites from the shared Agentified source of truth. */
export type AgentifiedPublicationCardFields = {
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

function isAgentifiedTitle(title: string): boolean {
  return title.trim().toLowerCase() === agentifiedPublication.title.toLowerCase()
}

/**
 * Ensure the public publications list always surfaces the published Agentified card
 * (cover, publisher, copy, Learn More route) even when a stale remote row exists.
 */
export function mergeAgentifiedIntoPublications<T extends AgentifiedPublicationCardFields>(
  remotePublications: T[],
  localCard: T,
): T[] {
  const enrichedPublications = remotePublications.map((publication) => {
    if (!isAgentifiedTitle(publication.title)) {
      return publication
    }

    return {
      ...publication,
      description: agentifiedPublication.description,
      publication_url: publication.publication_url || agentifiedPublication.route,
      publication_url_label: 'Learn More',
      author: publication.author || agentifiedPublication.author,
      publisher: agentifiedPublication.publisher,
      file_path: agentifiedPublication.coverImage,
      file_type: 'image/jpeg',
      status_label: agentifiedPublication.statusLabel,
    }
  })

  const hasAgentified = remotePublications.some((publication) => isAgentifiedTitle(publication.title))
  return hasAgentified ? enrichedPublications : [localCard, ...enrichedPublications]
}
