import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { data, error } = await supabaseAdmin
      .from('campaign_eligible_bundles')
      .select(`
        *,
        offer_bundles (id, name, pricing_tier_slug, bundle_price, pricing_page_segments)
      `)
      .eq('campaign_id', params.id);

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error: unknown) {
    console.error('Error fetching eligible bundles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch eligible bundles' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { bundle_id, override_min_amount } = body;

    if (!bundle_id) {
      return NextResponse.json({ error: 'bundle_id is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('campaign_eligible_bundles')
      .insert({
        campaign_id: params.id,
        bundle_id,
        override_min_amount: override_min_amount || null,
      })
      .select(`
        *,
        offer_bundles (id, name, pricing_tier_slug, bundle_price)
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'This bundle is already eligible for this campaign' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error adding eligible bundle:', error);
    return NextResponse.json(
      { error: 'Failed to add eligible bundle' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const bundleId = searchParams.get('bundle_id');

    if (!bundleId) {
      return NextResponse.json({ error: 'bundle_id query param is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('campaign_eligible_bundles')
      .delete()
      .eq('campaign_id', params.id)
      .eq('bundle_id', bundleId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error removing eligible bundle:', error);
    return NextResponse.json(
      { error: 'Failed to remove eligible bundle' },
      { status: 500 }
    );
  }
}
