/**
 * Our platform stack — canonical definition of what we build on.
 *
 * Feeds the feasibility engine (lib/implementation-feasibility.ts) so it can
 * compare what we bring to the table against what the client already runs
 * (via BuiltWith) and emit match / integrate / gap / replace signals.
 *
 * The canonical categories here align with BuiltWith tags via
 * lib/constants/builtwith-tag-map.ts. Adding a new entry here is a data
 * change, not a code change — no types or enums need updating.
 *
 * Sourced from CLAUDE.md (Architecture / Stack) and env-driven integrations
 * referenced in lib/n8n.ts, lib/stripe.ts, lib/vapi.ts, etc.
 */

export type OurStackCategory =
  | 'framework'
  | 'hosting'
  | 'database'
  | 'auth'
  | 'payments'
  | 'email'
  | 'automation'
  | 'ai'
  | 'voice'
  | 'video'
  | 'analytics'
  | 'cms'
  | 'ecommerce'
  | 'crm'
  | 'marketing'
  | 'testing'

export type OurStackRole = 'platform' | 'integration' | 'optional'

export interface OurStackEntry {
  /** Human-readable name, shown to admins. */
  name: string
  /** Canonical category used for match/integrate logic. */
  category: OurStackCategory
  /** BuiltWith tags or category labels that map to this entry (any-of match). */
  tags: string[]
  /** Short description shown in admin conflict resolver tooltips. */
  description?: string
  /** platform = always present; integration = connects to client systems; optional = only when needed. */
  role: OurStackRole
}

/**
 * Bump when the stack changes; stored on feasibility snapshots so we can
 * reproduce what "our stack" looked like at generation time.
 */
export const OUR_TECH_STACK_VERSION = '2026.04.17'

export const OUR_TECH_STACK: OurStackEntry[] = [
  // Platform (baseline, every product)
  { name: 'Next.js 14', category: 'framework', tags: ['Frameworks', 'JavaScript Frameworks'], role: 'platform', description: 'App Router, SSR, and route handlers power every page and API.' },
  { name: 'Vercel', category: 'hosting', tags: ['Hosting', 'CDN', 'Platform as a Service'], role: 'platform', description: 'Production hosting for the Next.js app.' },
  { name: 'Supabase (Postgres)', category: 'database', tags: ['Databases', 'PostgreSQL'], role: 'platform', description: 'Primary data store with RLS-backed auth.' },
  { name: 'Supabase Auth', category: 'auth', tags: ['Auth', 'SSO', 'OAuth'], role: 'platform' },
  { name: 'Tailwind CSS', category: 'framework', tags: ['CSS', 'UI Frameworks'], role: 'platform' },

  // Integrations (used when the offering requires them)
  { name: 'Stripe', category: 'payments', tags: ['Payment Processors', 'Payment', 'Payments'], role: 'integration', description: 'Handles checkout, subscriptions, and payouts for product/service offerings.' },
  { name: 'n8n', category: 'automation', tags: ['Workflow Automation', 'Automation', 'Integration Platform'], role: 'integration', description: 'Runs workflow automations and webhooks; integrates with the client\u2019s existing systems.' },
  { name: 'OpenAI', category: 'ai', tags: ['AI', 'LLM', 'Machine Learning'], role: 'integration', description: 'Powers audit analysis, chat, and content generation.' },
  { name: 'Vapi', category: 'voice', tags: ['Voice', 'Voice AI', 'Telephony'], role: 'integration', description: 'Voice AI for inbound/outbound call automation.' },
  { name: 'HeyGen', category: 'video', tags: ['Video', 'Video Generation'], role: 'integration', description: 'Avatar-based video generation for proposals and marketing.' },
  { name: 'Gamma', category: 'marketing', tags: ['Presentations', 'Marketing Automation'], role: 'integration', description: 'Slide generation for strategy and proposal decks.' },

  // Optional (depends on offering)
  { name: 'Playwright', category: 'testing', tags: ['Testing'], role: 'optional' },
  { name: 'Vitest', category: 'testing', tags: ['Testing'], role: 'optional' },
]

/**
 * Fallback tech_stack defaults for content_offer_roles rows that don't have
 * a per-asset override yet. Applied by the one-shot MCP seed at rollout and
 * by the engine when content_offer_roles.tech_stack is NULL.
 *
 * Keyed by content_type. Keep conservative — each list should describe what
 * that product category actually needs to be delivered, not everything we
 * could theoretically use.
 */
export const DEFAULT_TECH_STACK_BY_CONTENT_TYPE: Record<string, {
  platform: string[]
  integrations: Array<{ system: string; direction?: string; method?: string }>
  client_infrastructure_required?: string[]
  notes?: string
}> = {
  service: {
    platform: ['Next.js 14', 'Supabase (Postgres)', 'Stripe'],
    integrations: [
      { system: 'n8n', direction: 'outbound', method: 'webhook' },
      { system: 'OpenAI', direction: 'outbound', method: 'api' },
    ],
    notes: 'Delivered via our hosted platform; client sees results in their proposal view.',
  },
  product: {
    platform: ['Next.js 14', 'Supabase (Postgres)', 'Stripe'],
    integrations: [],
    notes: 'Digital product shipped from our store.',
  },
  project: {
    platform: ['Next.js 14', 'Supabase (Postgres)'],
    integrations: [{ system: 'n8n', direction: 'outbound', method: 'webhook' }],
    client_infrastructure_required: ['Website or app we integrate with'],
    notes: 'Custom engagement; integration surface depends on client stack.',
  },
  prototype: {
    platform: ['Next.js 14', 'Supabase (Postgres)'],
    integrations: [{ system: 'OpenAI', direction: 'outbound', method: 'api' }],
    notes: 'App prototype delivered as a deployable Next.js project.',
  },
  video: {
    platform: ['Next.js 14'],
    integrations: [{ system: 'HeyGen', direction: 'outbound', method: 'api' }],
    notes: 'Video asset — client hosts or embeds the finished deliverable.',
  },
  publication: {
    platform: ['Next.js 14'],
    integrations: [],
    notes: 'Static publication; no client integration required.',
  },
  music: {
    platform: ['Next.js 14'],
    integrations: [],
  },
  lead_magnet: {
    platform: ['Next.js 14', 'Supabase (Postgres)'],
    integrations: [],
    notes: 'Hosted on our domain; no client infrastructure required.',
  },
}
