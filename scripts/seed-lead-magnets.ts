#!/usr/bin/env npx tsx
/**
 * Seed Script: Lead Magnets (planned resources by funnel stage)
 *
 * Inserts placeholder or configured lead_magnet rows for all planned assets
 * (Gate Keepers, Deal Closers, Retention) so Admin can see them by stage and
 * attach files or replace with integrated tools over time. Idempotent: skips
 * insert if a lead magnet with the same title already exists.
 *
 * Usage:
 *   npx tsx scripts/seed-lead-magnets.ts
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Strategy: Prefer integrated resources (like AI Readiness Scorecard) over
 * static PDFs so progress can be tracked and surfaced on the client dashboard.
 * Use slug + delivery_hint to mark integration candidates; attach PDFs via
 * Admin until an integrated version is built.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

import { LEAD_MAGNET_FUNNEL_STAGES } from '../lib/constants/lead-magnet-funnel'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** delivery_hint: 'integrated' = build as interactive tool (track progress for dashboard); 'pdf' = PDF for now */
type DeliveryHint = 'integrated' | 'pdf'

/** When set, resource is a link/interactive tool; file_path stores the URL/path */
type LeadMagnetType = 'ebook' | 'pdf' | 'document' | 'link' | 'interactive'

interface PlannedLeadMagnet {
  title: string
  description: string
  category: 'gate_keeper' | 'deal_closer' | 'retention'
  access_type: 'public_gated' | 'private_link' | 'internal' | 'client_portal'
  funnel_stage: (typeof LEAD_MAGNET_FUNNEL_STAGES)[number]
  slug?: string | null
  delivery_hint: DeliveryHint
  /** For type 'interactive' or 'link': URL or path (e.g. /tools/audit). Stored in file_path. */
  resource_url?: string | null
  type?: LeadMagnetType
  /** Override file_type for non-PDF assets (e.g. 'application/epub+zip') */
  file_type_override?: string | null
  /** Supabase Storage path for downloadable files */
  storage_path?: string | null
  /** Rich landing page content */
  landing_page_data?: Record<string, unknown> | null
}

const PLANNED: PlannedLeadMagnet[] = [
  // Gate Keepers (Resources page) – Attention & Capture
  {
    title: 'Accelerated: Building Smarter Products with AI',
    description: 'A roadmap for corporate professionals, entrepreneurs, and leaders navigating the digital revolution. Learn to think like a product leader, apply AI strategies that work for real businesses, and build frameworks to launch and scale AI-driven products.',
    category: 'gate_keeper',
    access_type: 'public_gated',
    funnel_stage: 'attention_capture',
    slug: 'accelerated',
    delivery_hint: 'pdf',
    type: 'ebook',
    storage_path: 'accelerated_ebook_leadmagnet.epub',
    file_type_override: 'application/epub+zip',
    landing_page_data: {
      headline: 'Accelerated',
      subheadline: 'Building Smarter Products with AI',
      author: 'Vambah Sillah',
      coverImage: '/accelerated_cover_ebook.jpg',
      ctaText: 'Download Free Ebook',
      hook: "The digital revolution isn't coming — it's here. And it's rewriting the rules of every industry, every business model, and every career path.",
      benefits: [
        'How to think like a product leader — even if you\'ve never held that title',
        'AI strategies that work for real businesses — not just billion-dollar corporations',
        'The mindset shifts that separate those who adapt from those who get disrupted',
        'Practical frameworks to build, launch, and scale AI-driven products',
        'Why representation in tech isn\'t just moral — it\'s strategic',
      ],
      authorBio: 'Vambah Sillah draws from real-world experience navigating corporate structures, building from the ground up, and leveraging AI to create impact at scale.',
    },
  },
  { title: 'AI Audit Calculator', description: 'Comprehensive AI & automation readiness assessment tool.', category: 'gate_keeper', access_type: 'public_gated', funnel_stage: 'attention_capture', slug: 'audit', delivery_hint: 'integrated', resource_url: '/tools/audit', type: 'ebook' },
  { title: 'Hook Library', description: 'Curated hooks for openings and follow-ups.', category: 'gate_keeper', access_type: 'public_gated', funnel_stage: 'attention_capture', delivery_hint: 'integrated' },
  { title: 'VSL Script Template', description: 'Video sales letter script template with fill-in slots.', category: 'gate_keeper', access_type: 'public_gated', funnel_stage: 'attention_capture', delivery_hint: 'integrated' },
  { title: 'Retargeting Roadmap', description: 'Step-by-step retargeting setup and creative roadmap.', category: 'gate_keeper', access_type: 'public_gated', funnel_stage: 'attention_capture', delivery_hint: 'integrated' },
  { title: 'Referral Playbook', description: 'How to turn wins into referrals with scripts and checklists.', category: 'gate_keeper', access_type: 'public_gated', funnel_stage: 'attention_capture', delivery_hint: 'integrated' },
  // Scheduling & Show Rate
  { title: 'No-Show Eliminator', description: 'Tactics and scripts to reduce no-shows and improve show rate.', category: 'gate_keeper', access_type: 'public_gated', funnel_stage: 'scheduling_show_rate', slug: 'no-show-eliminator', delivery_hint: 'integrated' },
  // Deal Closers
  { title: 'ROI Calculator', description: 'Use your numbers from the discovery call. Private link.', category: 'deal_closer', access_type: 'private_link', funnel_stage: 'sales_call_process', slug: 'roi', delivery_hint: 'integrated' },
  { title: 'Expectations Alignment Doc', description: 'Align scope and expectations before close. Private link or sales-sent.', category: 'deal_closer', access_type: 'private_link', funnel_stage: 'sales_call_process', slug: 'expectations-doc', delivery_hint: 'pdf' },
  // Retention (client portal, Phase 2)
  { title: 'Activation Tracker', description: 'Track client activation and first-value milestones.', category: 'retention', access_type: 'client_portal', funnel_stage: 'delivery_results', delivery_hint: 'integrated' },
  { title: 'Automation Audit', description: 'Audit current automation and identify quick wins.', category: 'retention', access_type: 'client_portal', funnel_stage: 'delivery_results', delivery_hint: 'integrated' },
  { title: 'Win Tracker', description: 'Log and celebrate wins; feed case studies and renewal.', category: 'retention', access_type: 'client_portal', funnel_stage: 'delivery_results', delivery_hint: 'integrated' },
  { title: 'Case Study Builder', description: 'Structured prompts to turn client results into case studies.', category: 'retention', access_type: 'client_portal', funnel_stage: 'flywheel_reinvestment', delivery_hint: 'integrated' },
  { title: 'Renewal Guide', description: 'Renewal conversation guide and timing checklist.', category: 'retention', access_type: 'client_portal', funnel_stage: 'flywheel_reinvestment', delivery_hint: 'integrated' },
]

async function getNextDisplayOrder(stage: string): Promise<number> {
  const { data } = await supabase
    .from('lead_magnets')
    .select('display_order')
    .eq('funnel_stage', stage)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const max = (data as { display_order?: number } | null)?.display_order ?? -1
  return max + 1
}

async function main() {
  console.log('Checking for existing lead magnets...')
  const { data: existing } = await supabase
    .from('lead_magnets')
    .select('id, title')

  const existingByTitle = new Set((existing || []).map((r) => r.title))
  const toInsert = PLANNED.filter((p) => !existingByTitle.has(p.title))

  if (toInsert.length === 0) {
    console.log('All planned lead magnets already exist.')
    console.log('Summary by stage:', existing?.length ?? 0, 'total rows')
    return
  }

  console.log(`Inserting ${toInsert.length} lead magnet(s)...`)
  for (const p of toInsert) {
    const display_order = await getNextDisplayOrder(p.funnel_stage)
    const isLink = p.resource_url != null && p.resource_url !== ''
    const hasStoragePath = p.storage_path != null && p.storage_path !== ''
    const row = {
      title: p.title,
      description: p.description,
      category: p.category,
      access_type: p.access_type,
      funnel_stage: p.funnel_stage,
      display_order,
      type: (p.type ?? 'ebook') as LeadMagnetType,
      file_path: isLink ? p.resource_url! : hasStoragePath ? p.storage_path! : (null as string | null),
      file_type: p.file_type_override ?? (isLink ? 'text/html' : 'application/pdf'),
      file_size: null as number | null,
      download_count: 0,
      is_active: true,
      ...(p.slug ? { slug: p.slug } : {}),
      ...(p.landing_page_data ? { landing_page_data: p.landing_page_data } : {}),
    }
    const { error } = await supabase.from('lead_magnets').insert([row]).select('id').single()
    if (error) {
      console.error(`  Failed ${p.title}:`, error.message)
    } else {
      console.log(`  Inserted: ${p.title} (${p.funnel_stage}, ${p.delivery_hint})`)
    }
  }
  console.log('\nDone. Use Admin → Content → Lead Magnets to see by stage, attach files, or generate private links.')
}

main()
