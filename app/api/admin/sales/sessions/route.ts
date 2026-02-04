// API Route: Sales Sessions Management
// Handles CRUD operations for sales sessions

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { SalesSession, FunnelStage, SessionOutcome } from '@/lib/sales-scripts';

// GET - Fetch sales sessions
export async function GET(request: NextRequest) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    // Get filter parameters
    const { searchParams } = new URL(request.url);
    const auditId = searchParams.get('audit_id');
    const outcome = searchParams.get('outcome') as SessionOutcome | null;
    const hasFollowUp = searchParams.get('has_follow_up') === 'true';

    // Fetch sessions
    let query = supabaseAdmin
      .from('sales_sessions')
      .select(`
        *,
        diagnostic_audits (
          id,
          session_id,
          urgency_score,
          opportunity_score,
          status
        )
      `)
      .order('created_at', { ascending: false });

    if (auditId) {
      query = query.eq('diagnostic_audit_id', auditId);
    }

    if (outcome) {
      query = query.eq('outcome', outcome);
    }

    if (hasFollowUp) {
      query = query.not('next_follow_up', 'is', null);
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error('Error fetching sessions:', error);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    return NextResponse.json({ sessions: sessions || [] });
  } catch (error) {
    console.error('Sessions API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new sales session
export async function POST(request: NextRequest) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const body = await request.json();
    const {
      diagnostic_audit_id,
      client_name,
      client_email,
      client_company,
      funnel_stage = 'prospect',
      current_script_id,
    } = body;

    // Either diagnostic_audit_id or client info is required
    if (!diagnostic_audit_id && !client_email) {
      return NextResponse.json(
        { error: 'Either diagnostic_audit_id or client_email is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('sales_sessions')
      .insert({
        diagnostic_audit_id,
        client_name,
        client_email,
        client_company,
        funnel_stage,
        current_script_id,
        sales_agent_id: adminResult.user.id,
        outcome: 'in_progress',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating session:', error);
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Sessions API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update a sales session
export async function PUT(request: NextRequest) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Handle array append operations for offers_presented, etc.
    if (updates.add_offer_presented) {
      const { data: current } = await supabaseAdmin
        .from('sales_sessions')
        .select('offers_presented')
        .eq('id', id)
        .single();

      updates.offers_presented = [
        ...(current?.offers_presented || []),
        updates.add_offer_presented,
      ];
      delete updates.add_offer_presented;
    }

    if (updates.add_product_presented) {
      const { data: current } = await supabaseAdmin
        .from('sales_sessions')
        .select('products_presented')
        .eq('id', id)
        .single();

      updates.products_presented = [
        ...(current?.products_presented || []),
        updates.add_product_presented,
      ];
      delete updates.add_product_presented;
    }

    if (updates.add_objection_handled) {
      const { data: current } = await supabaseAdmin
        .from('sales_sessions')
        .select('objections_handled')
        .eq('id', id)
        .single();

      updates.objections_handled = [
        ...(current?.objections_handled || []),
        updates.add_objection_handled,
      ];
      delete updates.add_objection_handled;
    }

    const { data, error } = await supabaseAdmin
      .from('sales_sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating session:', error);
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Sessions API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a sales session
export async function DELETE(request: NextRequest) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('sales_sessions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting session:', error);
      return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Sessions API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
