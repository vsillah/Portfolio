// API Route: Guarantee Templates — CRUD
// Admin-only: create and list reusable guarantee definitions

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { validateConditions } from '@/lib/guarantees';
import type { CreateGuaranteeTemplateInput } from '@/lib/guarantees';

export const dynamic = 'force-dynamic';

const VALID_GUARANTEE_TYPES = ['conditional', 'unconditional'];
const VALID_PAYOUT_TYPES = ['refund', 'credit', 'rollover_upsell', 'rollover_continuity'];
const VALID_AMOUNT_TYPES = ['full', 'partial', 'fixed'];

// GET — list guarantee templates
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') !== 'false';

    let query = supabaseAdmin
      .from('guarantee_templates')
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
    console.error('Error fetching guarantee templates:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch guarantee templates' },
      { status: 500 }
    );
  }
}

// POST — create a guarantee template
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body: CreateGuaranteeTemplateInput = await request.json();

    // Validation
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!body.duration_days || body.duration_days < 1) {
      return NextResponse.json({ error: 'Duration must be at least 1 day' }, { status: 400 });
    }
    if (body.guarantee_type && !VALID_GUARANTEE_TYPES.includes(body.guarantee_type)) {
      return NextResponse.json({ error: `Invalid guarantee_type. Must be one of: ${VALID_GUARANTEE_TYPES.join(', ')}` }, { status: 400 });
    }
    if (!VALID_PAYOUT_TYPES.includes(body.default_payout_type)) {
      return NextResponse.json({ error: `Invalid default_payout_type. Must be one of: ${VALID_PAYOUT_TYPES.join(', ')}` }, { status: 400 });
    }
    if (body.payout_amount_type && !VALID_AMOUNT_TYPES.includes(body.payout_amount_type)) {
      return NextResponse.json({ error: `Invalid payout_amount_type. Must be one of: ${VALID_AMOUNT_TYPES.join(', ')}` }, { status: 400 });
    }
    if (body.conditions && !validateConditions(body.conditions)) {
      return NextResponse.json({ error: 'Invalid conditions structure. Each condition must have id, label, verification_method, and required.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('guarantee_templates')
      .insert({
        name: body.name.trim(),
        description: body.description?.trim() || null,
        guarantee_type: body.guarantee_type || 'conditional',
        duration_days: body.duration_days,
        conditions: body.conditions || [],
        default_payout_type: body.default_payout_type,
        payout_amount_type: body.payout_amount_type || 'full',
        payout_amount_value: body.payout_amount_value || null,
        rollover_upsell_service_ids: body.rollover_upsell_service_ids || null,
        rollover_continuity_plan_id: body.rollover_continuity_plan_id || null,
        rollover_bonus_multiplier: body.rollover_bonus_multiplier || 1.0,
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error creating guarantee template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create guarantee template' },
      { status: 500 }
    );
  }
}
