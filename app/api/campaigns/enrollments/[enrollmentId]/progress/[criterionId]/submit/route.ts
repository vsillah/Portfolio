import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAuth, isAuthError } from '@/lib/auth-server';
import type { ClientSubmitProgressInput } from '@/lib/campaigns';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { enrollmentId: string; criterionId: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body: ClientSubmitProgressInput = await request.json();

    if (!body.client_evidence?.trim()) {
      return NextResponse.json({ error: 'Evidence is required' }, { status: 400 });
    }

    // Verify the enrollment belongs to this user
    const { data: enrollment } = await supabaseAdmin
      .from('campaign_enrollments')
      .select('id, user_id, status')
      .eq('id', params.enrollmentId)
      .single();

    if (!enrollment || enrollment.user_id !== auth.user.id) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    if (enrollment.status !== 'active') {
      return NextResponse.json({ error: 'Enrollment is not active' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('campaign_progress')
      .update({
        client_evidence: body.client_evidence.trim(),
        client_submitted_at: new Date().toISOString(),
        current_value: body.current_value || null,
        status: 'in_progress',
      })
      .eq('enrollment_id', params.enrollmentId)
      .eq('criterion_id', params.criterionId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error('Error submitting progress:', error);
    return NextResponse.json(
      { error: 'Failed to submit progress' },
      { status: 500 }
    );
  }
}
