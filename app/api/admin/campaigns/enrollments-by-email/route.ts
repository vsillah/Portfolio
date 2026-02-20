import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'email query param required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('campaign_enrollments')
      .select(`
        id,
        status,
        enrolled_at,
        deadline,
        payout_type,
        attraction_campaigns (
          id,
          name,
          slug,
          campaign_type,
          status
        ),
        enrollment_criteria (
          id,
          required
        ),
        campaign_progress (
          id,
          status
        )
      `)
      .eq('client_email', email)
      .order('enrolled_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ enrollments: [] });
      throw error;
    }

    interface EnrollmentRow {
      id: string;
      status: string;
      enrolled_at: string;
      deadline: string | null;
      payout_type: string | null;
      attraction_campaigns: { id: string; name: string; slug: string; campaign_type: string; status: string } | null;
      enrollment_criteria: Array<{ id: string; required: boolean }> | null;
      campaign_progress: Array<{ id: string; status: string }> | null;
    }

    const enrollments = ((data || []) as EnrollmentRow[]).map((e) => {
      const criteria = e.enrollment_criteria || [];
      const progress = e.campaign_progress || [];
      const total = criteria.length;
      const met = progress.filter((p) => p.status === 'met' || p.status === 'waived').length;
      return {
        id: e.id,
        status: e.status,
        enrolled_at: e.enrolled_at,
        deadline: e.deadline,
        payout_type: e.payout_type,
        campaign: e.attraction_campaigns,
        progress_summary: { total, met, percentage: total > 0 ? Math.round((met / total) * 100) : 0 },
      };
    });

    return NextResponse.json({ enrollments });
  } catch (err) {
    console.error('Error fetching enrollments by email:', err);
    return NextResponse.json({ error: 'Failed to fetch enrollments' }, { status: 500 });
  }
}
