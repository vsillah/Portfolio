// API Route: Guarantee Instance Detail — GET
// Admin-only: view a single guarantee instance with all milestones

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// GET — fetch single instance with milestones and template
export async function GET(
  request: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { data, error } = await supabaseAdmin
      .from('guarantee_instances')
      .select(`
        *,
        guarantee_templates (*),
        guarantee_milestones (*)
      `)
      .eq('id', params.instanceId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Guarantee instance not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching guarantee instance:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch guarantee instance' },
      { status: 500 }
    );
  }
}
