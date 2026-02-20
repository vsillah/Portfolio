import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import type { CreateCampaignInput, CampaignStatus } from '@/lib/campaigns';
import { isValidCampaignType, isValidCampaignStatus, validateSlug } from '@/lib/campaigns';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as CampaignStatus | null;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabaseAdmin
      .from('attraction_campaigns')
      .select(`
        *,
        campaign_eligible_bundles (id, bundle_id),
        campaign_criteria_templates (id),
        campaign_enrollments (id, status)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && isValidCampaignStatus(status)) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ data: [], total: 0 });
      throw error;
    }

    const campaigns = (data || []).map((c: Record<string, unknown>) => ({
      ...c,
      eligible_bundle_count: Array.isArray(c.campaign_eligible_bundles) ? c.campaign_eligible_bundles.length : 0,
      criteria_count: Array.isArray(c.campaign_criteria_templates) ? c.campaign_criteria_templates.length : 0,
      enrollment_count: Array.isArray(c.campaign_enrollments) ? c.campaign_enrollments.length : 0,
      active_enrollment_count: Array.isArray(c.campaign_enrollments)
        ? (c.campaign_enrollments as Array<{ status: string }>).filter((e) => e.status === 'active').length
        : 0,
    }));

    return NextResponse.json({ data: campaigns, total: count || 0 });
  } catch (error: unknown) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body: CreateCampaignInput = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!body.slug?.trim() || !validateSlug(body.slug)) {
      return NextResponse.json({ error: 'Valid slug is required (lowercase, hyphens only)' }, { status: 400 });
    }
    if (body.campaign_type && !isValidCampaignType(body.campaign_type)) {
      return NextResponse.json({ error: 'Invalid campaign type' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('attraction_campaigns')
      .insert({
        name: body.name.trim(),
        slug: body.slug.trim(),
        description: body.description?.trim() || null,
        campaign_type: body.campaign_type || 'win_money_back',
        status: 'draft',
        starts_at: body.starts_at || null,
        ends_at: body.ends_at || null,
        enrollment_deadline: body.enrollment_deadline || null,
        completion_window_days: body.completion_window_days || 90,
        min_purchase_amount: body.min_purchase_amount || 0,
        payout_type: body.payout_type || 'refund',
        payout_amount_type: body.payout_amount_type || 'full',
        payout_amount_value: body.payout_amount_value || null,
        rollover_bonus_multiplier: body.rollover_bonus_multiplier || 1.0,
        hero_image_url: body.hero_image_url || null,
        promo_copy: body.promo_copy || null,
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A campaign with this slug already exists' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating campaign:', error);
    return NextResponse.json(
      { error: 'Failed to create campaign' },
      { status: 500 }
    );
  }
}
