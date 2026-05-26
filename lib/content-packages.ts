import {
  buildPresentationBakeoffPlan,
  type PresentationBakeoffInput,
} from './presentation-bakeoff'

export const CONTENT_PACKAGE_OUTPUT_TYPES = [
  'linkedin_post',
  'linkedin_carousel',
  'pptx_deck',
  'video_script',
  'heygen_video',
  'elevenlabs_audio',
  'newsletter_blurb',
  'email_draft',
  'short_caption',
] as const

export type ContentPackageOutputType = (typeof CONTENT_PACKAGE_OUTPUT_TYPES)[number]

export const CONTENT_PACKAGE_APPROVAL_TYPES = {
  script: 'content_package_script_packet',
  media: 'content_package_media_generation',
  publish: 'content_package_publish',
} as const

export interface ContentFramework {
  id: string
  displayName: string
  creatorName: string
  category: string
  summary: string
  usageGuidance: string
  sourceUrls: string[]
  metadata?: Record<string, unknown>
}

export interface BuildContentPackageInput {
  title?: string | null
  transcriptText: string
  topicHint?: string | null
  targetAudience?: string | null
  targetOutputs?: ContentPackageOutputType[]
  frameworkIds?: string[]
  chronicleNotes?: string[]
  audioStoragePath?: string | null
  audioFileName?: string | null
}

export interface ContentPackageOutputDraft {
  outputType: ContentPackageOutputType
  title: string
  body: string
  payload: Record<string, unknown>
  requiredApproval: keyof typeof CONTENT_PACKAGE_APPROVAL_TYPES
  downstreamType?: 'social_content_queue' | 'video_ideas_queue' | 'presentation_plan' | null
}

export interface GeneratedContentPackage {
  title: string
  sourcePacket: Record<string, unknown>
  researchPacket: Record<string, unknown>
  frameworkIds: string[]
  targetOutputs: ContentPackageOutputType[]
  outputs: ContentPackageOutputDraft[]
  presentationPlan: Record<string, unknown>
}

export const DEFAULT_CONTENT_FRAMEWORKS: ContentFramework[] = [
  {
    id: 'alex-hormozi-value-equation',
    displayName: 'Value Equation / Grand Slam Offer',
    creatorName: 'Alex Hormozi',
    category: 'offer_strategy',
    summary: 'Frame value through dream outcome, perceived likelihood, time delay, and effort or sacrifice.',
    usageGuidance: 'Use when an idea needs an offer, proof stack, guarantee, or business case.',
    sourceUrls: ['https://www.acquisition.com/'],
    metadata: { defaultVisual: 'equation' },
  },
  {
    id: 'nick-saraev-ai-content-engine',
    displayName: 'AI Content Engine / Creator Systems',
    creatorName: 'Nick Saraev',
    category: 'content_systems',
    summary: 'Frame content production as a repeatable AI-assisted system from raw idea to platform-specific assets.',
    usageGuidance: 'Use when one source idea should become posts, decks, scripts, audio, and short-form clips.',
    sourceUrls: ['https://nicksaraev.com/', 'https://makerschoolcommunity.com/'],
    metadata: {
      defaultVisual: 'cycle',
      nameNote: 'User referenced Nick Saerev; public sources indicate Nick Saraev is the likely intended creator.',
    },
  },
]

const DEFAULT_OUTPUTS: ContentPackageOutputType[] = [
  'linkedin_post',
  'linkedin_carousel',
  'pptx_deck',
  'video_script',
  'heygen_video',
  'elevenlabs_audio',
]

const AMADUTOWN_PROOF_ROUTES = [
  { route: '/admin/agents', label: 'Agent Ops Mission Control', hint: 'agent ops' },
  { route: '/admin/social-content', label: 'Social Content Queue', hint: 'social content' },
  { route: '/admin/content/video-generation', label: 'Video Generation', hint: 'video generation' },
  { route: '/admin/presentations', label: 'Presentation Generator', hint: 'presentation' },
  { route: '/admin/agents/open-brain', label: 'Open Brain', hint: 'open brain' },
  { route: '/tools/audit', label: 'AI Audit Tool', hint: 'audit' },
]

const VOICE_RULES = [
  'Open with a concrete moment, tension, or practical problem.',
  'Move from lived observation to system diagnosis and a practical path forward.',
  'Keep private-derived context as influence only; do not quote raw private material.',
  'Avoid generic AI hype, formulaic signposting, and empty uplift language.',
  'End with a specific question or next action.',
]

export function normalizeContentPackageOutputs(value?: string[] | ContentPackageOutputType[] | null): ContentPackageOutputType[] {
  const incoming = Array.isArray(value) ? value : DEFAULT_OUTPUTS
  const valid = incoming.filter((item): item is ContentPackageOutputType =>
    CONTENT_PACKAGE_OUTPUT_TYPES.includes(item as ContentPackageOutputType)
  )
  return [...new Set(valid.length ? valid : DEFAULT_OUTPUTS)]
}

export function buildContentPackage(input: BuildContentPackageInput): GeneratedContentPackage {
  const transcriptText = cleanText(input.transcriptText)
  if (transcriptText.length < 10) {
    throw new Error('Transcript or notes must be at least 10 characters.')
  }

  const targetOutputs = normalizeContentPackageOutputs(input.targetOutputs)
  const frameworkIds = normalizeFrameworkIds(input.frameworkIds)
  const frameworks = frameworkIds
    .map((id) => DEFAULT_CONTENT_FRAMEWORKS.find((framework) => framework.id === id))
    .filter((framework): framework is ContentFramework => Boolean(framework))

  const title = deriveTitle(input.title, input.topicHint, transcriptText)
  const audience = cleanText(input.targetAudience || 'founders, operators, product leaders, nonprofit leaders, and builders')
  const topic = cleanText(input.topicHint || firstSentence(transcriptText))
  const keyInsight = deriveKeyInsight(transcriptText, topic)
  const proofRoutes = selectProofRoutes(transcriptText, targetOutputs)
  const brollHints = proofRoutes.map((route) => route.hint)
  const hook = buildHook(topic)
  const cta = 'Where could this kind of system remove burden in your work right now?'

  const frameworkSummary = frameworks.map((framework) => ({
    id: framework.id,
    display_name: framework.displayName,
    creator_name: framework.creatorName,
    category: framework.category,
    summary: framework.summary,
    usage_guidance: framework.usageGuidance,
    source_urls: framework.sourceUrls,
  }))

  const sourcePacket = {
    source_type: input.audioStoragePath ? 'voice_note' : 'text_note',
    title,
    topic,
    transcript_excerpt: truncate(transcriptText, 1200),
    transcript_characters: transcriptText.length,
    audio_storage_path: input.audioStoragePath ?? null,
    audio_file_name: input.audioFileName ?? null,
    target_audience: audience,
    target_outputs: targetOutputs,
    framework_ids: frameworkIds,
    voice_rules: VOICE_RULES,
    privacy_boundary:
      'Private corpus and Chronicle can inform framing, but public outputs must not quote raw private material without explicit approval.',
  }

  const researchPacket = {
    generated_without_live_research: true,
    research_instructions:
      'Before final publishing, Askia should add current public sources for time-sensitive claims and attach citations to this packet.',
    source_candidates: [
      ...frameworks.flatMap((framework) => framework.sourceUrls),
      'https://amadutown.com/',
    ],
    framework_summary: frameworkSummary,
    chronicle: {
      status: input.chronicleNotes?.length ? 'sanitized_notes_attached' : 'not_checked_or_unavailable',
      notes: input.chronicleNotes ?? [],
      boundary: 'Use only sanitized derived observations and route-level proof notes, not raw screen text or screenshots.',
    },
    amadutown_proof_routes: proofRoutes,
    broll_hints: brollHints,
  }

  const outputs = buildOutputs({
    title,
    topic,
    keyInsight,
    hook,
    cta,
    transcriptText,
    audience,
    targetOutputs,
    frameworks,
    proofRoutes,
    brollHints,
  })

  const presentationPlan = targetOutputs.includes('pptx_deck')
    ? buildPresentationPlan(title, keyInsight, proofRoutes)
    : {}

  return {
    title,
    sourcePacket,
    researchPacket,
    frameworkIds,
    targetOutputs,
    outputs,
    presentationPlan,
  }
}

interface OutputContext {
  title: string
  topic: string
  keyInsight: string
  hook: string
  cta: string
  transcriptText: string
  audience: string
  targetOutputs: ContentPackageOutputType[]
  frameworks: ContentFramework[]
  proofRoutes: Array<{ route: string; label: string; hint: string }>
  brollHints: string[]
}

function buildOutputs(ctx: OutputContext): ContentPackageOutputDraft[] {
  const outputs: ContentPackageOutputDraft[] = []
  const frameworkLine = ctx.frameworks.length
    ? `Framework influence: ${ctx.frameworks.map((framework) => `${framework.creatorName} - ${framework.displayName}`).join('; ')}.`
    : 'Framework influence: Vambah voice system and AmaduTown operating proof.'
  const proofLine = ctx.proofRoutes.map((route) => `${route.label} (${route.route})`).join(', ')

  if (ctx.targetOutputs.includes('linkedin_post')) {
    const body = [
      ctx.hook,
      '',
      firstParagraph(ctx.transcriptText),
      '',
      `That is the system hiding underneath this idea: ${ctx.keyInsight}`,
      '',
      `For AmaduTown, the practical move is to turn one raw note into a governed content package. Transcript. Framework. Research. Proof routes. Approval gates. Then the format can change without losing the source.`,
      '',
      frameworkLine,
      '',
      `The point is simple: technology should reduce the distance between insight and useful action. It should not create another workflow that depends on memory, screenshots, and scattered notes.`,
      '',
      ctx.cta,
      '',
      '#AIProduct #ProductManagement #AmadutownAdvisory #DigitalEquity',
    ].join('\n')
    outputs.push({
      outputType: 'linkedin_post',
      title: `${ctx.title} - LinkedIn post`,
      body,
      downstreamType: 'social_content_queue',
      requiredApproval: 'script',
      payload: {
        platform: 'linkedin',
        cta_text: ctx.cta,
        hashtags: ['#AIProduct', '#ProductManagement', '#AmadutownAdvisory', '#DigitalEquity'],
        content_pillar: 'ai_product_management',
        proof_routes: ctx.proofRoutes,
      },
    })
  }

  if (ctx.targetOutputs.includes('linkedin_carousel')) {
    const slides = [
      { type: 'cover', headline: truncate(ctx.title, 64), subhead: ctx.keyInsight },
      { type: 'hook', headline: 'One Note, Many Assets', body: 'The raw idea is the source. The outputs are just packaging.' },
      { type: 'principle', number: 1, headline: 'Capture the source', body: 'Record the note, preserve the transcript, and keep raw material separate from public copy.' },
      { type: 'principle', number: 2, headline: 'Apply the frame', body: 'Use frameworks to structure the idea, not to erase the original voice.' },
      { type: 'principle', number: 3, headline: 'Attach proof', body: `Tie the claim back to Portfolio routes like ${proofLine || 'Agent Ops and content generation surfaces'}.` },
      { type: 'principle', number: 4, headline: 'Gate the action', body: 'Approve the packet, then media, then publishing. Agents should not approve their own work.' },
      { type: 'cta', headline: 'Build the system', body: ctx.cta },
    ]
    outputs.push({
      outputType: 'linkedin_carousel',
      title: `${ctx.title} - LinkedIn carousel`,
      body: slides.map((slide) => `${slide.headline}: ${slide.body ?? slide.subhead ?? ''}`).join('\n'),
      downstreamType: 'social_content_queue',
      requiredApproval: 'script',
      payload: { slides, proof_routes: ctx.proofRoutes },
    })
  }

  if (ctx.targetOutputs.includes('pptx_deck')) {
    const plan = buildPresentationPlan(ctx.title, ctx.keyInsight, ctx.proofRoutes)
    outputs.push({
      outputType: 'pptx_deck',
      title: `${ctx.title} - PPTX deck brief`,
      body: [
        `Thesis: ${ctx.keyInsight}`,
        '',
        'Slide spine:',
        ...(plan.coursePlan as string[]).map((item, index) => `${index + 1}. ${item}`),
        '',
        'Required proof:',
        ...(plan.requiredAssets as string[]).map((item) => `- ${item}`),
      ].join('\n'),
      downstreamType: 'presentation_plan',
      requiredApproval: 'media',
      payload: plan,
    })
  }

  if (ctx.targetOutputs.includes('video_script') || ctx.targetOutputs.includes('heygen_video') || ctx.targetOutputs.includes('elevenlabs_audio')) {
    const script = [
      ctx.hook,
      '',
      `I was thinking through this idea from a voice note: ${ctx.topic}.`,
      '',
      firstParagraph(ctx.transcriptText),
      '',
      `The practical lesson is this: ${ctx.keyInsight}`,
      '',
      `At AmaduTown, the system has to capture the note, add the right framework, pull in source-backed context, map the proof to real Portfolio surfaces, and hold the publishing gate until a human approves it.`,
      '',
      `That is how AI becomes leverage without becoming noise.`,
      '',
      ctx.cta,
    ].join('\n')

    outputs.push({
      outputType: 'video_script',
      title: `${ctx.title} - video script`,
      body: script,
      downstreamType: 'video_ideas_queue',
      requiredApproval: 'script',
      payload: {
        storyboard: {
          scenes: [
            { sceneNumber: 1, description: 'Open on the raw voice-note idea.', brollHint: 'home' },
            { sceneNumber: 2, description: 'Show source packet and approval workflow.', brollHint: 'agent ops' },
            { sceneNumber: 3, description: 'Show social and presentation output paths.', brollHint: 'social content' },
            { sceneNumber: 4, description: 'Close with AmaduTown proof and call to action.', brollHint: ctx.brollHints[0] ?? 'services' },
          ],
        },
        broll_hints: ctx.brollHints,
      },
    })
  }

  if (ctx.targetOutputs.includes('heygen_video')) {
    outputs.push({
      outputType: 'heygen_video',
      title: `${ctx.title} - HeyGen handoff`,
      body: 'Generate a HeyGen avatar video only after the script packet and media generation approval are approved.',
      downstreamType: 'video_ideas_queue',
      requiredApproval: 'media',
      payload: {
        provider: 'heygen',
        required_inputs: ['approved video script', 'avatar_id or default avatar', 'voice_id or default voice', 'broll_asset_ids'],
        approval_boundary: 'No HeyGen job should be created until content_package_media_generation is approved.',
      },
    })
  }

  if (ctx.targetOutputs.includes('elevenlabs_audio')) {
    outputs.push({
      outputType: 'elevenlabs_audio',
      title: `${ctx.title} - ElevenLabs audio handoff`,
      body: 'Generate voiceover audio only after the script packet and media generation approval are approved.',
      requiredApproval: 'media',
      payload: {
        provider: 'elevenlabs',
        voice: 'default personal voice',
        approval_boundary: 'No ElevenLabs generation should run until content_package_media_generation is approved.',
      },
    })
  }

  if (ctx.targetOutputs.includes('newsletter_blurb')) {
    outputs.push({
      outputType: 'newsletter_blurb',
      title: `${ctx.title} - newsletter blurb`,
      body: `${ctx.keyInsight} This started as a voice-note idea and became a source-backed content package with proof routes, framework context, and approval gates.`,
      requiredApproval: 'publish',
      payload: { cta: ctx.cta },
    })
  }

  if (ctx.targetOutputs.includes('email_draft')) {
    outputs.push({
      outputType: 'email_draft',
      title: `${ctx.title} - email draft`,
      body: `Subject: ${ctx.title}\n\n${ctx.keyInsight}\n\nI am building this as a repeatable content system: capture the idea, structure it, attach proof, and only publish once the packet is approved.\n\n${ctx.cta}`,
      requiredApproval: 'publish',
      payload: { audience: ctx.audience },
    })
  }

  if (ctx.targetOutputs.includes('short_caption')) {
    outputs.push({
      outputType: 'short_caption',
      title: `${ctx.title} - short caption`,
      body: `${ctx.keyInsight} One voice note should be enough to create the post, deck, script, and proof packet - with approval before anything ships.`,
      requiredApproval: 'publish',
      payload: { max_length: 280 },
    })
  }

  return outputs
}

function buildPresentationPlan(title: string, thesis: string, proofRoutes: Array<{ route: string; label: string }>): Record<string, unknown> {
  const input: PresentationBakeoffInput = {
    title,
    thesis,
    audience: 'public_audience',
    format: 'thought_leadership',
    durationMinutes: 20,
    proofAssets: proofRoutes.map((route) => route.label),
    demoRoutes: proofRoutes.map((route) => route.route),
    sourceAnchors: ['Voice-note transcript', 'Framework registry', 'AmaduTown proof routes'],
    brandSystem: 'amadutown',
    needsEditablePptx: true,
    needsLiveDemos: true,
    needsSourceValidation: true,
    needsFacilitatorNotes: true,
  }
  return buildPresentationBakeoffPlan(input) as unknown as Record<string, unknown>
}

function normalizeFrameworkIds(ids?: string[] | null): string[] {
  const incoming = Array.isArray(ids) && ids.length > 0
    ? ids
    : ['alex-hormozi-value-equation', 'nick-saraev-ai-content-engine']
  const valid = incoming.filter((id) => DEFAULT_CONTENT_FRAMEWORKS.some((framework) => framework.id === id))
  return [...new Set(valid.length ? valid : ['alex-hormozi-value-equation'])]
}

function selectProofRoutes(text: string, outputs: ContentPackageOutputType[]) {
  const lower = text.toLowerCase()
  const selected = AMADUTOWN_PROOF_ROUTES.filter((route) => lower.includes(route.hint))
  if (outputs.includes('pptx_deck')) selected.push(AMADUTOWN_PROOF_ROUTES[3])
  if (outputs.includes('heygen_video') || outputs.includes('video_script')) selected.push(AMADUTOWN_PROOF_ROUTES[2])
  selected.push(AMADUTOWN_PROOF_ROUTES[0], AMADUTOWN_PROOF_ROUTES[1])
  const seen = new Set<string>()
  return selected.filter((route) => {
    if (seen.has(route.route)) return false
    seen.add(route.route)
    return true
  }).slice(0, 5)
}

function deriveTitle(title: string | null | undefined, topicHint: string | null | undefined, text: string): string {
  const candidate = cleanText(title || topicHint || firstSentence(text))
  const clipped = truncate(candidate, 72).replace(/[.?!]+$/, '')
  return clipped || 'Voice-note content package'
}

function deriveKeyInsight(text: string, topic: string): string {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(cleanText)
    .filter((sentence) => sentence.length > 20)
  const source = sentences.find((sentence) => /system|access|ai|automation|content|client|community|workflow/i.test(sentence))
    ?? sentences[0]
    ?? topic
  return `Raw ideas become useful when they are captured, structured, grounded in proof, and routed through the right approval gate. ${truncate(source, 180)}`
}

function buildHook(topic: string): string {
  return `A voice note is not just a reminder. It can be the first draft of a system.`
}

function firstSentence(text: string): string {
  return cleanText(text.split(/(?<=[.!?])\s+/)[0] ?? text)
}

function firstParagraph(text: string): string {
  const paragraph = text.split(/\n{2,}/).map(cleanText).find(Boolean) ?? text
  return truncate(paragraph, 420)
}

function cleanText(value: string | null | undefined): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return value.slice(0, Math.max(0, max - 3)).trimEnd() + '...'
}
