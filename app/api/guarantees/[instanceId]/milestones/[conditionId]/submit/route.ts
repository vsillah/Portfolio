// API Route: Client Milestone Self-Report — POST
// Client submits evidence for a milestone on their guarantee

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST — client submits evidence for a milestone
export async function POST(
  request: NextRequest,
  { params }: { params: { instanceId: string; conditionId: string } }
) {
  try {
    const body = await request.json();
    const { client_evidence, client_email } = body as {
      client_evidence: string;
      client_email: string;
    };

    if (!client_evidence?.trim()) {
      return NextResponse.json({ error: 'Evidence is required' }, { status: 400 });
    }
    if (!client_email?.trim()) {
      return NextResponse.json({ error: 'Client email is required for verification' }, { status: 400 });
    }

    // Verify this instance belongs to this client (by email)
    const { data: instance } = await supabaseAdmin
      .from('guarantee_instances')
      .select('id, status, client_email')
      .eq('id', params.instanceId)
      .single();

    if (!instance) {
      return NextResponse.json({ error: 'Guarantee instance not found' }, { status: 404 });
    }

    if (instance.client_email.toLowerCase() !== client_email.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (instance.status !== 'active') {
      return NextResponse.json(
        { error: `Cannot submit evidence for a guarantee with status: ${instance.status}` },
        { status: 400 }
      );
    }

    // Update the milestone with client evidence
    const { data, error } = await supabaseAdmin
      .from('guarantee_milestones')
      .update({
        client_evidence: client_evidence.trim(),
        client_submitted_at: new Date().toISOString(),
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

    return NextResponse.json({
      success: true,
      milestone: data,
      message: 'Evidence submitted. An admin will review your submission.',
    });
  } catch (error: any) {
    console.error('Error submitting milestone evidence:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit evidence' },
      { status: 500 }
    );
  }
}
