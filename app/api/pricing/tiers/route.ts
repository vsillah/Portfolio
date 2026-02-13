import { NextResponse } from 'next/server';
import { PRICING_TIERS, CONTINUITY_PLANS, COMPARISON_DATA, TIER_HORMOZI_SCORES } from '@/lib/pricing-model';

/**
 * GET /api/pricing/tiers
 *
 * Public endpoint — returns pricing tier data for the top-of-funnel pricing page.
 * No authentication required.
 */
export async function GET() {
  try {
    return NextResponse.json({
      tiers: PRICING_TIERS,
      continuityPlans: CONTINUITY_PLANS,
      comparisonData: COMPARISON_DATA,
      hormoziScores: TIER_HORMOZI_SCORES,
    });
  } catch (error) {
    console.error('Error fetching pricing tiers:', error);
    return NextResponse.json(
      { error: 'Failed to load pricing data' },
      { status: 500 }
    );
  }
}
