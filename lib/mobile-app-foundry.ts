export type MobileFoundryAgent = {
  name: string
  role: string
  mandate: string
  outputs: string[]
}

export type MobileFoundryScoreFactor = {
  label: string
  weight: number
  evidence: string[]
}

export type MobileFoundryPattern = {
  label: string
  signal: string
  example: string
}

export type MobileFoundryGate = {
  stage: string
  owner: string
  exitCriteria: string[]
}

export type MobileFoundryScoreBreakdown = {
  demand_signal: number
  monetization_path: number
  builder_fit: number
  build_velocity: number
  differentiation: number
  release_readiness: number
}

export type MobileFoundryBacklogRecord = {
  id: string
  title: string
  audience: string
  job_to_be_done: string
  trend_sources: string[]
  competitors: string[]
  popularity_score: number
  score_breakdown: MobileFoundryScoreBreakdown
  vambah_fit_summary: string
  prototype_scope: string[]
  commercialization_path: string[]
  risks: string[]
  human_gate: 'review_required'
}

export const MOBILE_APP_FOUNDRY_VIDEO = {
  title: 'My $1.19M App Process: App Idea & Validation (Part 1 of 3)',
  author: 'Adam Lyttle',
  url: 'https://youtu.be/yBa3BKOrVPA?si=QfNu_KvZ_1e9Wu3y',
  thumbnailUrl: 'https://i.ytimg.com/vi/yBa3BKOrVPA/hqdefault.jpg',
  sourceNote:
    'Used as the first validation reference for idea selection, market scanning, and popularity scoring.',
} as const

export const mobileFoundryAgents: MobileFoundryAgent[] = [
  {
    name: 'Amina (Zazzau)',
    role: 'Trend Strategist',
    mandate:
      'Find app categories with real demand before build work starts. Compare App Store, web, creator, search, and competitor signals against Vambah app-building patterns.',
    outputs: [
      'Ranked app opportunity backlog',
      'Popularity score with evidence',
      'Differentiation note',
      'Build-risk and store-risk flags',
    ],
  },
  {
    name: 'Imhotep (Kemet)',
    role: 'Prototype Architect',
    mandate:
      'Turn approved opportunities into scoped prototypes with repo plans, build milestones, demo criteria, and commercialization assumptions.',
    outputs: [
      'Prototype brief',
      'GitHub repo plan',
      'MVP scope',
      'Tester-readiness checklist',
    ],
  },
  {
    name: 'Kandake (Kush)',
    role: 'Commercialization Captain',
    mandate:
      'Move validated prototypes toward pricing, testers, store submission, release evidence, and public Portfolio packaging after human approval.',
    outputs: [
      'Commercialization roadmap',
      'Pricing and offer notes',
      'Tester handoff packet',
      'Submission-readiness gate',
    ],
  },
]

export const mobileFoundryScoreFactors: MobileFoundryScoreFactor[] = [
  {
    label: 'Demand signal',
    weight: 25,
    evidence: ['App Store rank/category movement', 'keyword demand', 'creator and search trend volume'],
  },
  {
    label: 'Monetization path',
    weight: 20,
    evidence: ['subscription or paid-app precedent', 'clear upgrade trigger', 'business or consumer willingness to pay'],
  },
  {
    label: 'Builder fit',
    weight: 20,
    evidence: ['matches prior app themes', 'fits AmaduTown offer ladder', 'can reuse known implementation patterns'],
  },
  {
    label: 'Build velocity',
    weight: 15,
    evidence: ['MVP can ship quickly', 'limited platform risk', 'low dependency on unavailable data or store approvals'],
  },
  {
    label: 'Differentiation',
    weight: 10,
    evidence: ['clear twist on a proven category', 'specific audience wedge', 'operational or AI workflow advantage'],
  },
  {
    label: 'Release readiness',
    weight: 10,
    evidence: ['tester path is clear', 'privacy burden is manageable', 'store policy risk is understood'],
  },
]

export const mobileFoundryPatterns: MobileFoundryPattern[] = [
  {
    label: 'Utility with a visible job',
    signal: 'The app helps a user finish one recurring task with less friction.',
    example: 'Scan, classify, split, track, prepare, practice, or generate a concrete output.',
  },
  {
    label: 'AI as a workbench',
    signal: 'The product uses AI to structure a messy input instead of pretending to replace the user.',
    example: 'A photo, voice note, receipt, pantry shelf, speech draft, or object becomes an actionable plan.',
  },
  {
    label: 'Prototype to offer',
    signal: 'The app can become a Portfolio proof point, consulting package, template, or productized service.',
    example: 'A useful internal tool becomes a customer-facing artifact once the value path is proven.',
  },
  {
    label: 'Community and access lens',
    signal: 'The app reduces a burden for people who usually get handed more process instead of better tools.',
    example: 'Small teams, learners, families, local operators, and resource-constrained builders get the first design pass.',
  },
]

export const mobileFoundryGates: MobileFoundryGate[] = [
  {
    stage: 'Idea intake',
    owner: 'Amina',
    exitCriteria: ['source evidence captured', 'popularity score calculated', 'private repo-fit profile checked'],
  },
  {
    stage: 'Prototype approval',
    owner: 'Vambah and Shaka',
    exitCriteria: ['MVP scope accepted', 'repo/account plan approved', 'cost and privacy risks reviewed'],
  },
  {
    stage: 'Build sprint',
    owner: 'Imhotep',
    exitCriteria: ['working prototype', 'demo route or build artifact', 'focused tests and smoke evidence'],
  },
  {
    stage: 'Commercialization review',
    owner: 'Kandake',
    exitCriteria: ['tester packet ready', 'pricing path drafted', 'submission risks and rollback noted'],
  },
]
