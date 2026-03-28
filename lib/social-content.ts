/**
 * Social Content Pipeline — Types, constants, and helpers
 * Used by admin UI, API routes, and n8n workflow integration
 */

// ============================================================================
// Types
// ============================================================================

export type SocialPlatform = 'linkedin' | 'instagram' | 'facebook' | 'youtube'

export type ContentStatus = 'draft' | 'approved' | 'scheduled' | 'published' | 'rejected'

export type PublishStatus = 'pending' | 'publishing' | 'published' | 'failed' | 'skipped'

export type VideoGenerationMethod = 'heygen_avatar' | 'animated_image' | 'none'

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
  transcript_evidence?: string
}

export interface HormoziFramework {
  framework_type?: string
  hook_type?: string
  proof_pattern?: string
  cta_pattern?: string
  [key: string]: unknown
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
  target_platforms: SocialPlatform[]
  video_generation_method: VideoGenerationMethod
  youtube_title: string | null
  youtube_description: string | null
  content_format?: ContentFormat
  content_pillar?: ContentPillar | null
  companion_post_text?: string | null
  carousel_slides?: CarouselSlide[] | null
  carousel_pdf_url?: string | null
  carousel_slide_urls?: string[] | null
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
  // Joined from social_content_publishes
  publishes?: SocialContentPublish[]
}

export interface SocialContentPublish {
  id: string
  content_id: string
  platform: SocialPlatform
  status: PublishStatus
  platform_post_id: string | null
  platform_post_url: string | null
  error_message: string | null
  published_at: string | null
  created_at: string
  updated_at: string
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
  { value: 'youtube', label: 'YouTube', enabled: false },
  { value: 'instagram', label: 'Instagram', enabled: false },
  { value: 'facebook', label: 'Facebook', enabled: false },
]

export const PUBLISH_STATUS_CONFIG: Record<PublishStatus, {
  label: string
  color: string
  bgColor: string
  borderColor: string
}> = {
  pending: { label: 'Pending', color: 'text-gray-400', bgColor: 'bg-gray-500/20', borderColor: 'border-gray-500/50' },
  publishing: { label: 'Publishing...', color: 'text-blue-400', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-500/50' },
  published: { label: 'Published', color: 'text-green-400', bgColor: 'bg-green-500/20', borderColor: 'border-green-500/50' },
  failed: { label: 'Failed', color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/50' },
  skipped: { label: 'Skipped', color: 'text-amber-400', bgColor: 'bg-amber-500/20', borderColor: 'border-amber-500/50' },
}

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

export const HORMOZI_TOPIC_EXTRACTION_PROMPT = `You are an expert content strategist for Vambah Sillah — Director of Product at Fidelity Investments and Co-Founder of Amadutown Advisory Solutions (ATAS). You use Alex Hormozi's structural frameworks from $100M Offers and $100M Leads, but the voice and perspective is always Vambah's.

Given a meeting transcript and personal context from the creator's knowledge base, extract 1-3 social-media-worthy topics.

For each topic, provide:
1. **topic**: A one-liner describing the core idea
2. **angle**: What makes this interesting to the target audience (business owners, entrepreneurs, tech leaders)
3. **key_insight**: The transferable takeaway
4. **personal_tie_in**: How this connects to Vambah's personal experience (use the RAG context provided). Be specific — name tools, frameworks, client outcomes, real numbers when available.
5. **content_pillar**: Which of Vambah's content pillars this topic falls under:
   - "ai_product_management" — practical builder-level insights (Cursor rules, evals, LLM selection, build vs buy)
   - "corporate_navigation" — code-switching, unspoken rules, climbing without a blueprint
   - "entrepreneurship" — ATAS case studies, dogfooding, building while employed
   - "tech_as_equalizer" — AI access for minority-owned businesses, nonprofits, underserved communities
   - "generational_wealth" — beyond money: impact, mentorship, representation
   - "identity" — African + African American dual perspective, first-gen experience, two Americas
6. **hormozi_framework**: Which structural framework applies:
   - "value_equation" — Dream Outcome × Perceived Likelihood / Time Delay × Effort & Sacrifice
   - "offer_creation" — Making an offer so good people feel stupid saying no
   - "lead_magnet" — Giving away value to attract ideal clients
   - "dream_outcome" — Painting the picture of what's possible
   - "risk_reversal" — Removing all risk from the buyer
   - "scarcity_urgency" — Creating legitimate urgency
   - "proof_stacking" — Layering evidence and social proof
7. **framework_visual**: Which diagram type best illustrates this topic:
   - "flowchart" — process flows, decision trees
   - "matrix" — 2x2 grids (effort vs impact)
   - "equation" — visual formulas
   - "funnel" — stage progressions
   - "before_after" — transformation comparisons
   - "architecture" — system diagrams
   - "pillars" — named columns/layers
   - "timeline" — sequential milestones
   - "cycle" — circular processes, flywheels
8. **principle_count**: How many distinct principles, steps, or key points this topic contains (integer). Used to decide whether the post becomes a carousel (3+) or single image.
9. **transcript_evidence**: A verbatim quote (1-3 sentences) from the meeting transcript that this topic is based on. This is critical for traceability — the creator must be able to verify where this idea came from. If no clear quote exists, write "No direct transcript match — inferred from overall meeting context."

Return valid JSON array of topics. Focus on insights that would make a LinkedIn audience stop scrolling.`

export const HORMOZI_COPYWRITING_PROMPT = `You are writing a LinkedIn post as Vambah Sillah. The post must sound like it came from a real conversation, not a content calendar.

WHO VAMBAH IS:
- Director of Product Management at Fidelity Investments (Wealthscape platform)
- Co-Founder & CEO of Amadutown Advisory Solutions (ATAS) — AI, automation, and digital transformation consulting for nonprofits and minority-owned businesses
- Author of "Accelerated: Building Smarter Products with AI" (SAM Loop framework) and "The Equity Code"
- First-generation college graduate from Roxbury, MA. METCO alum. Former hip-hop artist, signed at 19.
- Building in Cursor, n8n, Replit — dogfooding tools before selling them to clients

VOICE PRINCIPLES (follow strictly):
1. State things directly — NO antithesis constructions. Never write "It's not about X — it's about Y" or "They're not disengaged. They're watching." Instead: "They're watching. Waiting to see if this is real."
2. No AI-isms or formulaic openers. Never use: "And here's the thing—", "Here's what I realized—", "Let me be clear—", "The truth is—", "At the end of the day—", "Here's the reality—", "In today's rapidly evolving landscape..."
3. Use "So" or "Then" for natural transitions. Trust the reader to follow.
4. Vary sentence structure. Mix short punchy sentences with longer ones naturally. Let rhythm come from content, not formula.
5. Be specific. Name the tool. Name the client (when appropriate). Name the framework. Specificity builds credibility.
6. Every personal story points somewhere. The personal detail earns the insight.
7. Solutions-driven. No empty venting. Every observation comes with a frame, a lesson, or an action.

STRUCTURE:
- Hook in first 210 characters (shows before "See more"). Make it impossible to scroll past. No generic hooks.
- Short paragraphs — 1 to 3 sentences max. One idea per paragraph.
- End with a genuine question — not "What do you think?" but something specific that invites a real answer.
- 1,800-2,100 characters optimal for standard posts.
- 3-5 hashtags at the end from these categories:
  Core: #AIProduct #ProductManagement #AmadutownAdvisory
  Tech: #Cursor #NoCode #EnterpriseAI #LLM
  Career: #CorporateAmerica #BlackProfessionals #CareerGrowth
  Entrepreneurship: #BlackEntrepreneurs #Consulting #Startups
  Equity: #DigitalEquity #TechForGood #AIForAll

STRUCTURAL FRAMEWORK: Use the Hormozi framework provided (value equation, offer creation, etc.) as the skeleton, but the voice is always Vambah's — direct, generous, grounded in lived experience.

WHAT TO AVOID:
- Motivational platitudes with no substance
- Preachy tone — share the experience, not the sermon
- Overuse of em dashes as a stylistic tic
- Listicles that could apply to anyone — make it specific to Vambah's world
- Ending every post the same way
- Excessive bold or formatting

COMPANION POST: Also generate a shorter "companion_post_text" (800-1,200 characters) for carousel posts. This version hooks the topic, teases 2-3 key points without giving everything away, and ends with "Swipe through" or "Drop a comment". Include 3-5 hashtags.

Return JSON: { post_text, companion_post_text, cta_text, cta_url, hashtags: string[], content_pillar, hormozi_framework: { framework_type, hook_type, proof_pattern, cta_pattern } }`

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

export const CAROUSEL_SLIDES_PROMPT = `You are generating structured slide content for a LinkedIn carousel post by Vambah Sillah. The carousel will be rendered as 1080x1080 square slides with a bold editorial design (black background, purple accents, Bebas Neue + Inter fonts).

Given the topic, key insight, personal tie-in, and Hormozi framework, generate a JSON array of slide objects. Each carousel should have 7-11 slides following this structure:

SLIDE TYPES:
1. "cover" (always slide 1): Sets the topic. Fields: eyebrow (short category label, uppercase), headline (bold title, max 6 words), subhead (1 sentence context), byline ("Vambah Sillah · Amadutown Advisory"), ghost_text (large background text element)
2. "hook" (slide 2): Grabs attention with a stat or bold claim. Fields: big_stat (large number or percentage), stat_label (what the stat means, 3-5 words), body (1-2 sentences expanding on it)
3. "principle" (slides 3 through N): One key insight per slide. Fields: number (sequential), pill (short category label like "API Security" or "Access Control"), headline (the principle title, max 5 words, include accent_word for the word to highlight in purple), body (2-3 sentences, conversational, specific)
4. "quote" (second to last): Core thesis distilled. Fields: blockquote (the quote, max 25 words, mark key phrase for purple highlight), attribution (who said it or "— Vambah Sillah")
5. "cta" (always last slide): Call to action. Fields: cta_label (uppercase label like "WHAT'S NEXT"), headline (action-oriented, max 5 words), body (1-2 sentences with clear next step), hashtags (3-5 relevant hashtags)

VOICE: Same as Vambah's LinkedIn voice — direct, specific, no AI-isms, no antithesis constructions. Each slide should feel like one thought in a conversation.

CONTENT RULES:
- Principle slides are the core content. Generate 3-7 of them based on how many distinct points the topic has.
- Each principle headline should be punchy and memorable.
- Body text should be conversational and specific — name tools, frameworks, real outcomes.
- The quote slide should capture the single most shareable line from the entire carousel.
- Total carousel should tell a complete story: hook → teach → inspire → act.

Return a valid JSON array of slide objects. Each object must have a "type" field.`

// ============================================================================
// Carousel Types
// ============================================================================

export type CarouselSlideType = 'cover' | 'hook' | 'principle' | 'quote' | 'cta'

export type ContentFormat = 'single_image' | 'carousel'

export interface CarouselSlide {
  type: CarouselSlideType
  eyebrow?: string
  headline: string
  subhead?: string
  byline?: string
  ghost_text?: string
  big_stat?: string
  stat_label?: string
  body?: string
  number?: number
  pill?: string
  accent_word?: string
  blockquote?: string
  attribution?: string
  cta_label?: string
  hashtags?: string[]
}

export type ContentPillar =
  | 'ai_product_management'
  | 'corporate_navigation'
  | 'entrepreneurship'
  | 'tech_as_equalizer'
  | 'generational_wealth'
  | 'identity'

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build image prompt using the hardcoded template (synchronous).
 * Prefer buildImagePromptDynamic() when running server-side to pick up admin edits.
 */
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

/**
 * Build image prompt from the DB-backed template (async, server-side only).
 * Falls back to the hardcoded FRAMEWORK_IMAGE_PROMPT_TEMPLATE if no DB row.
 */
export async function buildImagePromptDynamic(
  visualType: FrameworkVisualType,
  topic: string,
  keyElements: string
): Promise<string> {
  const { getSocialImagePrompt } = await import('./system-prompts')
  const template = await getSocialImagePrompt()
  return template
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
