/**
 * Public API: Pricing Tiers
 * Returns pricing tiers from offer_bundles for the pricing page.
 * Only bundles whose pricing_page_segments array contains the requested segment (smb, midmarket, or nonprofit) are included. Empty or null = not shown on any tab. Custom bundles are excluded.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveBundleItemsToTierItems } from '@/lib/bundle-resolve';
import { expandBundleItems } from '@/lib/bundle-expand';
import { getUpsellPathsForTier } from '@/lib/upsell-paths';
import { applyDynamicPricing, type CalculationContext } from '@/lib/dynamic-pricing';
import type { IndustryBenchmark } from '@/lib/value-calculations';
import type {
  PricingTier,
  GuaranteeDef,
  DecoyComparison,
} from '@/lib/pricing-model';
import type { BundleItem } from '@/lib/sales-scripts';

type Segment = 'smb' | 'midmarket' | 'nonprofit';

interface DbBundle {
  id: string;
  name: string;
  description: string | null;
  base_bundle_id?: string | null;
  bundle_items: BundleItem[];
  total_retail_value: number | null;
  total_perceived_value: number | null;
  bundle_price: number | null;
  pricing_tier_slug: string | null;
  tagline: string | null;
  target_audience_display: string | null;
  pricing_display_order: number | null;
  is_featured: boolean | null;
  is_decoy: boolean | null;
  mirrors_tier_id: string | null;
  has_guarantee: boolean | null;
  guarantee_name: string | null;
  guarantee_description: string | null;
  cta_text: string | null;
  cta_href: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const segment = searchParams.get('segment') as Segment | null;
    const industry = searchParams.get('industry') || undefined;
    const companySize = searchParams.get('companySize') || undefined;

    if (!segment || !['smb', 'midmarket', 'nonprofit'].includes(segment)) {
      return NextResponse.json(
        { error: 'Invalid or missing segment. Use smb, midmarket, or nonprofit.' },
        { status: 400 }
      );
    }

    // Fetch industry benchmarks for dynamic retail value calculation
    const { data: benchmarks } = await supabaseAdmin
      .from('industry_benchmarks')
      .select('*');
    const allBenchmarks: IndustryBenchmark[] = (benchmarks || []) as IndustryBenchmark[];

    // Fetch bundles for this segment; exclude custom bundles.
    // Only include bundles that explicitly list this segment in pricing_page_segments.
    // Empty/null = not shown on any segment (per offer_bundles column comment).
    const { data: withSegment, error } = await supabaseAdmin
      .from('offer_bundles')
      .select('*')
      .contains('pricing_page_segments', [segment])
      .neq('bundle_type', 'custom')
      .eq('is_active', true)
      .order('pricing_display_order', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('Error fetching pricing tiers:', error);
      return NextResponse.json(
        { error: 'Failed to fetch pricing tiers' },
        { status: 500 }
      );
    }

    const dbBundles: DbBundle[] = (withSegment || []) as DbBundle[];

    const tierPromises = dbBundles.map(async (b): Promise<PricingTier> => {
      const expandedItems = await expandBundleItems(b.id);
      const items = await resolveBundleItemsToTierItems(expandedItems);
      const price = Number(b.bundle_price) ?? 0;
      const totalRetail =
        Number(b.total_retail_value) ??
        Number(b.total_perceived_value) ??
        items.reduce((s, i) => s + i.perceivedValue, 0);
      const savingsPercent =
        totalRetail > 0
          ? Math.round(((totalRetail - price) / totalRetail) * 100)
          : 0;

      let guarantee: GuaranteeDef | null = null;
      if (b.has_guarantee && b.guarantee_name && b.guarantee_description) {
        guarantee = {
          name: b.guarantee_name,
          type: 'conditional',
          durationDays: 30,
          description: b.guarantee_description,
          payoutType: 'refund',
        };
      }

      return {
        id: b.pricing_tier_slug ?? b.id,
        name: b.name,
        tagline: b.tagline ?? '',
        targetAudience: b.target_audience_display ?? '',
        price,
        isCustomPricing: false,
        totalRetailValue: totalRetail,
        savingsPercent,
        items,
        guarantee,
        ctaText: b.cta_text ?? 'Get Started',
        ctaHref: b.cta_href ?? '#contact',
        featured: b.is_featured ?? false,
        isDecoy: b.is_decoy ?? false,
        mirrorsTierId: b.mirrors_tier_id ?? undefined,
      };
    });
    const tiers: PricingTier[] = await Promise.all(tierPromises);

    // Apply dynamic retail values based on segment + optional industry/companySize
    let calculationContext: CalculationContext | undefined;
    if (allBenchmarks.length > 0 || segment) {
      const dynamicResult = applyDynamicPricing(
        tiers,
        allBenchmarks,
        segment,
        industry,
        companySize
      );
      // Replace tiers array contents with dynamically-priced versions
      tiers.splice(0, tiers.length, ...dynamicResult.tiers);
      calculationContext = dynamicResult.context;
    }

    // For nonprofit, build decoy comparisons (need premium tiers from smb)
    let decoyComparisons: DecoyComparison[] | undefined;
    if (segment === 'nonprofit') {
      const decoys = tiers.filter((t) => t.isDecoy);
      let premiums = tiers.filter((t) => !t.isDecoy);
      if (premiums.length === 0 && decoys.length > 0) {
        // Fetch premium tiers that explicitly show on SMB segment only
        const { data: smbData } = await supabaseAdmin
          .from('offer_bundles')
          .select('*')
          .contains('pricing_page_segments', ['smb'])
          .neq('bundle_type', 'custom')
          .eq('is_active', true)
          .order('pricing_display_order', { ascending: true });
        const smbBundles = (smbData || []) as DbBundle[];
        const smbTierPromises = smbBundles.map(async (b): Promise<PricingTier> => {
          const expandedItems = await expandBundleItems(b.id);
          const items = await resolveBundleItemsToTierItems(expandedItems);
          const price = Number(b.bundle_price) ?? 0;
          const totalRetail =
            Number(b.total_retail_value) ??
            Number(b.total_perceived_value) ??
            items.reduce((s, i) => s + i.perceivedValue, 0);
          const savingsPercent =
            totalRetail > 0
              ? Math.round(((totalRetail - price) / totalRetail) * 100)
              : 0;
          let guarantee: GuaranteeDef | null = null;
          if (b.has_guarantee && b.guarantee_name && b.guarantee_description) {
            guarantee = {
              name: b.guarantee_name,
              type: 'conditional',
              durationDays: 30,
              description: b.guarantee_description,
              payoutType: 'refund',
            };
          }
          return {
            id: b.pricing_tier_slug ?? b.id,
            name: b.name,
            tagline: b.tagline ?? '',
            targetAudience: b.target_audience_display ?? '',
            price,
            isCustomPricing: false,
            totalRetailValue: totalRetail,
            savingsPercent,
            items,
            guarantee,
            ctaText: b.cta_text ?? 'Get Started',
            ctaHref: b.cta_href ?? '#contact',
            featured: b.is_featured ?? false,
            isDecoy: false,
          };
        });
        premiums = await Promise.all(smbTierPromises);
      }
      decoyComparisons = decoys
        .filter((d) => d.mirrorsTierId)
        .map((decoy) => {
          const premium = premiums.find((p) => p.id === decoy.mirrorsTierId);
          if (!premium) return null;
          const keyDifferences = buildKeyDifferences(decoy, premium);
          return {
            decoyTier: decoy,
            premiumTier: premium,
            keyDifferences,
          };
        })
        .filter((c): c is DecoyComparison => c !== null);

      // Enrich each comparison with upsell context from offer_upsell_paths
      for (const comparison of decoyComparisons) {
        try {
          const paths = await getUpsellPathsForTier(comparison.decoyTier.id);
          if (paths.length > 0) {
            const path = paths[0]; // Use the first (highest priority) upsell path
            comparison.upsellContext = {
              nextProblem: path.next_problem,
              valueFrame: path.value_frame_text,
              riskReversal: path.risk_reversal_text,
              creditNote: path.credit_previous_investment ? path.credit_note : null,
              incrementalCost: path.incremental_cost,
              incrementalValue: path.incremental_value,
            };
          }
        } catch (upsellErr) {
          // Non-critical — continue without upsell context
          console.error(`[Pricing] Error fetching upsell context for ${comparison.decoyTier.id}:`, upsellErr);
        }
      }
    }

    return NextResponse.json({
      tiers,
      decoyComparisons: decoyComparisons ?? null,
      calculationContext: calculationContext ?? null,
    });
  } catch (err) {
    console.error('Pricing tiers API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function buildKeyDifferences(
  decoy: PricingTier,
  premium: PricingTier
): { feature: string; decoyValue: string; premiumValue: string }[] {
  // Use predefined differences based on tier slugs for consistency
  const diffMap: Record<string, { feature: string; decoyValue: string; premiumValue: string }[]> = {
    'ci-starter': [
      { feature: 'Workshop', decoyValue: 'Recorded (self-paced)', premiumValue: 'Live half-day session' },
      { feature: 'Follow-up', decoyValue: 'Community forum only', premiumValue: '2 personal strategy calls' },
      { feature: 'Support', decoyValue: 'None', premiumValue: '30-day email support' },
      { feature: 'Guarantee', decoyValue: 'None', premiumValue: '30-day money-back guarantee' },
    ],
    'ci-accelerator': [
      { feature: 'Chatbot', decoyValue: 'Template (self-install)', premiumValue: 'Custom-deployed & configured' },
      { feature: 'Coaching', decoyValue: 'Group webinar (6 weeks)', premiumValue: '4-week 1-on-1 coaching' },
      { feature: 'Training', decoyValue: 'Recorded library', premiumValue: 'Live team session' },
      { feature: 'Support', decoyValue: '30-day email', premiumValue: '90-day priority support' },
      { feature: 'Guarantee', decoyValue: 'None', premiumValue: '90-day outcome guarantee' },
    ],
    'ci-growth': [
      { feature: 'Tools', decoyValue: 'Template-based (self-setup)', premiumValue: 'Custom-deployed & running' },
      { feature: 'Implementation', decoyValue: 'Group calls (6 weeks)', premiumValue: '12-week dedicated program' },
      { feature: 'Advisory', decoyValue: 'None', premiumValue: 'Monthly advisory calls (3 months)' },
      { feature: 'Dashboard', decoyValue: 'Shared template', premiumValue: 'Custom analytics dashboard' },
      { feature: 'Support', decoyValue: '60-day email', premiumValue: 'Priority support channel' },
      { feature: 'Guarantee', decoyValue: 'None', premiumValue: '365-day ROI guarantee' },
    ],
  };
  return diffMap[decoy.id] ?? [];
}
