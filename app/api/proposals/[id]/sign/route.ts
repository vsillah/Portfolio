// API Route: Sign Proposal
// POST - Public: record electronic signature on a proposal

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const SIGNABLE_STATUSES = ['draft', 'sent', 'viewed'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const body = await request.json();
    const { signed_by_name, signature_data } = body;

    if (!signed_by_name || typeof signed_by_name !== 'string') {
      return NextResponse.json({ error: 'signed_by_name is required' }, { status: 400 });
    }

    const { data: proposal, error: fetchError } = await supabaseAdmin
      .from('proposals')
      .select('id, status, valid_until')
      .eq('id', id)
      .single();

    if (fetchError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    if (!SIGNABLE_STATUSES.includes(proposal.status)) {
      return NextResponse.json(
        { error: `Proposal cannot be signed. Current status: ${proposal.status}` },
        { status: 400 }
      );
    }

    const isExpired = proposal.valid_until && new Date(proposal.valid_until) < new Date();
    if (isExpired) {
      return NextResponse.json({ error: 'This proposal has expired' }, { status: 400 });
    }

    const signedIp =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const { error: updateError } = await supabaseAdmin
      .from('proposals')
      .update({
        signed_at: new Date().toISOString(),
        signed_by_name: signed_by_name.trim(),
        signed_ip: signedIp,
        signature_data: signature_data ?? null,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error signing proposal:', updateError);
      return NextResponse.json({ error: 'Failed to record signature' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in proposal sign:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
