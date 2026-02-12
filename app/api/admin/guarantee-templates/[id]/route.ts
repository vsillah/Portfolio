// API Route: Guarantee Template Detail — GET, PUT, DELETE
// Admin-only: manage individual guarantee templates

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { validateConditions } from '@/lib/guarantees';
import type { UpdateGuaranteeTemplateInput } from '@/lib/guarantees';

export const dynamic = 'force-dynamic';

const VALID_PAYOUT_TYPES = ['refund', 'credit', 'rollover_upsell', 'rollover_continuity'];
const VALID_AMOUNT_TYPES = ['full', 'partial', 'fixed'];

// GET — fetch single template
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
      .from('guarantee_templates')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching guarantee template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch guarantee template' },
      { status: 500 }
    );
  }
}

// PUT — update template
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body: UpdateGuaranteeTemplateInput = await request.json();

    // Validate fields if provided
    if (body.default_payout_type && !VALID_PAYOUT_TYPES.includes(body.default_payout_type)) {
      return NextResponse.json({ error: `Invalid default_payout_type` }, { status: 400 });
    }
    if (body.payout_amount_type && !VALID_AMOUNT_TYPES.includes(body.payout_amount_type)) {
      return NextResponse.json({ error: `Invalid payout_amount_type` }, { status: 400 });
    }
    if (body.conditions !== undefined && !validateConditions(body.conditions)) {
      return NextResponse.json({ error: 'Invalid conditions structure' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.guarantee_type !== undefined) updateData.guarantee_type = body.guarantee_type;
    if (body.duration_days !== undefined) updateData.duration_days = body.duration_days;
    if (body.conditions !== undefined) updateData.conditions = body.conditions;
    if (body.default_payout_type !== undefined) updateData.default_payout_type = body.default_payout_type;
    if (body.payout_amount_type !== undefined) updateData.payout_amount_type = body.payout_amount_type;
    if (body.payout_amount_value !== undefined) updateData.payout_amount_value = body.payout_amount_value;
    if (body.rollover_upsell_service_ids !== undefined) updateData.rollover_upsell_service_ids = body.rollover_upsell_service_ids;
    if (body.rollover_continuity_plan_id !== undefined) updateData.rollover_continuity_plan_id = body.rollover_continuity_plan_id;
    if (body.rollover_bonus_multiplier !== undefined) updateData.rollover_bonus_multiplier = body.rollover_bonus_multiplier;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    const { data, error } = await supabaseAdmin
      .from('guarantee_templates')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error updating guarantee template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update guarantee template' },
      { status: 500 }
    );
  }
}

// DELETE — soft-delete (deactivate) template
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { data, error } = await supabaseAdmin
      .from('guarantee_templates')
      .update({ is_active: false })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error deleting guarantee template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete guarantee template' },
      { status: 500 }
    );
  }
}
