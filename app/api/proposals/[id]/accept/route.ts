// API Route: Accept Proposal
// POST - Accept proposal and create Stripe Checkout Session (one-time or installment)

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createCheckoutSession, createInstallmentCheckoutSession } from '@/lib/stripe';
import { findOrCreateStripeCustomer } from '@/lib/stripe-subscriptions';
import { calculateInstallmentPlan, getInstallmentFeePercent } from '@/lib/installments';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // No body is fine for pay-in-full (backwards compatible)
    }

    const paymentMode = (body.paymentMode as string) || 'full';
    const numInstallments = (body.numInstallments as number) || undefined;

    const { data: proposal, error: fetchError } = await supabaseAdmin
      .from('proposals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

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

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const returnPath = proposal.access_code
      ? `/proposal/${proposal.access_code}`
      : `/proposal/${proposal.id}`;

    // ---- Installment payment mode ----
    if (paymentMode === 'installments' && numInstallments && numInstallments >= 2) {
      const feePercent = await getInstallmentFeePercent();
      const plan = calculateInstallmentPlan(proposal.total_amount, numInstallments, feePercent);

      const customer = await findOrCreateStripeCustomer(
        proposal.client_email,
        proposal.client_name
      );
      if (!customer) {
        return NextResponse.json({ error: 'Failed to create Stripe customer' }, { status: 500 });
      }

      const { data: installmentPlan, error: insertError } = await supabaseAdmin
        .from('installment_plans')
        .insert({
          proposal_id: proposal.id,
          stripe_customer_id: customer.id,
          num_installments: plan.numInstallments,
          installment_amount: plan.installmentAmount,
          fee_percent: plan.feePercent,
          fee_amount: plan.feeAmount,
          total_with_fee: plan.totalWithFee,
          base_amount: plan.baseAmount,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError || !installmentPlan) {
        console.error('Error creating installment plan:', insertError);
        return NextResponse.json({ error: 'Failed to create installment plan' }, { status: 500 });
      }

      const session = await createInstallmentCheckoutSession({
        customerId: customer.id,
        installmentAmount: plan.installmentAmount,
        numInstallments: plan.numInstallments,
        productName: proposal.bundle_name,
        successUrl: `${baseUrl}${returnPath}?payment=success`,
        cancelUrl: `${baseUrl}${returnPath}?payment=cancelled`,
        metadata: {
          installmentPlanId: installmentPlan.id,
          proposalId: proposal.id,
          salesSessionId: proposal.sales_session_id || '',
          bundleId: proposal.bundle_id || '',
          clientName: proposal.client_name,
        },
      });

      if (!session) {
        return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
      }

      await supabaseAdmin
        .from('proposals')
        .update({ stripe_checkout_session_id: session.id })
        .eq('id', id);

      return NextResponse.json({
        success: true,
        checkoutUrl: session.url,
        checkoutSessionId: session.id,
        installmentPlan: {
          id: installmentPlan.id,
          numInstallments: plan.numInstallments,
          installmentAmount: plan.installmentAmount,
          totalWithFee: plan.totalWithFee,
          feeAmount: plan.feeAmount,
        },
      });
    }

    // ---- Pay in full (existing behavior) ----
    const lineItems = proposal.line_items.map((item: any) => ({
      name: item.title,
      description: item.description || undefined,
      amount: item.price,
    }));

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
