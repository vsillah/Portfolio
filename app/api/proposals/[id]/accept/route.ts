// API Route: Accept Proposal
// POST - Accept proposal and create Stripe Checkout Session

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createCheckoutSession } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch proposal
    const { data: proposal, error: fetchError } = await supabaseAdmin
      .from('proposals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // Check if proposal can be accepted
    const isExpired = proposal.valid_until && new Date(proposal.valid_until) < new Date();
    if (isExpired) {
      return NextResponse.json({ error: 'This proposal has expired' }, { status: 400 });
    }

    if (!proposal.signed_at) {
      return NextResponse.json(
        { error: 'Proposal must be signed before accepting' },
        { status: 400 }
      );
    }

    // Require contract signature when a contract PDF exists (post–contract feature)
    if (proposal.contract_pdf_url && !proposal.contract_signed_at) {
      return NextResponse.json(
        { error: 'Contract must be signed before payment. Please sign the Software Agreement and try again.' },
        { status: 400 }
      );
    }

    if (!['draft', 'sent', 'viewed', 'accepted'].includes(proposal.status)) {
      return NextResponse.json(
        { error: `Proposal cannot be accepted. Current status: ${proposal.status}` },
        { status: 400 }
      );
    }

    // Mark proposal as accepted (skip if already accepted, e.g. re-creating checkout)
    if (!['accepted'].includes(proposal.status)) {
      const { error: updateError } = await supabaseAdmin
        .from('proposals')
        .update({
          accepted_at: new Date().toISOString(),
          status: 'accepted',
        })
        .eq('id', id);

      if (updateError) {
        console.error('Error accepting proposal:', updateError);
        return NextResponse.json({ error: 'Failed to accept proposal' }, { status: 500 });
      }
    }

    // Create Stripe Checkout Session - use request origin for dev, env var for production
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const returnPath = proposal.access_code
      ? `/proposal/${proposal.access_code}`
      : `/proposal/${proposal.id}`;

    // Build line items from proposal
    const lineItems = proposal.line_items.map((item: any) => ({
      name: item.title,
      description: item.description || undefined,
      amount: item.price,
    }));

    // If there's a discount, add it as a negative line item or adjust
    // For simplicity, we'll create a single line item for the total
    const checkoutLineItems = proposal.discount_amount > 0
      ? [{
          name: proposal.bundle_name,
          description: `Includes ${proposal.line_items.length} items${proposal.discount_description ? ` - ${proposal.discount_description}` : ''}`,
          amount: proposal.total_amount,
        }]
      : lineItems;

    const session = await createCheckoutSession({
      proposalId: proposal.id,
      clientEmail: proposal.client_email,
      lineItems: checkoutLineItems,
      successUrl: `${baseUrl}${returnPath}?payment=success`,
      cancelUrl: `${baseUrl}${returnPath}?payment=cancelled`,
      metadata: {
        salesSessionId: proposal.sales_session_id || '',
        bundleId: proposal.bundle_id || '',
        clientName: proposal.client_name,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }

    // Store checkout session ID on proposal
    await supabaseAdmin
      .from('proposals')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', id);

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      checkoutSessionId: session.id,
    });

  } catch (error) {
    console.error('Error in proposal accept:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
