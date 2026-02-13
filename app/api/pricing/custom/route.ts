import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { determineTier, PRICING_TIERS, formatCurrency } from '@/lib/pricing-model';
import { calculateROI, findBestBenchmark, normalizeCompanySize, autoGenerateCalculation, type IndustryBenchmark, type CalculationResult } from '@/lib/value-calculations';

/**
 * GET /api/pricing/custom?sessionId=xxx
 *
 * Returns personalized pricing data based on a sales session's diagnostic/contact data.
 * Requires a valid sessionId query parameter.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // 1. Fetch the sales session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sales_sessions')
      .select('*, diagnostic_audits(*), contact_submissions(*)')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const contact = session.contact_submissions;
    const diagnostic = session.diagnostic_audits;

    // 2. Determine industry and company size
    const industry = contact?.industry || '_default';
    const companySize = normalizeCompanySize(contact?.company_size || diagnostic?.responses_received?.company_size);

    // 3. Fetch benchmarks
    const { data: benchmarks } = await supabaseAdmin
      .from('industry_benchmarks')
      .select('*');

    const allBenchmarks: IndustryBenchmark[] = benchmarks || [];

    // 4. Fetch pain points mapped to this contact
    const painPointValues: Array<{
      categoryName: string;
      displayName: string;
      annualValue: number;
      formula: string;
      method: string;
      confidence: string;
    }> = [];

    if (contact?.id) {
      // Get pain point evidence for this contact
      const { data: evidence } = await supabaseAdmin
        .from('value_evidence')
        .select('*, pain_point_categories(*)')
        .eq('contact_submission_id', contact.id)
        .eq('is_active', true);

      if (evidence && evidence.length > 0) {
        // Get unique pain point categories
        const categories = new Map<string, { id: string; name: string; display_name: string }>();
        for (const ev of evidence) {
          if (ev.pain_point_categories) {
            categories.set(ev.pain_point_categories.id, ev.pain_point_categories);
          }
        }

        // Calculate value for each pain point
        for (const [, category] of categories) {
          // Check for existing calculation
          const { data: existingCalc } = await supabaseAdmin
            .from('value_calculations')
            .select('*')
            .eq('pain_point_category_id', category.id)
            .eq('industry', industry)
            .eq('company_size_range', companySize)
            .eq('is_active', true)
            .maybeSingle();

          if (existingCalc) {
            painPointValues.push({
              categoryName: category.name,
              displayName: category.display_name,
              annualValue: existingCalc.annual_value,
              formula: existingCalc.formula_expression,
              method: existingCalc.calculation_method,
              confidence: existingCalc.confidence_level,
            });
          } else {
            // Auto-generate calculation
            const categoryEvidence = evidence.filter((e: { pain_point_category_id: string }) => e.pain_point_category_id === category.id);
            const calc: CalculationResult | null = autoGenerateCalculation(
              category.name,
              allBenchmarks,
              industry,
              companySize,
              categoryEvidence.length,
              false
            );

            if (calc) {
              painPointValues.push({
                categoryName: category.name,
                displayName: category.display_name,
                annualValue: calc.annualValue,
                formula: calc.formulaReadable,
                method: calc.method,
                confidence: calc.confidenceLevel,
              });
            }
          }
        }
      }
    }

    // 5. Calculate totals
    const totalAnnualWaste = painPointValues.reduce((sum, pv) => sum + pv.annualValue, 0);

    // 6. Determine recommended tier
    const recommendedTierId = determineTier({
      companySize,
      opportunityScore: diagnostic?.opportunity_score || 5,
      urgencyScore: diagnostic?.urgency_score || 5,
    });
    const recommendedTier = PRICING_TIERS.find(t => t.id === recommendedTierId) || PRICING_TIERS[1];

    // 7. Calculate ROI
    const roi = calculateROI(totalAnnualWaste, recommendedTier.price);

    // 8. Build response
    return NextResponse.json({
      session: {
        id: session.id,
        funnelStage: session.funnel_stage,
      },
      client: {
        name: contact?.name || contact?.full_name || 'Prospect',
        company: contact?.company || 'Your Business',
        industry: industry === '_default' ? 'General' : industry,
        companySize,
        email: contact?.email,
      },
      diagnostic: diagnostic ? {
        urgencyScore: diagnostic.urgency_score,
        opportunityScore: diagnostic.opportunity_score,
        summary: diagnostic.audit_summary,
      } : null,
      painPoints: painPointValues,
      totalAnnualWaste,
      recommendedTier: {
        ...recommendedTier,
        roi: {
          roiPercent: roi.roi,
          roiFormatted: roi.roiFormatted,
          paybackMonths: roi.paybackMonths,
          paybackFormatted: roi.paybackFormatted,
          annualSavings: roi.annualSavings,
          netFirstYearValue: roi.netFirstYearValue,
          investmentRecovery: totalAnnualWaste > 0
            ? `For every $1 invested, recover ${formatCurrency(Math.round(totalAnnualWaste / recommendedTier.price))}`
            : null,
        },
      },
      allTiers: PRICING_TIERS,
    });
  } catch (error) {
    console.error('Error generating custom pricing:', error);
    return NextResponse.json(
      { error: 'Failed to generate custom pricing' },
      { status: 500 }
    );
  }
}
