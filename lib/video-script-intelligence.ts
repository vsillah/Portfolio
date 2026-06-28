export type VideoScriptTemplateSourceType = 'seeded' | 'creator_pattern' | 'amadutown_performance'

export type VideoScriptTemplateOutline = {
  pain_point: string
  hook: string
  open_loop: string
  frame: string
  proof_demo: string
  teaching_beats: string[]
  cta: string
  closing_question: string
  thumbnail_promise: string
  source_distance_notes: string
}

export type VideoScriptTemplate = {
  id: string
  key: string
  name: string
  description: string
  source_type: VideoScriptTemplateSourceType
  source_urls: string[]
  outline: VideoScriptTemplateOutline
  status: 'active' | 'archived'
}

export type VideoScriptScorecard = {
  overall_score: number
  pain_clarity: number
  hook_strength: number
  loop_retention: number
  proof_density: number
  cta_clarity: number
  vambah_authority: number
  source_distance_safety: number
  blockers: string[]
  warnings: string[]
  notes: string[]
}

export const SCRIPT_INTELLIGENCE_SIDE_EFFECTS = {
  heygen: false,
  elevenlabs: false,
  render: false,
  upload: false,
  schedule: false,
  publish: false,
  external_post: false,
  apify: false,
} as const

export const SEEDED_VIDEO_SCRIPT_TEMPLATES: VideoScriptTemplate[] = [
  {
    id: 'seed-killer-script',
    key: 'killer_script',
    name: 'Killer script',
    description: 'Start from a concrete pain, open a loop, teach the frame, prove it, then close with a clear next step.',
    source_type: 'seeded',
    source_urls: [
      'https://youtu.be/IUE8o_e4uCY',
      'https://youtu.be/RagRPz6DI6U',
    ],
    status: 'active',
    outline: {
      pain_point: 'Name the practical problem the viewer already feels before explaining the idea.',
      hook: 'Lead with a specific tension or surprising consequence.',
      open_loop: 'Promise the viewer a clearer way to understand or solve the problem.',
      frame: 'Reframe the problem into an operating principle they can use.',
      proof_demo: 'Show the shipped workflow, artifact, or lived example that earns the claim.',
      teaching_beats: [
        'What the audience is trying to do.',
        'Where the old approach breaks.',
        'What the new operating layer changes.',
      ],
      cta: 'Invite the viewer to take one review, waitlist, or discovery action.',
      closing_question: 'Ask where this same problem is showing up in their work.',
      thumbnail_promise: 'Make the pain or before/after result visible in one plain phrase.',
      source_distance_notes: 'Use creator structure only. Rewrite the claim, language, examples, and visual identity for AmaduTown.',
    },
  },
  {
    id: 'seed-problem-proof-offer',
    key: 'problem_proof_offer',
    name: 'Problem, proof, offer',
    description: 'A direct launch structure for course, workshop, or service content that needs a visible CTA.',
    source_type: 'seeded',
    source_urls: [],
    status: 'active',
    outline: {
      pain_point: 'Identify the cost of the current behavior or workflow.',
      hook: 'Say the uncomfortable truth in one clean sentence.',
      open_loop: 'Tell the viewer what they will understand by the end.',
      frame: 'Give the simple model behind the offer.',
      proof_demo: 'Show the artifact, workflow, or result that proves the offer is real.',
      teaching_beats: [
        'The cost of staying informal.',
        'The operating model that reduces friction.',
        'The first action the audience can take.',
      ],
      cta: 'Point to the workshop interest path or discovery call.',
      closing_question: 'Ask what part of the operating loop they would fix first.',
      thumbnail_promise: 'From idea to accountable workflow.',
      source_distance_notes: 'Default AmaduTown launch pattern; no external creator material required.',
    },
  },
  {
    id: 'seed-accelerated-lesson',
    key: 'accelerated_lesson',
    name: 'Accelerated lesson',
    description: 'A lesson-video structure for the Accelerated course: pain, concept, proof moment, exercise, next action.',
    source_type: 'seeded',
    source_urls: [],
    status: 'active',
    outline: {
      pain_point: 'Show why speed without judgment creates more noise.',
      hook: 'Open with the moment where AI makes the work faster but the decision harder.',
      open_loop: 'Promise a practical way to keep speed and accountability together.',
      frame: 'Teach the Accelerated operating loop in plain language.',
      proof_demo: 'Use a Portfolio or AmaduTown workflow as the receipt.',
      teaching_beats: [
        'The speed trap.',
        'The decision-first frame.',
        'The proof and review loop.',
      ],
      cta: 'Ask the learner to complete the worksheet or join the workshop interest path.',
      closing_question: 'Ask which decision in their work needs a clearer loop.',
      thumbnail_promise: 'AI speed needs an operating layer.',
      source_distance_notes: 'Course-native template grounded in the Accelerated book and AmaduTown proof.',
    },
  },
]

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim()) : []
}

function scorePresence(value: string, strongLength = 80) {
  const text = value.trim()
  if (!text) return 0
  if (text.length >= strongLength) return 100
  return Math.max(35, Math.round((text.length / strongLength) * 100))
}

function includesAny(text: string, terms: string[]) {
  const lower = text.toLowerCase()
  return terms.some((term) => lower.includes(term))
}

export function normalizeVideoScriptTemplate(row: Record<string, unknown>): VideoScriptTemplate {
  const outline = asRecord(row.outline)
  return {
    id: asString(row.id) || asString(row.key),
    key: asString(row.key) || asString(row.id),
    name: asString(row.name) || 'Untitled script template',
    description: asString(row.description),
    source_type: (
      row.source_type === 'creator_pattern'
      || row.source_type === 'amadutown_performance'
      || row.source_type === 'seeded'
    ) ? row.source_type : 'seeded',
    source_urls: asStringArray(row.source_urls),
    status: row.status === 'archived' ? 'archived' : 'active',
    outline: normalizeScriptOutline(outline),
  }
}

export function normalizeScriptOutline(value: unknown): VideoScriptTemplateOutline {
  const record = asRecord(value)
  return {
    pain_point: asString(record.pain_point),
    hook: asString(record.hook),
    open_loop: asString(record.open_loop),
    frame: asString(record.frame),
    proof_demo: asString(record.proof_demo),
    teaching_beats: asStringArray(record.teaching_beats),
    cta: asString(record.cta),
    closing_question: asString(record.closing_question),
    thumbnail_promise: asString(record.thumbnail_promise),
    source_distance_notes: asString(record.source_distance_notes),
  }
}

export function buildScriptOutlineFromText(input: {
  scriptText: string
  template?: VideoScriptTemplate | null
}): VideoScriptTemplateOutline {
  const script = input.scriptText.trim()
  const paragraphs = script.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)
  const firstParagraph = paragraphs[0] ?? script.slice(0, 220)
  const lastParagraph = paragraphs[paragraphs.length - 1] ?? ''
  const template = input.template?.outline

  return {
    pain_point: template?.pain_point || firstParagraph,
    hook: template?.hook || firstParagraph,
    open_loop: template?.open_loop || '',
    frame: template?.frame || paragraphs[1] || '',
    proof_demo: template?.proof_demo || '',
    teaching_beats: template?.teaching_beats?.length ? template.teaching_beats : paragraphs.slice(1, 4),
    cta: template?.cta || lastParagraph,
    closing_question: template?.closing_question || (lastParagraph.includes('?') ? lastParagraph : ''),
    thumbnail_promise: template?.thumbnail_promise || '',
    source_distance_notes: template?.source_distance_notes || 'No external source pattern selected.',
  }
}

export function evaluateVideoScript(input: {
  scriptText: string
  outline?: Partial<VideoScriptTemplateOutline> | null
  template?: VideoScriptTemplate | null
  researchPacketCount?: number
}): VideoScriptScorecard {
  const script = input.scriptText.trim()
  const outline = normalizeScriptOutline(input.outline ?? {})
  const textForCta = `${outline.cta} ${script}`
  const textForProof = `${outline.proof_demo} ${script}`
  const textForAuthority = `${outline.proof_demo} ${script}`

  const painClarity = Math.max(scorePresence(outline.pain_point), includesAny(script, ['pain', 'problem', 'hard', 'cost', 'burden', 'stuck', 'breaks']) ? 72 : 0)
  const hookStrength = Math.max(scorePresence(outline.hook, 60), scorePresence(script.split(/[.!?]/)[0] ?? '', 70))
  const loopRetention = Math.max(scorePresence(outline.open_loop, 70), includesAny(script, ['by the end', 'what changed', 'the question', 'here is why']) ? 70 : 0)
  const proofDensity = Math.max(scorePresence(outline.proof_demo, 70), includesAny(textForProof, ['portfolio', 'amadutown', 'workflow', 'proof', 'built', 'shipped', 'receipt']) ? 78 : 0)
  const ctaClarity = Math.max(scorePresence(outline.cta, 55), includesAny(textForCta, ['join', 'book', 'download', 'comment', 'subscribe', 'waitlist', 'discovery', 'workshop']) ? 82 : 0)
  const vambahAuthority = Math.max(scorePresence(outline.proof_demo, 90), includesAny(textForAuthority, ['i built', 'i reviewed', 'my team', 'amadutown', 'portfolio', 'accelerated']) ? 82 : 0)
  const sourceDistanceSafety = input.template?.source_type === 'creator_pattern'
    ? scorePresence(outline.source_distance_notes, 60)
    : 92

  const blockers: string[] = []
  const warnings: string[] = []
  const notes: string[] = []

  if (painClarity < 55) blockers.push('Script needs a clearer audience pain point before render.')
  if (ctaClarity < 55) blockers.push('Script needs an explicit CTA before render.')
  if (sourceDistanceSafety < 55) blockers.push('Creator-derived pattern needs source-distance notes before render.')
  if (hookStrength < 65) warnings.push('Opening hook may not create enough tension.')
  if (loopRetention < 55) warnings.push('Open loop is weak or missing.')
  if (proofDensity < 55) warnings.push('Proof or demo cue is thin.')
  if (vambahAuthority < 55) warnings.push('Why Vambah can speak on this now is not obvious.')
  if ((input.researchPacketCount ?? 0) > 0) notes.push('Uses public creator research as outline evidence only.')
  if (input.template) notes.push(`Template: ${input.template.name}`)

  const dimensions = [
    painClarity,
    hookStrength,
    loopRetention,
    proofDensity,
    ctaClarity,
    vambahAuthority,
    sourceDistanceSafety,
  ]
  const overall = Math.round(dimensions.reduce((sum, score) => sum + score, 0) / dimensions.length)

  return {
    overall_score: overall,
    pain_clarity: Math.round(painClarity),
    hook_strength: Math.round(hookStrength),
    loop_retention: Math.round(loopRetention),
    proof_density: Math.round(proofDensity),
    cta_clarity: Math.round(ctaClarity),
    vambah_authority: Math.round(vambahAuthority),
    source_distance_safety: Math.round(sourceDistanceSafety),
    blockers,
    warnings,
    notes,
  }
}

export function scriptTemplatePromptBlock(template: VideoScriptTemplate | null, researchPackets: Array<Record<string, unknown>> = []) {
  if (!template && researchPackets.length === 0) return ''
  const lines: string[] = []
  if (template) {
    lines.push(`Selected script template: ${template.name}`)
    lines.push(`Template purpose: ${template.description}`)
    lines.push('Template outline:')
    lines.push(`- Pain point: ${template.outline.pain_point}`)
    lines.push(`- Hook: ${template.outline.hook}`)
    lines.push(`- Open loop: ${template.outline.open_loop}`)
    lines.push(`- Frame: ${template.outline.frame}`)
    lines.push(`- Proof/demo: ${template.outline.proof_demo}`)
    lines.push(`- CTA: ${template.outline.cta}`)
    lines.push(`- Closing question: ${template.outline.closing_question}`)
    lines.push(`- Source distance: ${template.outline.source_distance_notes}`)
  }
  if (researchPackets.length > 0) {
    lines.push('Approved public research pattern evidence:')
    for (const packet of researchPackets.slice(0, 5)) {
      const pattern = asRecord(packet.pattern_packet)
      lines.push(`- ${asString(packet.title) || asString(packet.source_url)}: hook=${asString(pattern.hook_structure) || asString(packet.hook_transcript)}; promise=${asString(pattern.promise_value)}; CTA=${asString(pattern.cta_style)}`)
    }
  }
  lines.push('Use these as outline patterns only. Do not copy creator scripts, titles, thumbnails, visual identity, or private details.')
  return lines.join('\n')
}
