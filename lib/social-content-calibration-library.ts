export type SocialContentCalibrationPlatform = 'linkedin'

export type SocialContentCalibrationReference = {
  id: string
  platform: SocialContentCalibrationPlatform
  label: string
  source_type: 'voice_guide_reference' | 'operator_approved_pattern'
  content_pillar: string
  post_excerpt: string
  engagement_signal: string
  why_it_worked: string
  claim_boundaries: string[]
  provenance: string
}

const LINKEDIN_CALIBRATION_REFERENCES: SocialContentCalibrationReference[] = [
  {
    id: 'linkedin-builder-insight-production-readiness',
    platform: 'linkedin',
    label: 'Builder insight: production readiness',
    source_type: 'voice_guide_reference',
    content_pillar: 'AI and product management',
    post_excerpt: [
      'Anyone can build an app right now.',
      '',
      'Cursor. Replit. Bolt. Lovable. You can go from idea to working product in an afternoon.',
      '',
      'That speed does not give you the infrastructure that makes something safe to hand to another human being.',
    ].join('\n'),
    engagement_signal: 'Approved voice-guide reference. Measured LinkedIn engagement has not been imported yet.',
    why_it_worked: 'It starts with a concrete builder reality, names the tools, then moves into the operational risk instead of generic AI enthusiasm.',
    claim_boundaries: [
      'Do not overstate production readiness.',
      'Keep the lesson practical and accountable.',
      'Avoid generic AI hype.',
    ],
    provenance: 'docs/linkedin-voice.md',
  },
  {
    id: 'linkedin-access-exposure-metco',
    platform: 'linkedin',
    label: 'Access and exposure: METCO bus ride',
    source_type: 'voice_guide_reference',
    content_pillar: 'Technology as equalizer',
    post_excerpt: [
      'I took a 45-minute bus ride every morning from Roxbury to a school in the suburbs.',
      '',
      'Same state. Same city limits, almost. Different planet.',
      '',
      'That ride showed me what was possible. Exposure expands the ceiling you did not know was there.',
    ].join('\n'),
    engagement_signal: 'Approved voice-guide reference. Use when the draft needs a human entry point before the systems lesson.',
    why_it_worked: 'It opens with a scene, stays plainspoken, and earns the access argument through lived experience.',
    claim_boundaries: [
      'Use personal context only when it clarifies the operational point.',
      'Do not flatten lived experience into trauma branding.',
      'Do not force the story if the draft is primarily tactical.',
    ],
    provenance: 'docs/linkedin-voice.md',
  },
  {
    id: 'linkedin-ai-reduces-burden',
    platform: 'linkedin',
    label: 'Operator burden: AI should reduce work',
    source_type: 'operator_approved_pattern',
    content_pillar: 'Entrepreneurship',
    post_excerpt: [
      'A small business does not need another AI demo.',
      '',
      'It needs fewer tabs open, fewer follow-ups lost, fewer moments where the owner has to remember what the system should have remembered.',
      '',
      'The question is not whether AI can generate output. The question is whether the work gets lighter.',
    ].join('\n'),
    engagement_signal: 'Reusable approved pattern for AmaduTown operator-facing posts. Measured engagement pending Open Brain import.',
    why_it_worked: 'It centers the operator burden, avoids tool-first messaging, and makes the value of automation concrete.',
    claim_boundaries: [
      'Do not imply autonomous outreach or publishing.',
      'Keep claims tied to work already visible in Portfolio or approved evidence.',
      'Avoid vague transformation language.',
    ],
    provenance: 'Agent Ops social outreach calibration packet',
  },
  {
    id: 'linkedin-governed-agent-work',
    platform: 'linkedin',
    label: 'Governed agents: readiness before delegation',
    source_type: 'operator_approved_pattern',
    content_pillar: 'AI and product management',
    post_excerpt: [
      'Agentic work needs a meeting before it needs a task list.',
      '',
      'Define what ready means. Name the source material. Set the authority boundary. Decide what requires a human gate.',
      '',
      'Then let the agents move.',
    ].join('\n'),
    engagement_signal: 'Reusable approved pattern for Agent Ops posts. Best for posts about Mission Control, readiness gates, and delegation.',
    why_it_worked: 'It turns the product architecture into a practical management principle with clear stages.',
    claim_boundaries: [
      'Do not suggest agents can merge, publish, send, or deploy without approval gates.',
      'Keep Shaka framed as facilitator, not autonomous executive authority.',
      'Preserve draft-only boundaries for external-facing workflows.',
    ],
    provenance: 'Agent Ops Goal Readiness Gate V1',
  },
]

export function listSocialContentCalibrationReferences(options: {
  platform?: string | null
} = {}): SocialContentCalibrationReference[] {
  const platform = options.platform?.toLowerCase()
  if (!platform || platform === 'all') return [...LINKEDIN_CALIBRATION_REFERENCES]
  if (platform !== 'linkedin') return []
  return [...LINKEDIN_CALIBRATION_REFERENCES]
}

export function getSocialContentCalibrationReferenceById(id: string) {
  return LINKEDIN_CALIBRATION_REFERENCES.find((reference) => reference.id === id) ?? null
}
