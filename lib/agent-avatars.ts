import { AGENT_ORGANIZATION } from '@/lib/agent-organization'

export type AgentAvatarTone = 'gold' | 'emerald' | 'cyan' | 'violet' | 'rose' | 'amber'

export interface AgentAvatarDefinition {
  agentKey: string
  label: string
  initials: string
  motif: string
  tone: AgentAvatarTone
  culturalCue: string
  imagePath: string
}

const AVATAR_TONES: Record<AgentAvatarTone, { ring: string; wash: string; mark: string }> = {
  gold: { ring: '#d8b42c', wash: '#332a12', mark: '#f6d34c' },
  emerald: { ring: '#40c58a', wash: '#123326', mark: '#82f0bd' },
  cyan: { ring: '#4db7e8', wash: '#102c3b', mark: '#9ce3ff' },
  violet: { ring: '#a78bfa', wash: '#241b3d', mark: '#c4b5fd' },
  rose: { ring: '#fb7185', wash: '#3a1620', mark: '#fecdd3' },
  amber: { ring: '#f59e0b', wash: '#3a260a', mark: '#fde68a' },
}

const AGENT_AVATAR_SEEDS: Record<string, Omit<AgentAvatarDefinition, 'imagePath'>> = {
  'chief-of-staff': {
    agentKey: 'chief-of-staff',
    label: 'Illustrated avatar for Shaka, Chief of Staff',
    initials: 'SZ',
    motif: 'shield',
    tone: 'gold',
    culturalCue: 'Zulu command silhouette',
  },
  'strategic-narrative': {
    agentKey: 'strategic-narrative',
    label: 'Illustrated avatar for Amina, Strategic Narrative',
    initials: 'AZ',
    motif: 'star',
    tone: 'rose',
    culturalCue: 'Zazzau leadership cue',
  },
  'proposal-business-model': {
    agentKey: 'proposal-business-model',
    label: 'Illustrated avatar for Mansa Musa, Proposal and Business Model',
    initials: 'MM',
    motif: 'coin',
    tone: 'amber',
    culturalCue: 'Mali commerce cue',
  },
  'legacy-institution-builder': {
    agentKey: 'legacy-institution-builder',
    label: 'Illustrated avatar for Sundiata Keita, Legacy Institution Builder',
    initials: 'SK',
    motif: 'arch',
    tone: 'emerald',
    culturalCue: 'Mali institution cue',
  },
  'research-source-register': {
    agentKey: 'research-source-register',
    label: 'Illustrated avatar for Askia Muhammad, Research Source Register',
    initials: 'AM',
    motif: 'scroll',
    tone: 'cyan',
    culturalCue: 'Songhai scholarship cue',
  },
  'private-knowledge-librarian': {
    agentKey: 'private-knowledge-librarian',
    label: 'Illustrated avatar for Hatshepsut, Private Knowledge Librarian',
    initials: 'HK',
    motif: 'obelisk',
    tone: 'violet',
    culturalCue: 'Kemet archive cue',
  },
  'decision-journal': {
    agentKey: 'decision-journal',
    label: 'Illustrated avatar for Nzinga, Decision Journal',
    initials: 'NM',
    motif: 'crown',
    tone: 'gold',
    culturalCue: 'Ndongo and Matamba diplomacy cue',
  },
  'risk-compliance-intelligence': {
    agentKey: 'risk-compliance-intelligence',
    label: 'Illustrated avatar for Moremi, Risk and Compliance',
    initials: 'MI',
    motif: 'eye',
    tone: 'rose',
    culturalCue: 'Ife vigilance cue',
  },
  'voice-content-architect': {
    agentKey: 'voice-content-architect',
    label: 'Illustrated avatar for Nefertiti, Voice and Content Architect',
    initials: 'NK',
    motif: 'pen',
    tone: 'violet',
    culturalCue: 'Kemet voice cue',
  },
  'content-repurposing': {
    agentKey: 'content-repurposing',
    label: 'Illustrated avatar for Hannibal, Content Repurposing',
    initials: 'HC',
    motif: 'route',
    tone: 'amber',
    culturalCue: 'Carthage campaign cue',
  },
  'amadutown-brand': {
    agentKey: 'amadutown-brand',
    label: 'Illustrated avatar for Taharqa, AmaduTown Brand',
    initials: 'TK',
    motif: 'sun',
    tone: 'gold',
    culturalCue: 'Kush brand cue',
  },
  'course-curriculum-builder': {
    agentKey: 'course-curriculum-builder',
    label: 'Illustrated avatar for Menelik, Course and Curriculum Builder',
    initials: 'ME',
    motif: 'book',
    tone: 'emerald',
    culturalCue: 'Ethiopia curriculum cue',
  },
  'engineering-copilot': {
    agentKey: 'engineering-copilot',
    label: 'Illustrated avatar for Piye, Engineering Copilot',
    initials: 'PK',
    motif: 'forge',
    tone: 'cyan',
    culturalCue: 'Kush engineering cue',
  },
  'automation-systems': {
    agentKey: 'automation-systems',
    label: 'Illustrated avatar for Yaa Asantewaa, Automation Systems',
    initials: 'YA',
    motif: 'bolt',
    tone: 'gold',
    culturalCue: 'Ashanti operations cue',
  },
  'agent-tooling-parity': {
    agentKey: 'agent-tooling-parity',
    label: 'Illustrated avatar for Ezana, Agent Tooling Parity',
    initials: 'EA',
    motif: 'link',
    tone: 'cyan',
    culturalCue: 'Aksum tooling cue',
  },
  'website-product-copy': {
    agentKey: 'website-product-copy',
    label: 'Illustrated avatar for Makeda, Website and Product Copy',
    initials: 'MS',
    motif: 'diamond',
    tone: 'violet',
    culturalCue: 'Sheba clarity cue',
  },
  'inbox-follow-up': {
    agentKey: 'inbox-follow-up',
    label: 'Illustrated avatar for Samori Toure, Inbox and Follow-Up',
    initials: 'ST',
    motif: 'signal',
    tone: 'emerald',
    culturalCue: 'Wassoulou follow-up cue',
  },
  'warm-lead-capture': {
    agentKey: 'warm-lead-capture',
    label: 'Illustrated avatar for Behanzin, Warm Lead Capture',
    initials: 'BD',
    motif: 'net',
    tone: 'amber',
    culturalCue: 'Dahomey capture cue',
  },
  'meeting-intake-follow-up': {
    agentKey: 'meeting-intake-follow-up',
    label: 'Illustrated avatar for Amanirenas, Meeting Intake and Follow-Up',
    initials: 'AK',
    motif: 'moon',
    tone: 'rose',
    culturalCue: 'Kush meeting cue',
  },
  'integration-captain': {
    agentKey: 'integration-captain',
    label: 'Illustrated avatar for the Integration Captain lane',
    initials: 'IC',
    motif: 'helm',
    tone: 'gold',
    culturalCue: 'Integration command cue',
  },
}

export const AGENT_AVATARS: Record<string, AgentAvatarDefinition> = Object.fromEntries(
  Object.entries(AGENT_AVATAR_SEEDS).map(([key, avatar]) => [
    key,
    {
      ...avatar,
      imagePath: `/agent-avatars/baroque/${key}.png`,
    },
  ]),
) as Record<string, AgentAvatarDefinition>

const DEFAULT_PUBLIC_AVATAR_BASE_URL = 'https://amadutown.com'

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '')
}

export function resolveAgentAvatarImageSrc(imagePath: string) {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_AGENT_AVATAR_ASSET_BASE_URL?.trim()
  const baseUrl =
    configuredBaseUrl ||
    (process.env.NODE_ENV === 'production' ? DEFAULT_PUBLIC_AVATAR_BASE_URL : '')

  if (!baseUrl) return imagePath
  return `${normalizeBaseUrl(baseUrl)}${imagePath}`
}

export function getAgentAvatar(agentKey: string | null | undefined): AgentAvatarDefinition {
  if (agentKey && AGENT_AVATARS[agentKey]) return AGENT_AVATARS[agentKey]
  return {
    agentKey: agentKey ?? 'unknown',
    label: 'Illustrated avatar for unassigned agent work',
    initials: 'AI',
    motif: 'node',
    tone: 'cyan',
    culturalCue: 'Unassigned work cue',
    imagePath: '/agent-avatars/unknown.svg',
  }
}

export function getAvatarToneStyles(tone: AgentAvatarTone) {
  return AVATAR_TONES[tone]
}

export function getMissingAgentAvatarKeys() {
  return AGENT_ORGANIZATION
    .map((agent) => agent.key)
    .filter((key) => !AGENT_AVATARS[key])
}
