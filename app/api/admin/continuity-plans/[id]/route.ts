// API Route: Continuity Plan Detail — GET, PUT, DELETE
// Admin-only: manage individual continuity plans

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import type { UpdateContinuityPlanInput } from '@/lib/continuity';

export const dynamic = 'force-dynamic';

// GET — fetch single plan
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
      .from('continuity_plans')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching continuity plan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch continuity plan' },
      { status: 500 }
    );
  }
}

// PUT — update plan
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body: UpdateContinuityPlanInput = await request.json();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.service_id !== undefined) updateData.service_id = body.service_id || null;
    if (body.billing_interval !== undefined) updateData.billing_interval = body.billing_interval;
    if (body.billing_interval_count !== undefined) updateData.billing_interval_count = body.billing_interval_count;
    if (body.amount_per_interval !== undefined) updateData.amount_per_interval = body.amount_per_interval;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.min_commitment_cycles !== undefined) updateData.min_commitment_cycles = body.min_commitment_cycles;
    if (body.max_cycles !== undefined) updateData.max_cycles = body.max_cycles;
    if (body.trial_days !== undefined) updateData.trial_days = body.trial_days;
    if (body.features !== undefined) updateData.features = body.features;
    if (body.cancellation_policy !== undefined) updateData.cancellation_policy = body.cancellation_policy;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    const { data, error } = await supabaseAdmin
      .from('continuity_plans')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error updating continuity plan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update continuity plan' },
      { status: 500 }
    );
  }
}

// DELETE — soft-delete (deactivate)
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
      .from('continuity_plans')
      .update({ is_active: false })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error deleting continuity plan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete continuity plan' },
      { status: 500 }
    );
  }
}
