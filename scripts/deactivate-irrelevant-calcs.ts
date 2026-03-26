/**
 * One-off script: soft-delete value_calculations where the industry
 * is not in the pain point category's industry_tags (keeping _default).
 *
 * Usage: npx tsx scripts/deactivate-irrelevant-calcs.ts [--prod]
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

import { createClient } from '@supabase/supabase-js'

const isProd = process.argv.includes('--prod')

const supabaseUrl = isProd
  ? process.env.PROD_SUPABASE_URL!
  : process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = isProd
  ? process.env.PROD_SUPABASE_SERVICE_ROLE_KEY!
  : process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error(`Missing ${isProd ? 'PROD_' : ''}SUPABASE env vars`)
  process.exit(1)
}

console.log(`Target: ${isProd ? 'PRODUCTION' : 'DEV'} (${supabaseUrl})`)

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function main() {
  const { data: categories, error: catErr } = await supabase
    .from('pain_point_categories')
    .select('id, name, display_name, industry_tags')
    .eq('is_active', true)

  if (catErr || !categories?.length) {
    console.error('Failed to load categories:', catErr?.message)
    process.exit(1)
  }

  console.log(`Loaded ${categories.length} categories\n`)

  let totalDeactivated = 0
  let totalKept = 0

  for (const cat of categories) {
    const allowedIndustries = [...(cat.industry_tags || []), '_default']

    const { data: calcs } = await supabase
      .from('value_calculations')
      .select('id, industry')
      .eq('pain_point_category_id', cat.id)
      .eq('is_active', true)

    if (!calcs?.length) continue

    const toDeactivate = calcs.filter(c => !allowedIndustries.includes(c.industry))
    const kept = calcs.length - toDeactivate.length

    if (toDeactivate.length > 0) {
      const ids = toDeactivate.map(c => c.id)
      const { error } = await supabase
        .from('value_calculations')
        .update({ is_active: false })
        .in('id', ids)

      if (error) {
        console.error(`  Error deactivating for ${cat.display_name}: ${error.message}`)
        continue
      }
    }

    const removedIndustries = toDeactivate.map(c => c.industry)
    const uniqueRemoved = [...new Set(removedIndustries)]
    console.log(`${cat.display_name}: kept ${kept}, deactivated ${toDeactivate.length} (${uniqueRemoved.join(', ') || 'none'})`)

    totalDeactivated += toDeactivate.length
    totalKept += kept
  }

  console.log(`\n=== Summary ===`)
  console.log(`Kept: ${totalKept}`)
  console.log(`Deactivated: ${totalDeactivated}`)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
