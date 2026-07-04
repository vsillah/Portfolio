export const AGENTIFIED_SLUG = 'agentified'

export const agentifiedPublication = {
  title: 'Agentified',
  subtitle: "The Product Leader's Guide to Superhuman Acceleration Built on Trust",
  author: 'Vambah Sillah',
  publisher: 'AmaduTown Manuscript',
  statusLabel: 'Author review',
  route: `/${AGENTIFIED_SLUG}`,
  coverImage: '/agentified-cover.svg',
  productionDraftPath: 'agentified/manuscript/production-draft/agentified-production-draft.md',
  workbookDraftPath: 'agentified/manuscript/workbook-enhanced/agentified-workbook-enhanced-draft.md',
  workbookPath: 'agentified/manuscript/workbook/agentified-operating-system-workbook.md',
  blueprintPath: 'agentified/agentified-book-blueprint.md',
  fableHandoffPath: 'agentified/claude-code-fable5-handoff.md',
  description:
    'A product-management sequel to Accelerated about the next operating problem: how teams turn agentic speed into trusted capacity through memory, routing, approvals, evals, drift checks, and receipts.',
  promise:
    'Acceleration still matters. In an agentic world, it only scales when the work can be trusted.',
  operatingThesis:
    'Product leaders are moving from managing shipped features to governing systems that can draft, route, recommend, evaluate, and prepare work on their behalf.',
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
