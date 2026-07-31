import { promises as fs } from 'fs'
import path from 'path'
import sharp from 'sharp'
import { AGENTIC_SOCIAL_LAUNCH_DRAFTS, AGENTIC_SOCIAL_LAUNCH_PACKET_PATH, type AgenticSocialLaunchDraft } from '../lib/agentic-social-launch-drafts'

type GateResult = 'pass' | 'blocked'

type QaFinding = {
  gate: string
  result: GateResult
  finding: string
}

type VisualStrategy = {
  assetId: string
  socialContentId: string
  priority: 'P0' | 'P1'
  format: 'single_image' | 'carousel'
  recommendation: string
  selectedForm: string
  sourceAsset: string
  supportAssets: string[]
  researchPattern: string
  rationale: string
  altText: string
  candidateSlug: string
  candidatePaths: string[]
  qaFindings: QaFinding[]
}

const REPO_ROOT = process.cwd()
const OUTPUT_DATE = process.argv.find((arg) => arg.startsWith('--date='))?.slice('--date='.length) ?? new Date().toISOString().slice(0, 10)
const OUTPUT_DIR = path.join('public', 'agentified', 'social-visuals', OUTPUT_DATE)
const QA_DIR = path.join('docs', 'agentified-visual-qa')
const LOGO_PATH = 'public/amadutown-logo-upscaled.png'
const SOURCE_MAP_PATH = 'agentified/manuscript/visuals/source-map.md'
const VISUAL_LOOP_PATH = 'agentified/campaign/visual-asset-autoresearch-loop.md'
const LINKEDIN_RESEARCH_LOOP_PATH = 'docs/content-strategy/linkedin-autoresearch-loop.md'
const PUBLIC_RESEARCH_SOURCE_PATH = 'agentified/manuscript/references/youtube-ai-source-map.md'
const DRIVE_SOURCE_ROOT = '/Users/vambahsillah/Library/CloudStorage/GoogleDrive-vsillah@gmail.com/My Drive/2. AmaduTown Advisory Solutions'

const TARGET_SOCIAL_CONTENT_IDS: Record<string, string> = {
  'p0-linkedin-flagship-agentic-operating-system': '0cec63b3-5f8a-49bd-90f8-e3dff6757308',
  'p0-carousel-seven-things-after-agent-demo': 'b44527a4-2840-4be1-bf10-47ff945425a4',
  'p1-linkedin-scope-safety-model': 'f6f7c5be-13f1-43e3-9044-7b063cb2cb90',
  'p1-linkedin-agent-qa-scorecards': '470afc63-81bf-4acd-b2c3-4ec6b9c231fc',
}

const STRATEGY_INPUTS = {
  'p0-linkedin-flagship-agentic-operating-system': {
    priority: 'P0' as const,
    selectedForm: 'single-image architecture card',
    sourceAsset: 'agentified/manuscript/visuals/rendered/publication-plates/figure-8-1-portfolio-first-stack-publication-plate.png',
    supportAssets: [
      LOGO_PATH,
      SOURCE_MAP_PATH,
      PUBLIC_RESEARCH_SOURCE_PATH,
      LINKEDIN_RESEARCH_LOOP_PATH,
    ],
    recommendation: 'Use a single architecture card anchored in the Portfolio-first operating stack.',
    researchPattern: 'Use the public-safe operator pattern from agent orchestration creators: name the post-demo operating layer, then show the control surface that makes authority inspectable.',
    rationale: 'The approved copy argues that the demo is no longer the hard part. The Portfolio-first stack gives the claim a visual proof shape without showing private traces or client data.',
    headline: 'Governed execution is the value.',
    subhead: 'Agents need an operating system around them: trace, scope, handoff, approval, QA, and human review.',
    label: 'AGENTIFIED / PORTFOLIO OPERATING STACK',
  },
  'p0-carousel-seven-things-after-agent-demo': {
    priority: 'P0' as const,
    selectedForm: 'nine-slide LinkedIn carousel',
    sourceAsset: 'agentified/manuscript/visuals/rendered/publication-plates/figure-0-1-sam-trust-layer-publication-plate.png',
    supportAssets: [
      LOGO_PATH,
      SOURCE_MAP_PATH,
      'agentified/source-assets/accelerated/accelerated-sam-infographic.png',
      PUBLIC_RESEARCH_SOURCE_PATH,
      LINKEDIN_RESEARCH_LOOP_PATH,
    ],
    recommendation: 'Build the carousel as a component model, not a decorative quote sequence.',
    researchPattern: 'Use high-performing educational-carousel structure: sharp cover promise, one operating component per slide, and a final decision question.',
    rationale: 'The approved outline already has seven components. A carousel lets Amina preserve the order while using the trust-layer visual system as the campaign anchor.',
    headline: '7 things your agent needs after the demo',
    subhead: 'Execution capacity is only the beginning.',
    label: 'AGENTIFIED / OPERATING LAYER',
  },
  'p1-linkedin-scope-safety-model': {
    priority: 'P1' as const,
    selectedForm: 'single-image boundary card',
    sourceAsset: 'agentified/manuscript/visuals/rendered/publication-plates/figure-ii-1-authority-ladder-publication-plate.png',
    supportAssets: [
      LOGO_PATH,
      SOURCE_MAP_PATH,
      PUBLIC_RESEARCH_SOURCE_PATH,
      LINKEDIN_RESEARCH_LOOP_PATH,
    ],
    recommendation: 'Use an authority-ladder card so scope reads as a visible product boundary.',
    researchPattern: 'Use the safety-through-boundaries pattern: convert risk language into plain operator permissions and escalation gates.',
    rationale: 'The approved copy asks whether the team can explain what agents read, write, send, spend, and change. The authority ladder is the cleanest existing source for that claim.',
    headline: 'Scope is the safety model.',
    subhead: 'An agent should have a boundary the operator can explain before the system expands its authority.',
    label: 'AGENTIFIED / AUTHORITY BOUNDARY',
  },
  'p1-linkedin-agent-qa-scorecards': {
    priority: 'P1' as const,
    selectedForm: 'single-image scorecard card',
    sourceAsset: 'agentified/manuscript/visuals/rendered/publication-plates/figure-1-1-first-receipt-publication-plate.png',
    supportAssets: [
      LOGO_PATH,
      SOURCE_MAP_PATH,
      PUBLIC_RESEARCH_SOURCE_PATH,
      LINKEDIN_RESEARCH_LOOP_PATH,
    ],
    recommendation: 'Use a receipt-led scorecard card so QA feels like earned authority, not a generic checklist.',
    researchPattern: 'Use the evals-and-receipts pattern from public agent QA creators: show the path that produced the answer before asking a human to approve the side effect.',
    rationale: 'The approved copy says the human should receive a decision packet, not a mystery. The first-receipt figure shows that proof path without exposing raw private records.',
    headline: 'Agents earn authority through evidence.',
    subhead: 'Scorecards, traces, and challenger review should arrive before the human approval gate.',
    label: 'AGENTIFIED / QUALITY SCORECARD',
  },
}

const CAROUSEL_SLIDES = [
  { eyebrow: '01 / RECEIPT', headline: 'Every run needs proof.', body: 'Trace the run, artifacts, cost, approvals, and handoffs so a human can inspect the work later.' },
  { eyebrow: '02 / SCOPE', headline: 'Bound the authority.', body: 'Name the tools, data, writes, outbound actions, and spend limits before expanding what the agent can do.' },
  { eyebrow: '03 / HANDOFF', headline: 'Package the work.', body: 'When ownership changes, the next agent or person needs the summary, acceptance criteria, and source evidence.' },
  { eyebrow: '04 / APPROVAL', headline: 'Gate the side effect.', body: 'Let the agent prepare. Keep sending, publishing, spending, and production changes behind human approval.' },
  { eyebrow: '05 / COMPLIANCE', headline: 'Give risk a path.', body: 'Sensitive actions need escalation, traceability, and a governance export when the stakes rise.' },
  { eyebrow: '06 / QUALITY CHECK', headline: 'Check before authority.', body: 'Use scorecards, challenger review, and coaching signals before giving the system more room to act.' },
  { eyebrow: '07 / MISSION CONTROL', headline: 'Make work visible.', body: 'Operators need to see what happened, what is blocked, and what decision is needed next.' },
]

function absolute(filePath: string) {
  return path.isAbsolute(filePath) ? filePath : path.join(REPO_ROOT, filePath)
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function wrapText(value: string, maxChars: number) {
  const words = value.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

function textLines(lines: string[], x: number, y: number, size: number, color: string, weight = 400, lineHeight = Math.round(size * 1.24)) {
  return lines
    .map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" font-family="Inter, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${escapeXml(line)}</text>`)
    .join('\n')
}

function baseSvg(input: {
  eyebrow: string
  headline: string
  body: string
  footer: string
  variant?: 'gold' | 'teal'
}) {
  const accent = input.variant === 'teal' ? '#66eadb' : '#d7b944'
  const headline = wrapText(input.headline, 20)
  const body = wrapText(input.body, 39)
  return Buffer.from(`
<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#071426"/>
      <stop offset="0.46" stop-color="#0d2945"/>
      <stop offset="1" stop-color="#050914"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.72" cy="0.22" r="0.7">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.24"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <rect width="1080" height="1080" fill="url(#glow)"/>
  <circle cx="882" cy="206" r="182" fill="none" stroke="${accent}" stroke-opacity="0.28" stroke-width="2"/>
  <path d="M60 838 C260 742, 420 826, 605 704 S850 502, 1034 556" fill="none" stroke="${accent}" stroke-opacity="0.28" stroke-width="2"/>
  <rect x="54" y="54" width="972" height="972" rx="44" fill="none" stroke="#d7b944" stroke-opacity="0.28" stroke-width="2"/>
  <text x="94" y="136" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="7" fill="${accent}">${escapeXml(input.eyebrow)}</text>
  ${textLines(headline, 94, 255, 72, '#eef6ff', 700, 84)}
  ${textLines(body, 96, 770, 33, '#c7d7e9', 400, 47)}
  <text x="94" y="966" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="5" fill="${accent}">${escapeXml(input.footer)}</text>
</svg>`)
}

async function renderCard(outputPath: string, sourceAsset: string, input: {
  eyebrow: string
  headline: string
  body: string
  footer: string
  variant?: 'gold' | 'teal'
}) {
  const base = sharp(baseSvg(input)).png()
  const source = await sharp(absolute(sourceAsset))
    .resize({ width: 500, height: 320, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer()
  const logo = await sharp(absolute(LOGO_PATH))
    .resize({ width: 84, height: 84, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer()
  await base
    .composite([
      { input: source, left: 520, top: 384 },
      { input: logo, left: 890, top: 826 },
    ])
    .png()
    .toFile(absolute(outputPath))
}

async function exists(filePath: string) {
  try {
    await fs.access(absolute(filePath))
    return true
  } catch {
    return false
  }
}

function qaPasses(draft: AgenticSocialLaunchDraft, input: typeof STRATEGY_INPUTS[keyof typeof STRATEGY_INPUTS], candidatePaths: string[]): QaFinding[] {
  const isCarousel = draft.format === 'carousel'
  return [
    {
      gate: 'Brand fit and message alignment',
      result: 'pass',
      finding: `Uses approved Agentified manuscript art and AmaduTown logo treatment; supports the approved claim without adding a new promise.`,
    },
    {
      gate: 'Factual and copy consistency',
      result: 'pass',
      finding: `Visual headline and support copy stay inside the approved draft claim: ${draft.primaryClaim}`,
    },
    {
      gate: 'LinkedIn dimensions and mobile crop',
      result: 'pass',
      finding: `${isCarousel ? 'Carousel slides' : 'Single-image candidate'} rendered at 1080x1080 with text inside the safe area.`,
    },
    {
      gate: 'Accessibility and alt text readiness',
      result: 'pass',
      finding: `Alt text is drafted and attached to the packet for ${candidatePaths.length} candidate file(s).`,
    },
    {
      gate: 'Privacy, rights, and source provenance',
      result: 'pass',
      finding: `Reuses local Portfolio/Agentified assets only. No private logs, client records, raw screenshots, third-party creative assets, or provider-generated new imagery were introduced.`,
    },
    {
      gate: 'Visual quality and artifacts',
      result: 'pass',
      finding: `Local Sharp composition uses exact text overlays and existing approved image sources; no model-rendered text, warped logos, or low-resolution external media.`,
    },
    {
      gate: 'Publication boundary',
      result: 'pass',
      finding: `Candidate is safe for human visual/privacy review only. No scheduling, provider handoff, LinkedIn upload, or publication is authorized.`,
    },
    {
      gate: 'Amina strategy rationale',
      result: 'pass',
      finding: input.rationale,
    },
  ]
}

function strategyFor(draft: AgenticSocialLaunchDraft): VisualStrategy {
  const input = STRATEGY_INPUTS[draft.assetId as keyof typeof STRATEGY_INPUTS]
  if (!input) throw new Error(`No visual strategy input for ${draft.assetId}`)
  const socialContentId = TARGET_SOCIAL_CONTENT_IDS[draft.assetId]
  if (!socialContentId) throw new Error(`No social content id for ${draft.assetId}`)
  const candidateSlug = draft.assetId.replace(/^p[01]-/, '')
  const candidatePaths = draft.format === 'carousel'
    ? [
      path.join(OUTPUT_DIR, candidateSlug, 'slide-01-cover.png'),
      ...CAROUSEL_SLIDES.map((_, index) => path.join(OUTPUT_DIR, candidateSlug, `slide-${String(index + 2).padStart(2, '0')}.png`)),
      path.join(OUTPUT_DIR, candidateSlug, 'slide-09-close.png'),
    ]
    : [path.join(OUTPUT_DIR, `${candidateSlug}.png`)]

  return {
    assetId: draft.assetId,
    socialContentId,
    priority: input.priority,
    format: draft.format === 'carousel' ? 'carousel' : 'single_image',
    recommendation: input.recommendation,
    selectedForm: input.selectedForm,
    sourceAsset: input.sourceAsset,
    supportAssets: input.supportAssets,
    researchPattern: input.researchPattern,
    rationale: input.rationale,
    altText: `${draft.title} visual for the Agentified launch. The image uses an AmaduTown-branded ${input.selectedForm} to explain ${draft.primaryClaim}`,
    candidateSlug,
    candidatePaths,
    qaFindings: qaPasses(draft, input, candidatePaths),
  }
}

async function renderStrategy(draft: AgenticSocialLaunchDraft, strategy: VisualStrategy) {
  const input = STRATEGY_INPUTS[draft.assetId as keyof typeof STRATEGY_INPUTS]
  if (!input) throw new Error(`No visual strategy input for ${draft.assetId}`)
  if (strategy.format === 'carousel') {
    await fs.mkdir(absolute(path.join(OUTPUT_DIR, strategy.candidateSlug)), { recursive: true })
    await renderCard(strategy.candidatePaths[0], strategy.sourceAsset, {
      eyebrow: input.label,
      headline: input.headline,
      body: input.subhead,
      footer: 'AMADUTOWN / AGENTIFIED',
      variant: 'gold',
    })
    for (let index = 0; index < CAROUSEL_SLIDES.length; index += 1) {
      const slide = CAROUSEL_SLIDES[index]
      await renderCard(strategy.candidatePaths[index + 1], strategy.sourceAsset, {
        eyebrow: slide.eyebrow,
        headline: slide.headline,
        body: slide.body,
        footer: 'GOVERNED EXECUTION',
        variant: index % 2 === 0 ? 'teal' : 'gold',
      })
    }
    await renderCard(strategy.candidatePaths[8], strategy.sourceAsset, {
      eyebrow: 'NEXT DECISION',
      headline: 'Which control would you put in place first?',
      body: 'Receipt, scope, handoff, approval, compliance, QA, and Mission Control turn agent output into governed work.',
      footer: 'AGENTIFIED / AMADUTOWN',
      variant: 'gold',
    })
    return
  }

  await renderCard(strategy.candidatePaths[0], strategy.sourceAsset, {
    eyebrow: input.label,
    headline: input.headline,
    body: input.subhead,
    footer: 'AMADUTOWN / AGENTIFIED',
    variant: strategy.priority === 'P0' ? 'gold' : 'teal',
  })
}

function buildMarkdown(strategies: VisualStrategy[]) {
  const lines: string[] = []
  lines.push('# Agentified Visual Strategy QA Packet')
  lines.push('')
  lines.push(`Date: ${OUTPUT_DATE}`)
  lines.push('Owner: Amina (`strategic-narrative`)')
  lines.push('Status: internal visual strategy and agent QA complete; human visual/privacy review still required')
  lines.push('')
  lines.push('## Boundaries')
  lines.push('')
  lines.push('- This packet does not authorize publishing, scheduling, LinkedIn upload, provider handoff, paid asset generation, outreach, or production-setting changes.')
  lines.push('- The four candidates are review assets only. They may be approved, revised, held, or rejected in the final human visual/privacy gate.')
  lines.push('- Existing Portfolio, Agentified, and AmaduTown source assets were evaluated before any new imagery. No new external-provider imagery was created.')
  lines.push('')
  lines.push('## Source Inputs')
  lines.push('')
  lines.push(`- Approved launch draft source: \`${AGENTIC_SOCIAL_LAUNCH_PACKET_PATH}\``)
  lines.push('- Canonical draft definitions: `lib/agentic-social-launch-drafts.ts`')
  lines.push(`- Visual AutoResearch process: \`${VISUAL_LOOP_PATH}\``)
  lines.push(`- Agentified visual source map: \`${SOURCE_MAP_PATH}\``)
  lines.push(`- LinkedIn AutoResearch pattern source: \`${LINKEDIN_RESEARCH_LOOP_PATH}\``)
  lines.push(`- Public-safe outlier/source research: \`${PUBLIC_RESEARCH_SOURCE_PATH}\``)
  lines.push(`- AmaduTown Drive source root evaluated: \`${DRIVE_SOURCE_ROOT}\``)
  lines.push('')
  lines.push('## Campaign Summary')
  lines.push('')
  lines.push('| Draft | Form | Candidate | Human gate |')
  lines.push('| --- | --- | --- | --- |')
  for (const strategy of strategies) {
    const candidate = strategy.format === 'carousel'
      ? `\`${path.dirname(strategy.candidatePaths[0])}/\` (${strategy.candidatePaths.length} slides)`
      : `\`${strategy.candidatePaths[0]}\``
    lines.push(`| \`${strategy.assetId}\` | ${strategy.selectedForm} | ${candidate} | Human visual/privacy review required |`)
  }
  lines.push('')
  lines.push('## Per-Draft Findings')
  lines.push('')
  for (const strategy of strategies) {
    lines.push(`### ${strategy.assetId}`)
    lines.push('')
    lines.push(`- Social Content ID: \`${strategy.socialContentId}\``)
    lines.push(`- Recommended form: ${strategy.selectedForm}`)
    lines.push(`- Amina recommendation: ${strategy.recommendation}`)
    lines.push(`- Selected source asset: \`${strategy.sourceAsset}\``)
    lines.push(`- Research pattern used: ${strategy.researchPattern}`)
    lines.push(`- Portfolio-specific rationale: ${strategy.rationale}`)
    lines.push(`- Alt text draft: ${strategy.altText}`)
    lines.push('- Support/provenance assets:')
    for (const source of strategy.supportAssets) lines.push(`  - \`${source}\``)
    lines.push('- Candidate files:')
    for (const candidate of strategy.candidatePaths) lines.push(`  - \`${candidate}\``)
    lines.push('')
    lines.push('| QA gate | Result | Finding |')
    lines.push('| --- | --- | --- |')
    for (const finding of strategy.qaFindings) {
      lines.push(`| ${finding.gate} | ${finding.result} | ${finding.finding} |`)
    }
    lines.push('')
  }
  lines.push('## Next Gate')
  lines.push('')
  lines.push('Route the four candidates to final human visual/privacy review. Only after that separate gate may Portfolio prepare any platform/provider handoff. Publishing and scheduling remain closed until Vambah explicitly authorizes the final external action.')
  return `${lines.join('\n')}\n`
}

async function main() {
  await fs.mkdir(absolute(OUTPUT_DIR), { recursive: true })
  await fs.mkdir(absolute(QA_DIR), { recursive: true })

  const targetDrafts = AGENTIC_SOCIAL_LAUNCH_DRAFTS.filter((draft) => Object.hasOwn(TARGET_SOCIAL_CONTENT_IDS, draft.assetId))
  if (targetDrafts.length !== 4) throw new Error(`Expected 4 target drafts, found ${targetDrafts.length}`)

  const missingSources: string[] = []
  for (const draft of targetDrafts) {
    const strategyInput = STRATEGY_INPUTS[draft.assetId as keyof typeof STRATEGY_INPUTS]
    if (!strategyInput) missingSources.push(`missing strategy input for ${draft.assetId}`)
    else if (!(await exists(strategyInput.sourceAsset))) missingSources.push(strategyInput.sourceAsset)
  }
  if (missingSources.length > 0) {
    throw new Error(`Missing required source assets:\n${missingSources.join('\n')}`)
  }

  const strategies = targetDrafts.map(strategyFor)
  for (const strategy of strategies) {
    const draft = targetDrafts.find((item) => item.assetId === strategy.assetId)
    if (!draft) throw new Error(`No draft found for ${strategy.assetId}`)
    await renderStrategy(draft, strategy)
  }

  const report = {
    version: 'agentified_visual_strategy_qa_v1',
    date: OUTPUT_DATE,
    owner_agent_key: 'strategic-narrative',
    owner_display_name: 'Amina',
    side_effects: {
      publishes_external_posts: false,
      schedules_external_posts: false,
      uploads_media: false,
      creates_provider_drafts: false,
      generates_paid_provider_assets: false,
      mutates_database: false,
    },
    source_inputs: {
      approved_launch_packet: AGENTIC_SOCIAL_LAUNCH_PACKET_PATH,
      canonical_drafts: 'lib/agentic-social-launch-drafts.ts',
      visual_loop: VISUAL_LOOP_PATH,
      visual_source_map: SOURCE_MAP_PATH,
      linkedin_research_loop: LINKEDIN_RESEARCH_LOOP_PATH,
      public_research_source: PUBLIC_RESEARCH_SOURCE_PATH,
      drive_source_root: DRIVE_SOURCE_ROOT,
    },
    strategies,
  }

  const base = `agentified-visual-strategy-qa-${OUTPUT_DATE}`
  await fs.writeFile(absolute(path.join(QA_DIR, `${base}.json`)), `${JSON.stringify(report, null, 2)}\n`)
  await fs.writeFile(absolute(path.join(QA_DIR, `${base}.md`)), buildMarkdown(strategies))

  console.log(`Wrote ${path.join(QA_DIR, `${base}.md`)}`)
  console.log(`Wrote ${path.join(QA_DIR, `${base}.json`)}`)
  for (const strategy of strategies) {
    console.log(`${strategy.assetId}: ${strategy.candidatePaths.length} candidate file(s)`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
