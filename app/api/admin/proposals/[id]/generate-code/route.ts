// API Route: Generate Proposal Access Code
// POST - Admin-only: generate 6-char access code for a proposal

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { generateAccessCode } from '@/lib/proposal-access-code';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const { id } = await params;

    const { data: proposal, error: fetchError } = await supabaseAdmin
      .from('proposals')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const maxRetries = 5;
    let code: string | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const candidate = generateAccessCode();
      const { error: updateError } = await supabaseAdmin
        .from('proposals')
        .update({ access_code: candidate })
        .eq('id', id);

      if (!updateError) {
        code = candidate;
        break;
      }
      if (updateError.code !== '23505') {
        console.error('Error updating proposal access code:', updateError);
        return NextResponse.json({ error: 'Failed to generate access code' }, { status: 500 });
      }
    }

    if (!code) {
      return NextResponse.json({ error: 'Failed to generate unique access code' }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const shareableLink = `${baseUrl}/proposal/${code}`;

    return NextResponse.json({
      access_code: code,
      shareable_link: shareableLink,
    });
  } catch (error) {
    console.error('Error in generate-code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
