#!/usr/bin/env npx tsx
/**
 * Align `publications` (and Accelerated ebook `lead_magnets`) with production UX:
 * same titles, copy, display order, preview audio URLs pointing at THIS project's
 * public `lead-magnets` bucket, and FK from Accelerated → ebook slug `accelerated`.
 *
 * Usage (staging):
 *   npx tsx scripts/ensure-publications-experience-parity.ts --env-file .env.staging
 *
 * Prerequisites:
 *   Upload the same preview objects prod uses to staging Storage bucket `lead-magnets`:
 *   - equity_code_audio_leadmagnet.mp3
 *   - accelerated_audio_leadmagnet.mp3
 *   (and ensure the Accelerated .epub path matches lead_magnets.file_path if you use downloads)
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in the env file.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

function resolveEnvFile(): string {
  const i = process.argv.indexOf('--env-file')
  if (i >= 0 && process.argv[i + 1]) {
    return path.resolve(process.cwd(), process.argv[i + 1])
  }
  return path.resolve(process.cwd(), '.env.local')
}

dotenv.config({ path: resolveEnvFile() })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function publicLeadMagnetObjectUrl(objectName: string): string {
  const base = supabaseUrl.replace(/\/$/, '')
  return `${base}/storage/v1/object/public/lead-magnets/${objectName}`
}

/** Mirrors prod + scripts/seed-lead-magnets.ts (Accelerated ebook). */
const ACCELERATED_EBOOK_ROW = {
  title: 'Accelerated: Building Smarter Products with AI',
  description:
    'A roadmap for corporate professionals, entrepreneurs, and leaders navigating the digital revolution. Learn to think like a product leader, apply AI strategies that work for real businesses, and build frameworks to launch and scale AI-driven products.',
  category: 'gate_keeper' as const,
  access_type: 'public_gated' as const,
  funnel_stage: 'attention_capture' as const,
  slug: 'accelerated',
  type: 'ebook' as const,
  file_path: 'accelerated_ebook_leadmagnet.epub',
  file_type: 'application/epub+zip',
  landing_page_data: {
    headline: 'Accelerated',
    subheadline: 'Building Smarter Products with AI',
    author: 'Vambah Sillah',
    coverImage: '/accelerated_cover_ebook.jpg',
    ctaText: 'Download Free Ebook',
    hook: "The digital revolution isn't coming — it's here. And it's rewriting the rules of every industry, every business model, and every career path.",
    benefits: [
      "How to think like a product leader — even if you've never held that title",
      'AI strategies that work for real businesses — not just billion-dollar corporations',
      'The mindset shifts that separate those who adapt from those who get disrupted',
      'Practical frameworks to build, launch, and scale AI-driven products',
      "Why representation in tech isn't just moral — it's strategic",
    ],
    authorBio:
      'Vambah Sillah draws from real-world experience navigating corporate structures, building from the ground up, and leveraging AI to create impact at scale.',
  },
}

const PUBLICATION_SPECS = [
  {
    title: 'The Equity Code',
    description:
      'Bridging the digital divide requires understanding its hidden dimensions. The Equity Code reveals how infrastructure gaps, device disparities, digital literacy barriers, support networks, and cultural relevance shape technology access. Combining personal memoir with practical solutions, this guide helps policymakers, educators, and advocates create digital equity.',
    publication_url: 'https://a.co/d/bVCvCyT',
    author: 'Vambah Sillah',
    publisher: 'Amazon',
    file_path: '/The_Equity_Code_Cover.png',
    file_type: 'image/png' as string | null,
    display_order: 0,
    lead_magnet_slug: null as string | null,
    audio_object_key: 'equity_code_audio_leadmagnet.mp3',
  },
  {
    title: 'Accelerated: Building Smarter Products with AI',
    description:
      'A roadmap for corporate professionals, entrepreneurs, and leaders navigating the digital revolution. Learn to think like a product leader, apply AI strategies for real businesses, and build frameworks to launch and scale AI-driven products.',
    publication_url: null as string | null,
    author: 'Vambah Sillah',
    publisher: null as string | null,
    file_path: '/accelerated_cover_ebook.jpg',
    file_type: 'image/jpeg' as string | null,
    display_order: 1,
    lead_magnet_slug: 'accelerated' as string | null,
    audio_object_key: 'accelerated_audio_leadmagnet.mp3',
  },
]

async function nextDisplayOrderForStage(stage: string): Promise<number> {
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

async function ensureAcceleratedEbookLeadMagnet(): Promise<string | null> {
  const { data: existing } = await supabase
    .from('lead_magnets')
    .select('id')
    .eq('slug', 'accelerated')
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabase
      .from('lead_magnets')
      .update({
        title: ACCELERATED_EBOOK_ROW.title,
        description: ACCELERATED_EBOOK_ROW.description,
        category: ACCELERATED_EBOOK_ROW.category,
        access_type: ACCELERATED_EBOOK_ROW.access_type,
        funnel_stage: ACCELERATED_EBOOK_ROW.funnel_stage,
        type: ACCELERATED_EBOOK_ROW.type,
        file_path: ACCELERATED_EBOOK_ROW.file_path,
        file_type: ACCELERATED_EBOOK_ROW.file_type,
        landing_page_data: ACCELERATED_EBOOK_ROW.landing_page_data,
        is_active: true,
      })
      .eq('id', existing.id)

    if (error) {
      console.error('Failed to update Accelerated lead magnet:', error.message)
      return null
    }
    console.log('Updated existing lead magnet slug=accelerated')
    return existing.id
  }

  const display_order = await nextDisplayOrderForStage(ACCELERATED_EBOOK_ROW.funnel_stage)
  const { data: inserted, error } = await supabase
    .from('lead_magnets')
    .insert([
      {
        ...ACCELERATED_EBOOK_ROW,
        display_order,
        download_count: 0,
        is_active: true,
        file_size: null,
      },
    ])
    .select('id')
    .single()

  if (error) {
    console.error('Failed to insert Accelerated lead magnet:', error.message)
    return null
  }
  console.log('Inserted lead magnet slug=accelerated')
  return inserted.id
}

async function resolveLeadMagnetId(slug: string | null): Promise<string | null> {
  if (!slug) return null
  if (slug === 'accelerated') {
    return ensureAcceleratedEbookLeadMagnet()
  }
  const { data } = await supabase.from('lead_magnets').select('id').eq('slug', slug).maybeSingle()
  return data?.id ?? null
}

async function upsertPublication(spec: (typeof PUBLICATION_SPECS)[number]): Promise<void> {
  const lead_magnet_id = await resolveLeadMagnetId(spec.lead_magnet_slug)
  if (spec.lead_magnet_slug && !lead_magnet_id) {
    console.error(`Skipping publication "${spec.title}" — could not resolve lead_magnet slug=${spec.lead_magnet_slug}`)
    return
  }

  const audio_preview_url = publicLeadMagnetObjectUrl(spec.audio_object_key)
  const payload = {
    title: spec.title,
    description: spec.description,
    publication_url: spec.publication_url,
    author: spec.author,
    publisher: spec.publisher,
    file_path: spec.file_path,
    file_type: spec.file_type,
    display_order: spec.display_order,
    is_published: true,
    lead_magnet_id,
    audiobook_lead_magnet_id: null as string | null,
    audio_preview_url,
    audio_file_path: null as string | null,
    elevenlabs_project_id: null as string | null,
    elevenlabs_public_user_id: null as string | null,
    elevenlabs_player_url: null as string | null,
  }

  const { data: existing } = await supabase.from('publications').select('id').eq('title', spec.title).maybeSingle()

  if (existing?.id) {
    const { error } = await supabase.from('publications').update(payload).eq('id', existing.id)
    if (error) {
      console.error(`Failed to update publication "${spec.title}":`, error.message)
      return
    }
    console.log(`Updated publication id=${existing.id} — ${spec.title}`)
    return
  }

  const { error } = await supabase.from('publications').insert([payload])
  if (error) {
    console.error(`Failed to insert publication "${spec.title}":`, error.message)
    return
  }
  console.log(`Inserted publication — ${spec.title}`)
}

async function main() {
  console.log('Env file:', resolveEnvFile())
  console.log('Supabase URL:', supabaseUrl)
  console.log('')

  for (const spec of PUBLICATION_SPECS) {
    await upsertPublication(spec)
  }

  console.log('\nDone. Confirm Storage → lead-magnets contains the preview MP3s for this project.')
}

main()
