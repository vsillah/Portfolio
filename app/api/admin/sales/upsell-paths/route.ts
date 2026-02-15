// API Route: Offer Upsell Paths Management
// Handles list and create operations for offer-level upsell pairings
// Follows the $100M Offers two-touch prescription model

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import type { UpsellPath } from '@/lib/upsell-paths';

export const dynamic = 'force-dynamic';

// GET - Fetch all upsell paths with optional filters
export async function GET(request: NextRequest) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') !== 'false';
    const sourceTier = searchParams.get('source_tier');
    const search = searchParams.get('search');

    let query = supabaseAdmin
      .from('offer_upsell_paths')
      .select('*')
      .order('display_order', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    // source_tier filter — 'all' or omitted means no restriction
    if (sourceTier && sourceTier !== 'all') {
      if (sourceTier === 'standalone') {
        query = query.is('source_tier_slug', null);
      } else {
        query = query.eq('source_tier_slug', sourceTier);
      }
    }

    const { data: paths, error } = await query;

    if (error) {
      console.error('Error fetching upsell paths:', error);
      return NextResponse.json({ error: 'Failed to fetch upsell paths' }, { status: 500 });
    }

    // Client-side search filter (source_title, upsell_title, next_problem)
    let filtered = (paths || []) as UpsellPath[];
    if (search) {
      const lower = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.source_title.toLowerCase().includes(lower) ||
          p.upsell_title.toLowerCase().includes(lower) ||
          p.next_problem.toLowerCase().includes(lower)
      );
    }

    return NextResponse.json({ paths: filtered });
  } catch (error) {
    console.error('Error in upsell-paths GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new upsell path
export async function POST(request: NextRequest) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const body = await request.json();
    const {
      source_content_type,
      source_content_id,
      source_title,
      source_tier_slug,
      next_problem,
      next_problem_timing,
      next_problem_signals,
      upsell_content_type,
      upsell_content_id,
      upsell_title,
      upsell_tier_slug,
      upsell_perceived_value,
      point_of_sale_steps,
      point_of_pain_steps,
      incremental_cost,
      incremental_value,
      value_frame_text,
      risk_reversal_text,
      credit_previous_investment,
      credit_note,
      point_of_sale_script_id,
      point_of_pain_script_id,
      notes,
      is_active = true,
    } = body;

    // Validate required fields
    if (!source_content_type || !source_content_id || !source_title) {
      return NextResponse.json(
        { error: 'source_content_type, source_content_id, and source_title are required' },
        { status: 400 }
      );
    }
    if (!upsell_content_type || !upsell_content_id || !upsell_title) {
      return NextResponse.json(
        { error: 'upsell_content_type, upsell_content_id, and upsell_title are required' },
        { status: 400 }
      );
    }
    if (!next_problem) {
      return NextResponse.json(
        { error: 'next_problem is required' },
        { status: 400 }
      );
    }

    // Calculate next display_order
    const { data: maxRow } = await supabaseAdmin
      .from('offer_upsell_paths')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .single();
    const nextOrder = (maxRow?.display_order ?? -1) + 1;

    const { data: path, error } = await supabaseAdmin
      .from('offer_upsell_paths')
      .insert({
        source_content_type,
        source_content_id,
        source_title,
        source_tier_slug: source_tier_slug || null,
        next_problem,
        next_problem_timing: next_problem_timing || '2-4 weeks',
        next_problem_signals: next_problem_signals || [],
        upsell_content_type,
        upsell_content_id,
        upsell_title,
        upsell_tier_slug: upsell_tier_slug || null,
        upsell_perceived_value: upsell_perceived_value || null,
        point_of_sale_steps: point_of_sale_steps || [],
        point_of_pain_steps: point_of_pain_steps || [],
        incremental_cost: incremental_cost || null,
        incremental_value: incremental_value || null,
        value_frame_text: value_frame_text || null,
        risk_reversal_text: risk_reversal_text || null,
        credit_previous_investment: credit_previous_investment ?? true,
        credit_note: credit_note || null,
        point_of_sale_script_id: point_of_sale_script_id || null,
        point_of_pain_script_id: point_of_pain_script_id || null,
        notes: notes || null,
        is_active,
        display_order: nextOrder,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating upsell path:', error);
      return NextResponse.json({ error: 'Failed to create upsell path' }, { status: 500 });
    }

    return NextResponse.json({ path }, { status: 201 });
  } catch (error) {
    console.error('Error in upsell-paths POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
