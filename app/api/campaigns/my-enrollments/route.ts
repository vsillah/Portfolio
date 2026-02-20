import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAuth, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { data, error } = await supabaseAdmin
      .from('campaign_enrollments')
      .select(`
        *,
        attraction_campaigns (id, name, slug, campaign_type, payout_type, hero_image_url),
        enrollment_criteria (
          id, label, description, criteria_type, tracking_source, target_value, required, display_order
        ),
        campaign_progress (
          id, criterion_id, status, progress_value, current_value, auto_tracked,
          client_evidence, client_submitted_at
        )
      `)
      .eq('user_id', auth.user.id)
      .order('enrolled_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ data: [] });
      throw error;
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: unknown) {
    console.error('Error fetching enrollments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enrollments' },
      { status: 500 }
    );
  }
}
