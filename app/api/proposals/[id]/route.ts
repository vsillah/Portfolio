// API Route: Get/Update Proposal
// GET - Fetch proposal details (public access for client viewing)
// PATCH - Update proposal status

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';

// GET - Fetch proposal (public access for client viewing via link)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch proposal
    const { data: proposal, error } = await supabaseAdmin
      .from('proposals')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // Mark as viewed if first time
    if (!proposal.viewed_at) {
      await supabaseAdmin
        .from('proposals')
        .update({ 
          viewed_at: new Date().toISOString(),
          status: proposal.status === 'sent' ? 'viewed' : proposal.status,
        })
        .eq('id', id);
      
      proposal.viewed_at = new Date().toISOString();
      if (proposal.status === 'sent') {
        proposal.status = 'viewed';
      }
    }

    // Check validity
    const isExpired = proposal.valid_until && new Date(proposal.valid_until) < new Date();
    const canAccept = !isExpired && ['draft', 'sent', 'viewed'].includes(proposal.status);
    const canPay = proposal.status === 'accepted';

    return NextResponse.json({
      proposal,
      canAccept,
      canPay,
      isExpired,
    });

  } catch (error) {
    console.error('Error in proposal GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update proposal (admin only, except for status changes)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    // Handle public actions (no auth required)
    if (action === 'mark_viewed') {
      const { error } = await supabaseAdmin
        .from('proposals')
        .update({ 
          viewed_at: new Date().toISOString(),
          status: 'viewed',
        })
        .eq('id', id)
        .in('status', ['sent', 'draft']);

      if (error) {
        console.error('Error marking proposal viewed:', error);
        return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // Admin actions require authentication
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    // Handle admin actions
    if (action === 'mark_sent') {
      const { error } = await supabaseAdmin
        .from('proposals')
        .update({ 
          sent_at: new Date().toISOString(),
          status: 'sent',
        })
        .eq('id', id);

      if (error) {
        console.error('Error marking proposal sent:', error);
        return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // General update
    const updateData: Record<string, unknown> = {};
    const allowedFields = ['client_name', 'client_email', 'client_company', 'terms_text', 'valid_until', 'discount_amount', 'discount_description', 'total_amount'];
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabaseAdmin
        .from('proposals')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Error updating proposal:', error);
        return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 });
      }
    }

    // Fetch updated proposal
    const { data: proposal } = await supabaseAdmin
      .from('proposals')
      .select('*')
      .eq('id', id)
      .single();

    return NextResponse.json({ proposal });

  } catch (error) {
    console.error('Error in proposal PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
