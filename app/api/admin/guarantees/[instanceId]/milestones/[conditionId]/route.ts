// API Route: Milestone Verification — PUT
// Admin-only: verify/update a milestone on a guarantee instance

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import type { VerifyMilestoneInput, MilestoneStatus } from '@/lib/guarantees';

export const dynamic = 'force-dynamic';

const VALID_STATUSES: MilestoneStatus[] = ['met', 'not_met', 'waived'];

// PUT — admin verifies/updates a milestone
export async function PUT(
  request: NextRequest,
  { params }: { params: { instanceId: string; conditionId: string } }
) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body: VerifyMilestoneInput = await request.json();

    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify the guarantee instance exists and is active
    const { data: instance } = await supabaseAdmin
      .from('guarantee_instances')
      .select('id, status')
      .eq('id', params.instanceId)
      .single();

    if (!instance) {
      return NextResponse.json({ error: 'Guarantee instance not found' }, { status: 404 });
    }

    if (instance.status !== 'active') {
      return NextResponse.json(
        { error: `Cannot update milestones on a guarantee with status: ${instance.status}` },
        { status: 400 }
      );
    }

    // Update the milestone
    const { data, error } = await supabaseAdmin
      .from('guarantee_milestones')
      .update({
        status: body.status,
        verified_by: auth.user.id,
        verified_at: new Date().toISOString(),
        admin_notes: body.admin_notes || null,
      })
      .eq('guarantee_instance_id', params.instanceId)
      .eq('condition_id', params.conditionId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
      }
      throw error;
    }

    // Check if all milestones are now met/waived
    const { data: allMilestones } = await supabaseAdmin
      .from('guarantee_milestones')
      .select('status')
      .eq('guarantee_instance_id', params.instanceId);

    const allConditionsMet = allMilestones?.every(
      (m: { status: string }) => m.status === 'met' || m.status === 'waived'
    );

    // Auto-advance to conditions_met if all done
    if (allConditionsMet) {
      await supabaseAdmin
        .from('guarantee_instances')
        .update({ status: 'conditions_met' })
        .eq('id', params.instanceId)
        .eq('status', 'active');
    }

    return NextResponse.json({
      milestone: data,
      all_conditions_met: allConditionsMet,
    });
  } catch (error: any) {
    console.error('Error updating milestone:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update milestone' },
      { status: 500 }
    );
  }
}
