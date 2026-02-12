// API Route: Guarantee Instances — List
// Admin-only: view all active/resolved guarantee instances

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import type { GuaranteeInstanceStatus } from '@/lib/guarantees';

export const dynamic = 'force-dynamic';

// GET — list guarantee instances with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as GuaranteeInstanceStatus | null;
    const clientEmail = searchParams.get('email');
    const templateId = searchParams.get('template_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabaseAdmin
      .from('guarantee_instances')
      .select(`
        *,
        guarantee_templates (
          id, name, guarantee_type, duration_days, default_payout_type,
          payout_amount_type, rollover_bonus_multiplier
        ),
        guarantee_milestones (
          id, condition_id, condition_label, status, verified_at, client_submitted_at
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }
    if (clientEmail) {
      query = query.ilike('client_email', `%${clientEmail}%`);
    }
    if (templateId) {
      query = query.eq('guarantee_template_id', templateId);
    }

    const { data, error, count } = await query;

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ data: [], total: 0 });
      throw error;
    }

    return NextResponse.json({ data: data || [], total: count || 0 });
  } catch (error: any) {
    console.error('Error fetching guarantee instances:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch guarantee instances' },
      { status: 500 }
    );
  }
}
