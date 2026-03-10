/**
 * Social Content Pipeline — Types, constants, and helpers
 * Used by admin UI, API routes, and n8n workflow integration
 */

// ============================================================================
// Types
// ============================================================================

export type SocialPlatform = 'linkedin' | 'instagram' | 'facebook'

export type ContentStatus = 'draft' | 'approved' | 'scheduled' | 'published' | 'rejected'

export type FrameworkVisualType =
  | 'flowchart'
  | 'matrix'
  | 'equation'
  | 'funnel'
  | 'before_after'
  | 'architecture'
  | 'pillars'
  | 'timeline'
  | 'cycle'

export interface TopicExtracted {
  topic: string
  angle: string
  key_insight: string
  personal_tie_in: string
  framework_visual: FrameworkVisualType
}

export interface HormoziFramework {
  framework_type: string
  hook_type: string
  proof_pattern: string
  cta_pattern: string
}

export interface SocialContentItem {
  id: string
  meeting_record_id: string | null
  platform: SocialPlatform
  status: ContentStatus
  post_text: string
  cta_text: string | null
  cta_url: string | null
  hashtags: string[]
  image_url: string | null
  image_prompt: string | null
  framework_visual_type: FrameworkVisualType | null
  voiceover_url: string | null
  voiceover_text: string | null
  video_url: string | null
  topic_extracted: TopicExtracted | null
  hormozi_framework: HormoziFramework | null
  rag_context: Record<string, unknown> | null
  scheduled_for: string | null
  published_at: string | null
  platform_post_id: string | null
  admin_notes: string | null
  reviewed_by: string | null
  created_at: string
  updated_at: string
  // Joined from meeting_records when fetching detail
  meeting_record?: {
    id: string
    meeting_type: string
    meeting_date: string
    transcript: string | null
    structured_notes: unknown
    key_decisions: unknown
    attendees: unknown
  }
}

export interface SocialContentConfig {
  id: string
  platform: SocialPlatform
  credentials: Record<string, string>
  settings: Record<string, string>
  is_active: boolean
  created_at: string
  updated_at: string
}

// ============================================================================
// Constants
// ============================================================================

export const PLATFORMS: { value: SocialPlatform; label: string; enabled: boolean }[] = [
  { value: 'linkedin', label: 'LinkedIn', enabled: true },
  { value: 'instagram', label: 'Instagram', enabled: false },
  { value: 'facebook', label: 'Facebook', enabled: false },
]

export const CONTENT_STATUSES: { value: ContentStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'approved', label: 'Approved' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
]

export const STATUS_CONFIG: Record<ContentStatus, {
  label: string
  color: string
  bgColor: string
  borderColor: string
}> = {
  draft: { label: 'Draft', color: 'text-gray-400', bgColor: 'bg-gray-500/20', borderColor: 'border-gray-500/50' },
  approved: { label: 'Approved', color: 'text-blue-400', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-500/50' },
  scheduled: { label: 'Scheduled', color: 'text-amber-400', bgColor: 'bg-amber-500/20', borderColor: 'border-amber-500/50' },
  published: { label: 'Published', color: 'text-green-400', bgColor: 'bg-green-500/20', borderColor: 'border-green-500/50' },
  rejected: { label: 'Rejected', color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/50' },
}

export const FRAMEWORK_VISUAL_TYPES: { value: FrameworkVisualType; label: string; description: string }[] = [
  { value: 'flowchart', label: 'Flowchart', description: 'Process flows, decision trees, step-by-step sequences' },
  { value: 'matrix', label: 'Matrix', description: '2x2 or 3x3 grids (Effort vs Impact, Urgency vs Importance)' },
  { value: 'equation', label: 'Equation', description: 'Visual formulas (Value Equation, ROI calculations)' },
  { value: 'funnel', label: 'Funnel', description: 'Stage-based progressions (awareness to action)' },
  { value: 'before_after', label: 'Before/After', description: 'Split-screen comparisons showing transformation' },
  { value: 'architecture', label: 'Architecture', description: 'System diagrams with labeled boxes and connections' },
  { value: 'pillars', label: 'Pillars', description: 'Named columns or stacked layers (The 3 Pillars of...)' },
  { value: 'timeline', label: 'Timeline', description: 'Sequential milestones or phases' },
  { value: 'cycle', label: 'Cycle', description: 'Circular/recurring processes (feedback loops, flywheels)' },
]

// AmaduTown brand tokens for image generation prompts
export const BRAND_TOKENS = {
  colors: {
    imperialNavy: '#121E31',
    radiantGold: '#D4AF37',
    siliconSlate: '#2C3E50',
    platinumWhite: '#EAECEE',
    goldLight: '#F5D060',
    bronze: '#8B6914',
  },
  typography: {
    headings: 'Orbitron',
    premium: 'Cormorant',
    body: 'Inter',
  },
  effects: 'soft gold glow, thin gold borders, backdrop blur, rounded panels',
} as const

// ============================================================================
// Hormozi Framework Prompt Templates
// ============================================================================

export const HORMOZI_TOPIC_EXTRACTION_PROMPT = `You are an expert content strategist who follows Alex Hormozi's communication frameworks from $100M Offers and $100M Leads.

Given a meeting transcript and personal context from the creator's knowledge base, extract 1-3 social-media-worthy topics.

For each topic, provide:
1. **topic**: A one-liner describing the core idea
2. **angle**: What makes this interesting to the target audience (business owners, entrepreneurs, tech leaders)
3. **key_insight**: The transferable takeaway
4. **personal_tie_in**: How this connects to the creator's personal experience (use the RAG context provided)
5. **hormozi_framework**: Which framework applies:
   - "value_equation" — Dream Outcome × Perceived Likelihood / Time Delay × Effort & Sacrifice
   - "offer_creation" — Making an offer so good people feel stupid saying no
   - "lead_magnet" — Giving away value to attract ideal clients
   - "dream_outcome" — Painting the picture of what's possible
   - "risk_reversal" — Removing all risk from the buyer
   - "scarcity_urgency" — Creating legitimate urgency
   - "proof_stacking" — Layering evidence and social proof
6. **framework_visual**: Which diagram type best illustrates this topic:
   - "flowchart" — process flows, decision trees
   - "matrix" — 2x2 grids (effort vs impact)
   - "equation" — visual formulas
   - "funnel" — stage progressions
   - "before_after" — transformation comparisons
   - "architecture" — system diagrams
   - "pillars" — named columns/layers
   - "timeline" — sequential milestones
   - "cycle" — circular processes, flywheels

Return valid JSON array of topics. Focus on insights that would make a LinkedIn audience stop scrolling.`

export const HORMOZI_COPYWRITING_PROMPT = `You are a LinkedIn content writer who follows Alex Hormozi's communication style. Write a post that will make people stop scrolling.

RULES:
1. **Hook (first 2 lines)**: Pattern-interrupt. Use one of:
   - Contrarian take: "Most people think X. They're wrong."
   - Bold claim with number: "I [achieved X] in [timeframe]. Here's how."
   - Question that challenges: "Why do 90% of [audience] fail at [thing]?"
   - "Most people think X, but Y"

2. **Story/Proof (middle)**: Reference the real meeting insight AND weave in the personal experience from RAG context. Use specific numbers, names of frameworks, and real outcomes. Never be generic.

3. **Lesson (framework)**: Name the principle. Make it a transferable framework the reader can apply. Use the Hormozi framework provided (value equation, offer creation, etc.).

4. **CTA (last 2 lines)**: Clear, specific call to action:
   - Direct: "Book a free strategy call — link in bio"
   - Soft: "DM me 'AUDIT' and I'll send you the framework"
   - Resource: "I wrote the full playbook — grab it free at [link]"

FORMAT:
- Short paragraphs (1-2 sentences max)
- Line breaks between every thought
- No walls of text
- No emojis in the hook
- Conversational tone — write like you talk
- Include 3-5 relevant hashtags at the end
- Total length: 150-300 words (LinkedIn sweet spot)

VOICE: Confident, direct, generous with value. Teach, don't preach. Show, don't tell.`

export const FRAMEWORK_IMAGE_PROMPT_TEMPLATE = `Create a clean, professional framework illustration for a LinkedIn post.

VISUAL TYPE: {framework_visual_type}
TOPIC: {topic}
KEY ELEMENTS: {key_elements}

STYLE REQUIREMENTS:
- Background: deep navy (#121E31)
- Primary accent: gold (#D4AF37) for borders, arrows, highlights
- Secondary: slate (#2C3E50) for panels/boxes
- Text: platinum white (#EAECEE) for labels, gold (#F5D060) for emphasis
- Typography style: clean geometric sans-serif (like Orbitron)
- Aesthetic: premium, minimal, tech-forward
- Effects: subtle gold glow on key elements, thin gold borders, rounded corners
- NO stock photo elements — pure diagram/framework visual
- NO faces or people — abstract and systematic
- Aspect ratio: 1:1 (LinkedIn optimal)
- Include the topic as a title at the top in gold text

The image should look like a slide from a premium consulting deck — the kind of visual that makes people screenshot and save.`

// ============================================================================
// Helpers
// ============================================================================

export function buildImagePrompt(
  visualType: FrameworkVisualType,
  topic: string,
  keyElements: string
): string {
  return FRAMEWORK_IMAGE_PROMPT_TEMPLATE
    .replace('{framework_visual_type}', visualType)
    .replace('{topic}', topic)
    .replace('{key_elements}', keyElements)
}

export function truncateForPreview(text: string, maxLength = 280): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).replace(/\s+\S*$/, '') + '...'
}

export function formatHashtags(hashtags: string[]): string {
  return hashtags
    .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
    .join(' ')
}

export function getFullPostText(item: SocialContentItem): string {
  const parts = [item.post_text]
  if (item.cta_text) parts.push(`\n${item.cta_text}`)
  if (item.cta_url) parts.push(item.cta_url)
  if (item.hashtags?.length) parts.push(`\n${formatHashtags(item.hashtags)}`)
  return parts.join('\n')
}
