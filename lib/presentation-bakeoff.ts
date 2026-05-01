export const PRESENTATION_TOOLS = [
  'codex_pptx',
  'claude_design',
  'gamma',
] as const

export type PresentationTool = (typeof PRESENTATION_TOOLS)[number]

export type PresentationAudience =
  | 'colleagues'
  | 'executives'
  | 'clients'
  | 'workshop_participants'
  | 'public_audience'

export type PresentationFormat =
  | 'one_hour_course'
  | 'sales_presentation'
  | 'strategy_workshop'
  | 'internal_update'
  | 'thought_leadership'

export interface PresentationBakeoffInput {
  title: string
  thesis: string
  audience: PresentationAudience
  format: PresentationFormat
  durationMinutes: number
  proofAssets?: string[]
  demoRoutes?: string[]
  sourceAnchors?: string[]
  brandSystem?: 'amadutown' | 'custom' | 'none'
  needsEditablePptx?: boolean
  needsLiveDemos?: boolean
  needsSourceValidation?: boolean
  needsFacilitatorNotes?: boolean
}

export interface PresentationCandidateScore {
  dimension: string
  score: number
  weight: number
  weightedScore: number
  rationale: string
}

export interface PresentationCandidate {
  tool: PresentationTool
  label: string
  role: string
  bestFor: string
  watchOutFor: string
  generationPrompt: string
  scores: PresentationCandidateScore[]
  totalScore: number
}

export interface PresentationBakeoffPlan {
  generatedAt: string
  title: string
  thesis: string
  recommendedTool: PresentationTool
  recommendedLabel: string
  recommendation: string
  coursePlan: string[]
  requiredAssets: string[]
  demoPlan: string[]
  sourcePlan: string[]
  qaChecklist: string[]
  candidates: PresentationCandidate[]
}

const TOOL_LABELS: Record<PresentationTool, string> = {
  codex_pptx: 'Codex / PPTX build',
  claude_design: 'Claude Design prototype',
  gamma: 'Gamma AI deck',
}

const TOOL_ROLES: Record<PresentationTool, string> = {
  codex_pptx: 'Final packaging and repeatable build system',
  claude_design: 'High-polish visual exploration',
  gamma: 'Fast alternate visual direction',
}

const TOOL_STRENGTHS: Record<PresentationTool, string> = {
  codex_pptx: 'Editable files, source control, QA, speaker notes, and deterministic rebuilds.',
  claude_design: 'Strong visual atmosphere, layout polish, and prototype speed.',
  gamma: 'Quick deck shaping and alternate structure when time matters.',
}

const TOOL_RISKS: Record<PresentationTool, string> = {
  codex_pptx: 'Needs more setup and QA discipline than a single hosted prompt.',
  claude_design: 'May produce beautiful artifacts that need translation into final PPTX packaging.',
  gamma: 'Can look polished while weakening voice, evidence fidelity, or editability.',
}

const SCORE_WEIGHTS = {
  course_clarity: 0.16,
  voice_fit: 0.14,
  brand_fit: 0.12,
  proof_quality: 0.14,
  strategic_strength: 0.12,
  demo_readiness: 0.1,
  editability: 0.1,
  export_quality: 0.06,
  qa_readiness: 0.06,
} as const

type ScoreDimension = keyof typeof SCORE_WEIGHTS

const DIMENSION_LABELS: Record<ScoreDimension, string> = {
  course_clarity: 'Course clarity',
  voice_fit: 'Voice fit',
  brand_fit: 'Brand fit',
  proof_quality: 'Proof quality',
  strategic_strength: 'Strategic strength',
  demo_readiness: 'Demo readiness',
  editability: 'Editability',
  export_quality: 'Export quality',
  qa_readiness: 'QA readiness',
}

function bounded(value: number): number {
  return Math.max(1, Math.min(5, value))
}

function formatList(values: string[] | undefined, fallback: string): string {
  const clean = (values ?? []).map((v) => v.trim()).filter(Boolean)
  return clean.length > 0 ? clean.join(', ') : fallback
}

function baseScore(tool: PresentationTool, dimension: ScoreDimension): number {
  const scores: Record<PresentationTool, Record<ScoreDimension, number>> = {
    codex_pptx: {
      course_clarity: 5,
      voice_fit: 5,
      brand_fit: 5,
      proof_quality: 5,
      strategic_strength: 5,
      demo_readiness: 5,
      editability: 4,
      export_quality: 4,
      qa_readiness: 5,
    },
    claude_design: {
      course_clarity: 4,
      voice_fit: 4,
      brand_fit: 4,
      proof_quality: 3,
      strategic_strength: 4,
      demo_readiness: 3,
      editability: 3,
      export_quality: 3,
      qa_readiness: 3,
    },
    gamma: {
      course_clarity: 4,
      voice_fit: 3,
      brand_fit: 3,
      proof_quality: 3,
      strategic_strength: 3,
      demo_readiness: 3,
      editability: 3,
      export_quality: 4,
      qa_readiness: 2,
    },
  }
  return scores[tool][dimension]
}

function scoreAdjustment(
  tool: PresentationTool,
  dimension: ScoreDimension,
  input: PresentationBakeoffInput
): number {
  let adjustment = 0

  if (input.needsEditablePptx && tool === 'codex_pptx' && dimension === 'editability') adjustment += 1
  if (input.needsEditablePptx && tool !== 'codex_pptx' && dimension === 'editability') adjustment -= 1

  if (input.needsLiveDemos && tool === 'codex_pptx' && dimension === 'demo_readiness') adjustment += 1
  if (input.needsLiveDemos && tool === 'gamma' && dimension === 'demo_readiness') adjustment -= 1

  if (input.needsSourceValidation && tool === 'codex_pptx' && dimension === 'proof_quality') adjustment += 1
  if (input.needsSourceValidation && tool === 'gamma' && dimension === 'proof_quality') adjustment -= 1

  if (input.needsFacilitatorNotes && tool === 'codex_pptx' && dimension === 'qa_readiness') adjustment += 1
  if (input.needsFacilitatorNotes && tool === 'claude_design' && dimension === 'qa_readiness') adjustment -= 1

  if (input.brandSystem === 'amadutown' && tool === 'codex_pptx' && dimension === 'brand_fit') adjustment += 1
  if (input.brandSystem === 'amadutown' && tool === 'gamma' && dimension === 'brand_fit') adjustment -= 1

  return adjustment
}

function scoreRationale(
  tool: PresentationTool,
  dimension: ScoreDimension,
  score: number,
  input: PresentationBakeoffInput
): string {
  if (dimension === 'proof_quality') {
    return input.needsSourceValidation
      ? `${TOOL_LABELS[tool]} must keep source anchors visible and separate from slide copy.`
      : `${TOOL_LABELS[tool]} should still keep evidence tied to the point being taught.`
  }
  if (dimension === 'demo_readiness') {
    return input.needsLiveDemos
      ? `${TOOL_LABELS[tool]} needs live routes, backup screenshots, and a clear talk track.`
      : `${TOOL_LABELS[tool]} can use lighter proof moments because live demos are not required.`
  }
  if (dimension === 'editability') {
    return input.needsEditablePptx
      ? `${TOOL_LABELS[tool]} is scored against how easily the final deck can be edited.`
      : `${TOOL_LABELS[tool]} is scored for review speed more than long-term editability.`
  }
  return score >= 4
    ? `${TOOL_LABELS[tool]} is strong on ${DIMENSION_LABELS[dimension].toLowerCase()}.`
    : `${TOOL_LABELS[tool]} needs extra review on ${DIMENSION_LABELS[dimension].toLowerCase()}.`
}

function buildScores(
  tool: PresentationTool,
  input: PresentationBakeoffInput
): PresentationCandidateScore[] {
  return (Object.keys(SCORE_WEIGHTS) as ScoreDimension[]).map((dimension) => {
    const score = bounded(baseScore(tool, dimension) + scoreAdjustment(tool, dimension, input))
    const weight = SCORE_WEIGHTS[dimension]
    return {
      dimension: DIMENSION_LABELS[dimension],
      score,
      weight,
      weightedScore: Number((score * weight).toFixed(2)),
      rationale: scoreRationale(tool, dimension, score, input),
    }
  })
}

function buildGenerationPrompt(tool: PresentationTool, input: PresentationBakeoffInput): string {
  const proofAssets = formatList(input.proofAssets, 'available product screenshots and framework diagrams')
  const demoRoutes = formatList(input.demoRoutes, 'relevant live demo routes')
  const sourceAnchors = formatList(input.sourceAnchors, 'validated public sources')

  return [
    `Create a ${input.durationMinutes}-minute ${input.format.replaceAll('_', ' ')} titled "${input.title}".`,
    `Thesis: ${input.thesis}`,
    `Audience: ${input.audience.replaceAll('_', ' ')}.`,
    'Use a grounded, practical, systems-minded voice. Start from a real product tension and move toward action.',
    `Proof assets to incorporate: ${proofAssets}.`,
    `Demo routes to support: ${demoRoutes}.`,
    `Source anchors to preserve: ${sourceAnchors}.`,
    'Build the story around idea -> plan -> proof -> demo -> source -> QA.',
    tool === 'gamma'
      ? 'Use Gamma for a fast alternate direction, but do not let it invent unsupported claims or flatten the voice.'
      : tool === 'claude_design'
        ? 'Use Claude Design for visual exploration, with a strong layout concept that can later be translated into the final deck.'
        : 'Use Codex/PPTX as the delivery base with speaker notes, backup screenshots, source guide, contact sheet, and export verification.',
  ].join('\n')
}

function buildCandidate(
  tool: PresentationTool,
  input: PresentationBakeoffInput
): PresentationCandidate {
  const scores = buildScores(tool, input)
  const totalScore = Number(scores.reduce((sum, item) => sum + item.weightedScore, 0).toFixed(2))

  return {
    tool,
    label: TOOL_LABELS[tool],
    role: TOOL_ROLES[tool],
    bestFor: TOOL_STRENGTHS[tool],
    watchOutFor: TOOL_RISKS[tool],
    generationPrompt: buildGenerationPrompt(tool, input),
    scores,
    totalScore,
  }
}

function buildCoursePlan(input: PresentationBakeoffInput): string[] {
  const format = input.format.replaceAll('_', ' ')
  return [
    `Open with the practical tension behind "${input.title}" and name why it matters to ${input.audience.replaceAll('_', ' ')}.`,
    `Frame the ${format} around the decision the audience needs to make after the session.`,
    'Build the first draft as a course map before choosing the final slide style.',
    'Prototype at least three candidate directions: Codex/PPTX, Claude Design, and Gamma.',
    'Use the same brief, proof assets, source anchors, and brand rules across every candidate.',
    'Score candidates against clarity, voice, brand, proof, strategy, demo readiness, editability, export quality, and QA readiness.',
    'Promote the winning direction into the final package with notes, demo runbook, source guide, contact sheet, and QA notes.',
  ]
}

function buildDemoPlan(input: PresentationBakeoffInput): string[] {
  const routes = (input.demoRoutes ?? []).map((route) => route.trim()).filter(Boolean)
  if (routes.length === 0) {
    return [
      'Identify the live routes or product surfaces that prove the story.',
      'Capture backup screenshots after the tool has meaningful content on screen.',
      'Write a one-sentence reason for each demo before it goes into the deck.',
    ]
  }

  return routes.map((route) => {
    return `${route}: capture a backup screenshot, show the tool in action, and write the specific point it proves.`
  })
}

function buildSourcePlan(input: PresentationBakeoffInput): string[] {
  const anchors = (input.sourceAnchors ?? []).map((source) => source.trim()).filter(Boolean)
  const base = input.needsSourceValidation
    ? ['Validate current market claims before slide copy is finalized.']
    : ['Keep source references available even if the deck is mostly internal.']

  if (anchors.length === 0) {
    return [
      ...base,
      'Create a source guide with claim, reference, URL, workshop talk track, and deck section.',
      'Add a compact reference index slide when the deck makes industry claims.',
    ]
  }

  return [
    ...base,
    ...anchors.map((source) => `${source}: map this source to one deck claim and one talk-track sentence.`),
  ]
}

export function buildPresentationBakeoffPlan(
  input: PresentationBakeoffInput
): PresentationBakeoffPlan {
  const candidates = PRESENTATION_TOOLS
    .map((tool) => buildCandidate(tool, input))
    .sort((a, b) => b.totalScore - a.totalScore)
  const winner = candidates[0]

  return {
    generatedAt: new Date().toISOString(),
    title: input.title,
    thesis: input.thesis,
    recommendedTool: winner.tool,
    recommendedLabel: winner.label,
    recommendation: `${winner.label} is the best delivery base for this brief because it scores highest across clarity, proof, editability, demo readiness, and QA discipline. Borrow visual ideas from the other candidates where they help, but keep the final package source-backed and presentation-ready.`,
    coursePlan: buildCoursePlan(input),
    requiredAssets: [
      'Personality corpus and humanizer guidance',
      input.brandSystem === 'amadutown' ? 'AmaduTown logo, palette, and prior framework visuals' : 'Brand assets and visual rules',
      'Proof screenshots that show tools in action',
      'Speaker notes and demo cues',
      'Source guide for market or factual claims',
      'Contact sheet and individual slide previews',
    ],
    demoPlan: buildDemoPlan(input),
    sourcePlan: buildSourcePlan(input),
    qaChecklist: [
      'No stretched logo or off-brand asset treatment.',
      'No blank proof screenshots or start-state screens where a working state would teach more.',
      'No off-screen diagrams, clipped text, or unreadable crops.',
      'No unsupported market claims.',
      'No generic AI voice, filler phrases, or formulaic contrast lines.',
      'PPTX, PDF, slide images, notes, source guide, demo runbook, and contact sheet are present.',
      'Slide count, notes count, and key slide previews are verified.',
    ],
    candidates,
  }
}
