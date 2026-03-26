/**
 * Seed value_calculations for all (pain_point × industry × company_size) combos.
 * Uses autoGenerateCalculation() so formulas stay consistent with the app.
 *
 * Usage: npx tsx scripts/seed-value-calculations.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';
import {
  autoGenerateCalculation,
  normalizeCompanySize,
  type IndustryBenchmark,
  type PainPointCategory,
} from '../lib/value-calculations';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const SIZES = ['1-10', '11-50'];

async function main() {
  const { data: categories, error: catErr } = await supabase
    .from('pain_point_categories')
    .select('*')
    .eq('is_active', true);

  if (catErr || !categories?.length) {
    console.error('Failed to load pain point categories:', catErr?.message);
    process.exit(1);
  }

  const { data: benchmarks, error: benchErr } = await supabase
    .from('industry_benchmarks')
    .select('*');

  if (benchErr || !benchmarks?.length) {
    console.error('Failed to load benchmarks:', benchErr?.message);
    process.exit(1);
  }

  const INDUSTRIES = [...new Set(benchmarks.map((b: any) => b.industry as string))];

  console.log(`Loaded ${categories.length} pain point categories and ${benchmarks.length} benchmarks across ${INDUSTRIES.length} industries`);

  let inserted = 0;
  let skipped = 0;
  let duplicates = 0;

  for (const cat of categories as PainPointCategory[]) {
    const allowedIndustries = cat.industry_tags?.length
      ? [...new Set([...cat.industry_tags, '_default'])].filter(i => INDUSTRIES.includes(i) || i === '_default')
      : INDUSTRIES
    for (const industry of allowedIndustries) {
      for (const size of SIZES) {
        const normalizedSize = normalizeCompanySize(size);

        const result = autoGenerateCalculation(
          cat.name,
          benchmarks as IndustryBenchmark[],
          industry,
          normalizedSize,
          0,
          false,
        );

        if (!result || result.annualValue <= 0) {
          skipped++;
          continue;
        }

        const row = {
          pain_point_category_id: cat.id,
          industry,
          company_size_range: normalizedSize,
          calculation_method: result.method,
          formula_inputs: result.formulaInputs,
          formula_expression: result.formulaReadable,
          annual_value: result.annualValue,
          confidence_level: result.confidenceLevel,
          evidence_count: 0,
          benchmark_ids: result.benchmarksUsed.map((b) => b.id),
          evidence_ids: [],
          generated_by: 'system' as const,
          is_active: true,
        };

        const { error: insertErr } = await supabase
          .from('value_calculations')
          .insert(row);

        if (insertErr) {
          if (insertErr.message.includes('duplicate') || insertErr.message.includes('unique')) {
            duplicates++;
          } else {
            console.error(`  Error inserting ${cat.name}/${industry}/${normalizedSize}: ${insertErr.message}`);
          }
          continue;
        }

        inserted++;
      }
    }
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} skipped (no method/benchmark), ${duplicates} duplicates`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
