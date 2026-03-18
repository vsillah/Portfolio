import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createInstallmentCheckoutSession } from '@/lib/stripe';
import { findOrCreateStripeCustomer } from '@/lib/stripe-subscriptions';
import { calculateInstallmentPlan, getInstallmentFeePercent } from '@/lib/installments';

export const dynamic = 'force-dynamic';

/**
 * POST /api/installments/create
 * Creates an installment plan and Stripe Checkout Session (subscription mode).
 *
 * Body:
 *  - proposalId?: string   (for proposal payments)
 *  - orderId?: number       (for store checkout)
 *  - clientEmail: string
 *  - clientName?: string
 *  - baseAmount: number     (total to be paid)
 *  - numInstallments: number
 *  - productName: string
 *  - successUrl: string
 *  - cancelUrl: string
 *  - metadata?: Record<string, string>
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      proposalId,
      orderId,
      clientEmail,
      clientName,
      baseAmount,
      numInstallments,
      productName,
      successUrl,
      cancelUrl,
      metadata = {},
    } = body;

    if (!clientEmail || !baseAmount || !numInstallments || !successUrl || !cancelUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: clientEmail, baseAmount, numInstallments, successUrl, cancelUrl' },
        { status: 400 }
      );
    }

    if (numInstallments < 2 || numInstallments > 60) {
      return NextResponse.json(
        { error: 'Number of installments must be between 2 and 60' },
        { status: 400 }
      );
    }

    if (baseAmount <= 0) {
      return NextResponse.json({ error: 'Base amount must be positive' }, { status: 400 });
    }

    const feePercent = await getInstallmentFeePercent();
    const plan = calculateInstallmentPlan(baseAmount, numInstallments, feePercent);

    const customer = await findOrCreateStripeCustomer(clientEmail, clientName || undefined);
    if (!customer) {
      return NextResponse.json({ error: 'Failed to create Stripe customer' }, { status: 500 });
    }

    const installmentPlanInsert: Record<string, unknown> = {
      stripe_customer_id: customer.id,
      num_installments: plan.numInstallments,
      installment_amount: plan.installmentAmount,
      fee_percent: plan.feePercent,
      fee_amount: plan.feeAmount,
      total_with_fee: plan.totalWithFee,
      base_amount: plan.baseAmount,
      status: 'pending',
    };

    if (proposalId) installmentPlanInsert.proposal_id = proposalId;
    if (orderId) installmentPlanInsert.order_id = orderId;

    const { data: installmentPlan, error: insertError } = await supabaseAdmin!
      .from('installment_plans')
      .insert(installmentPlanInsert)
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
      productName: productName || 'Service Payment',
      successUrl,
      cancelUrl,
      metadata: {
        ...metadata,
        installmentPlanId: installmentPlan.id,
        proposalId: proposalId || '',
        orderId: orderId ? String(orderId) : '',
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      checkoutSessionId: session.id,
      installmentPlan: {
        id: installmentPlan.id,
        numInstallments: plan.numInstallments,
        installmentAmount: plan.installmentAmount,
        feePercent: plan.feePercent,
        feeAmount: plan.feeAmount,
        totalWithFee: plan.totalWithFee,
        baseAmount: plan.baseAmount,
      },
    });
  } catch (error) {
    console.error('Error in installments/create:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
