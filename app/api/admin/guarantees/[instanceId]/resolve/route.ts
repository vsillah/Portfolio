// API Route: Manual Guarantee Resolution — POST
// Admin-only: manually resolve a guarantee (void, expire, or force-resolve)

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

const VALID_RESOLUTIONS = ['voided', 'expired'] as const;

// POST — manually resolve a guarantee instance
export async function POST(
  request: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { resolution, notes } = body as { resolution: string; notes?: string };

    if (!VALID_RESOLUTIONS.includes(resolution as typeof VALID_RESOLUTIONS[number])) {
      return NextResponse.json(
        { error: `Invalid resolution. Must be one of: ${VALID_RESOLUTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    const { data: instance } = await supabaseAdmin
      .from('guarantee_instances')
      .select('id, status')
      .eq('id', params.instanceId)
      .single();

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    // Only active or conditions_met instances can be manually resolved
    if (!['active', 'conditions_met'].includes(instance.status)) {
      return NextResponse.json(
        { error: `Cannot resolve guarantee with status: ${instance.status}` },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('guarantee_instances')
      .update({
        status: resolution,
        resolved_at: new Date().toISOString(),
        resolution_notes: notes || `Manually ${resolution} by admin.`,
      })
      .eq('id', params.instanceId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error resolving guarantee:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to resolve guarantee' },
      { status: 500 }
    );
  }
}
