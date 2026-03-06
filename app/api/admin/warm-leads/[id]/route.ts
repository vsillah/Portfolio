// API Route: Individual Warm Lead Management
// GET    - Fetch a single warm lead with activity history
// PATCH  - Update a warm lead
// DELETE - Delete a warm lead

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// ─── GET: Fetch single warm lead with activity log ────────────────────────────
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

    const [leadResult, activitiesResult] = await Promise.all([
      supabaseAdmin.from('warm_leads').select('*').eq('id', id).single(),
      supabaseAdmin
        .from('warm_lead_activities')
        .select('*')
        .eq('warm_lead_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (leadResult.error) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({
      lead: leadResult.data,
      activities: activitiesResult.data || [],
    });
  } catch (error) {
    console.error('Warm lead GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH: Update a warm lead ────────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const { id } = params;
    const updates = await request.json();

    // Remove fields that should not be directly updated
    delete updates.id;
    delete updates.created_at;
    delete updates.updated_at;

    const { data: lead, error } = await supabaseAdmin
      .from('warm_leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Lead not found or update failed' }, { status: 404 });
    }

    // Log status changes
    if (updates.qualification_status) {
      await supabaseAdmin.from('warm_lead_activities').insert({
        warm_lead_id: id,
        activity_type: 'status_changed',
        description: `Qualification status changed to: ${updates.qualification_status}`,
        metadata: { new_status: updates.qualification_status },
        performed_by: adminResult.user.id,
      });
    }

    if (updates.outreach_status) {
      await supabaseAdmin.from('warm_lead_activities').insert({
        warm_lead_id: id,
        activity_type: updates.outreach_status === 'sent' ? 'outreach_sent' : 'status_changed',
        description: `Outreach status changed to: ${updates.outreach_status}`,
        metadata: { new_outreach_status: updates.outreach_status },
        performed_by: adminResult.user.id,
      });
    }

    if (updates.lead_score !== undefined) {
      await supabaseAdmin.from('warm_lead_activities').insert({
        warm_lead_id: id,
        activity_type: 'score_updated',
        description: `Lead score updated to: ${updates.lead_score}`,
        metadata: { new_score: updates.lead_score },
        performed_by: adminResult.user.id,
      });
    }

    return NextResponse.json({ lead });
  } catch (error) {
    console.error('Warm lead PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE: Remove a warm lead ───────────────────────────────────────────────
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
      .from('warm_leads')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Warm lead DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
