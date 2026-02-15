// API Route: Single Upsell Path Operations
// Handles GET, PUT, DELETE for individual upsell paths

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// GET - Fetch a single upsell path
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const { id } = params;

    const { data: path, error } = await supabaseAdmin
      .from('offer_upsell_paths')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !path) {
      return NextResponse.json({ error: 'Upsell path not found' }, { status: 404 });
    }

    return NextResponse.json({ path });
  } catch (error) {
    console.error('Error in upsell-path GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update an upsell path
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const { id } = params;
    const body = await request.json();

    // Build update object — only include provided fields
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'source_content_type', 'source_content_id', 'source_title', 'source_tier_slug',
      'next_problem', 'next_problem_timing', 'next_problem_signals',
      'upsell_content_type', 'upsell_content_id', 'upsell_title', 'upsell_tier_slug',
      'upsell_perceived_value',
      'point_of_sale_steps', 'point_of_pain_steps',
      'incremental_cost', 'incremental_value', 'value_frame_text', 'risk_reversal_text',
      'credit_previous_investment', 'credit_note',
      'point_of_sale_script_id', 'point_of_pain_script_id',
      'display_order', 'is_active', 'notes',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: path, error } = await supabaseAdmin
      .from('offer_upsell_paths')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating upsell path:', error);
      return NextResponse.json({ error: 'Failed to update upsell path' }, { status: 500 });
    }

    return NextResponse.json({ path });
  } catch (error) {
    console.error('Error in upsell-path PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Soft delete an upsell path (set is_active = false)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const { id } = params;

    const { error } = await supabaseAdmin
      .from('offer_upsell_paths')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Error deleting upsell path:', error);
      return NextResponse.json({ error: 'Failed to delete upsell path' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Upsell path deactivated.' });
  } catch (error) {
    console.error('Error in upsell-path DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
