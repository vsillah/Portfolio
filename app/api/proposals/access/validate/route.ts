// API Route: Validate Proposal Access Code
// POST - Public: validate access code and return proposal_id

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { access_code } = body;

    if (!access_code || typeof access_code !== 'string') {
      return NextResponse.json({ error: 'Access code is required' }, { status: 400 });
    }

    const normalized = access_code.toUpperCase().trim();

    const { data: proposal, error } = await supabaseAdmin
      .from('proposals')
      .select('id')
      .eq('access_code', normalized)
      .single();

    if (error || !proposal) {
      return NextResponse.json({ error: 'Invalid access code' }, { status: 404 });
    }

    return NextResponse.json({ proposal_id: proposal.id });
  } catch (error) {
    console.error('Error in access validate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
