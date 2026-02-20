#!/usr/bin/env npx tsx
/**
 * Propose outcome groups for all products, services, and lead magnets.
 * Step 1: Run without args to fetch content and write data for proposal.
 * Step 2: After human approves the proposed table, run with --apply to update DB.
 *
 * Usage:
 *   npx tsx scripts/propose-outcome-groups.ts              # fetch and write data
 *   npx tsx scripts/propose-outcome-groups.ts --apply      # apply approved mapping (updates DB)
 *
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

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

const DATA_FILE = path.resolve(process.cwd(), 'scripts/outcome-proposal-data.json')

async function fetchData() {
  const [productsRes, servicesRes, leadMagnetsRes, groupsRes] = await Promise.all([
    supabase.from('products').select('id, title, description, type').order('display_order', { ascending: true }),
    supabase.from('services').select('id, title, description, service_type').order('display_order', { ascending: true }),
    supabase.from('lead_magnets').select('id, title, description, type, funnel_stage').order('display_order', { ascending: true }),
    supabase.from('outcome_groups').select('id, slug, label, display_order').order('display_order', { ascending: true }),
  ])

  if (productsRes.error) throw new Error(`Products: ${productsRes.error.message}`)
  if (servicesRes.error) throw new Error(`Services: ${servicesRes.error.message}`)
  if (leadMagnetsRes.error) throw new Error(`Lead magnets: ${leadMagnetsRes.error.message}`)
  if (groupsRes.error) throw new Error(`Outcome groups: ${groupsRes.error.message}`)

  return {
    products: (productsRes.data ?? []) as { id: number; title: string; description: string | null; type: string | null }[],
    services: (servicesRes.data ?? []) as { id: string; title: string; description: string | null; service_type: string | null }[],
    lead_magnets: (leadMagnetsRes.data ?? []) as { id: string; title: string; description: string | null; type: string | null; funnel_stage: string | null }[],
    outcome_groups: (groupsRes.data ?? []) as { id: string; slug: string; label: string; display_order: number }[],
  }
}

async function main() {
  const apply = process.argv.includes('--apply')

  if (apply) {
    // Apply the approved mapping from outcome-proposal-applied.json or outcome-proposal-suggested.json
    const appliedPath = path.resolve(process.cwd(), 'scripts/outcome-proposal-applied.json')
    const suggestedPath = path.resolve(process.cwd(), 'scripts/outcome-proposal-suggested.json')
    const mappingPath = fs.existsSync(appliedPath) ? appliedPath : suggestedPath
    if (!fs.existsSync(mappingPath)) {
      console.error('Create scripts/outcome-proposal-applied.json (or outcome-proposal-suggested.json) with the mapping, then run with --apply.')
      process.exit(1)
    }
    const raw = JSON.parse(fs.readFileSync(mappingPath, 'utf-8')) as {
      products: { id: number; outcome_group_slug: string }[]
      services: { id: string; outcome_group_slug: string }[]
      lead_magnets: { id: string; outcome_group_slug: string }[]
    }
    const mapping = {
      products: raw.products.map((p) => ({ id: p.id, outcome_group_slug: p.outcome_group_slug })),
      services: raw.services.map((s) => ({ id: s.id, outcome_group_slug: s.outcome_group_slug })),
      lead_magnets: raw.lead_magnets.map((l) => ({ id: l.id, outcome_group_slug: l.outcome_group_slug })),
    }
    const { data: groups } = await supabase.from('outcome_groups').select('id, slug')
    const slugToId = new Map((groups ?? []).map((g: { id: string; slug: string }) => [g.slug, g.id]))

    let updated = 0
    for (const row of mapping.products) {
      const outcomeGroupId = slugToId.get(row.outcome_group_slug) ?? null
      const { error } = await supabase.from('products').update({ outcome_group_id: outcomeGroupId }).eq('id', row.id)
      if (error) console.error(`Product ${row.id}:`, error.message)
      else updated++
    }
    for (const row of mapping.services) {
      const outcomeGroupId = slugToId.get(row.outcome_group_slug) ?? null
      const { error } = await supabase.from('services').update({ outcome_group_id: outcomeGroupId }).eq('id', row.id)
      if (error) console.error(`Service ${row.id}:`, error.message)
      else updated++
    }
    for (const row of mapping.lead_magnets) {
      const outcomeGroupId = slugToId.get(row.outcome_group_slug) ?? null
      const { error } = await supabase.from('lead_magnets').update({ outcome_group_id: outcomeGroupId }).eq('id', row.id)
      if (error) console.error(`Lead magnet ${row.id}:`, error.message)
      else updated++
    }
    console.log(`Updated ${updated} content items with outcome groups.`)
    return
  }

  const data = await fetchData()
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`Wrote ${data.products.length} products, ${data.services.length} services, ${data.lead_magnets.length} lead magnets, ${data.outcome_groups.length} outcome groups to ${DATA_FILE}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
