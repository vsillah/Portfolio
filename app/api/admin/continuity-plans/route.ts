// API Route: Continuity Plans — CRUD
// Admin-only: create and list recurring billing plan definitions

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import type { CreateContinuityPlanInput } from '@/lib/continuity';

export const dynamic = 'force-dynamic';

const VALID_INTERVALS = ['week', 'month', 'quarter', 'year'];

// GET — list continuity plans
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') !== 'false';

    let query = supabaseAdmin
      .from('continuity_plans')
      .select('*')
      .order('created_at', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01') return NextResponse.json([]);
      throw error;
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Error fetching continuity plans:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch continuity plans' },
      { status: 500 }
    );
  }
}

// POST — create a continuity plan
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body: CreateContinuityPlanInput = await request.json();

    // Validation
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!VALID_INTERVALS.includes(body.billing_interval)) {
      return NextResponse.json(
        { error: `Invalid billing_interval. Must be one of: ${VALID_INTERVALS.join(', ')}` },
        { status: 400 }
      );
    }
    if (!body.amount_per_interval || body.amount_per_interval <= 0) {
      return NextResponse.json({ error: 'amount_per_interval must be positive' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('continuity_plans')
      .insert({
        name: body.name.trim(),
        description: body.description?.trim() || null,
        service_id: body.service_id || null,
        billing_interval: body.billing_interval,
        billing_interval_count: body.billing_interval_count || 1,
        amount_per_interval: body.amount_per_interval,
        currency: body.currency || 'usd',
        min_commitment_cycles: body.min_commitment_cycles || 0,
        max_cycles: body.max_cycles || null,
        trial_days: body.trial_days || 0,
        features: body.features || [],
        cancellation_policy: body.cancellation_policy || null,
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error creating continuity plan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create continuity plan' },
      { status: 500 }
    );
  }
}
