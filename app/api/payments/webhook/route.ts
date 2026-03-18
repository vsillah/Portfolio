import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { printful } from '@/lib/printful'
import Stripe from 'stripe'
import type { GuaranteeCondition } from '@/lib/guarantees'
import { materializeCriteria, calculateDeadline } from '@/lib/campaigns'
import type { PersonalizationContext } from '@/lib/campaigns'
import { recordCostEvent } from '@/lib/cost-calculator'
import { parsePrintfulPrice } from '@/lib/printful'
import { notifyOrderConfirmation, type OrderConfirmationItem } from '@/lib/notifications'
import { generateInvoicePDFBuffer, type InvoicePDFData } from '@/lib/invoice-pdf'

export const dynamic = 'force-dynamic'

/**
 * Log Stripe processing fee to cost_events for P&L tracking.
 * Fetches balance_transaction from the charge; fee is in cents.
 */
async function logStripeFee(paymentIntentId: string, orderId: number): Promise<void> {
  if (!stripe) return
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
    const chargeId = pi.latest_charge
    if (!chargeId || typeof chargeId !== 'string') return
    const charge = await stripe.charges.retrieve(chargeId, { expand: ['balance_transaction'] })
    const bt = charge.balance_transaction as Stripe.BalanceTransaction | undefined
    const feeCents = bt?.fee ?? 0
    if (feeCents <= 0) return
    const feeDollars = feeCents / 100
    await recordCostEvent({
      occurred_at: new Date().toISOString(),
      source: 'stripe_fee',
      amount: feeDollars,
      reference_type: 'order',
      reference_id: String(orderId),
      metadata: { payment_intent: paymentIntentId, charge: chargeId },
    })
  } catch (err) {
    console.error('[Stripe] Failed to log fee for payment', paymentIntentId, err)
  }
}

// Type for order item from query
type OrderItemRow = {
  product_variant_id: number | null
  printful_variant_id: string | null
  quantity: number
}

// ============================================================================
// Guarantee Activation Helper
// ============================================================================
async function activateGuaranteesForOrder(orderId: number, clientEmail: string, clientName: string | null, userId: string | null) {
  try {
    // Fetch order items with their content_offer_roles and guarantee templates
    const { data: orderItems } = await supabaseAdmin
      .from('order_items')
      .select('id, product_id, service_id, price_at_purchase')
      .eq('order_id', orderId)

    if (!orderItems || orderItems.length === 0) return

    for (const item of orderItems) {
      // Determine content_type and content_id
      const contentType = item.service_id ? 'service' : item.product_id ? 'product' : null
      const contentId = item.service_id || item.product_id?.toString()

      if (!contentType || !contentId) continue

      // Look up content_offer_role with guarantee template
      const { data: offerRole } = await supabaseAdmin
        .from('content_offer_roles')
        .select('guarantee_template_id')
        .eq('content_type', contentType)
        .eq('content_id', contentId)
        .not('guarantee_template_id', 'is', null)
        .single()

      if (!offerRole?.guarantee_template_id) continue

      // Fetch the guarantee template
      const { data: template } = await supabaseAdmin
        .from('guarantee_templates')
        .select('*')
        .eq('id', offerRole.guarantee_template_id)
        .eq('is_active', true)
        .single()

      if (!template) continue

      const conditions = (template.conditions || []) as GuaranteeCondition[]
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + template.duration_days)

      // Create guarantee instance
      const { data: instance, error: instanceError } = await supabaseAdmin
        .from('guarantee_instances')
        .insert({
          order_id: orderId,
          order_item_id: item.id,
          guarantee_template_id: template.id,
          client_email: clientEmail,
          client_name: clientName,
          user_id: userId,
          purchase_amount: item.price_at_purchase || 0,
          payout_type: template.default_payout_type,
          status: 'active',
          conditions_snapshot: conditions,
          starts_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single()

      if (instanceError) {
        console.error(`Error creating guarantee instance for order item ${item.id}:`, instanceError)
        continue
      }

      // Create milestones for each condition
      if (instance && conditions.length > 0) {
        const milestones = conditions.map((c: GuaranteeCondition) => ({
          guarantee_instance_id: instance.id,
          condition_id: c.id,
          condition_label: c.label,
          status: 'pending',
        }))

        const { error: milestoneError } = await supabaseAdmin
          .from('guarantee_milestones')
          .insert(milestones)

        if (milestoneError) {
          console.error(`Error creating milestones for guarantee ${instance.id}:`, milestoneError)
        }
      }

      console.log(`Guarantee instance ${instance?.id} activated for order ${orderId}, item ${item.id}`)
    }
  } catch (error: any) {
    console.error('Error activating guarantees for order:', error)
    // Don't fail the webhook for guarantee activation errors
  }
}

// ============================================================================
// Campaign Auto-Enrollment Helper
// ============================================================================
async function autoEnrollInCampaigns(
  orderId: number,
  bundleId: string | null,
  clientEmail: string,
  clientName: string | null,
  userId: string | null,
  purchaseAmount: number
) {
  try {
    if (!bundleId) return

    const now = new Date().toISOString()

    // Find active campaigns where this bundle is eligible
    const { data: eligibleCampaigns } = await supabaseAdmin
      .from('campaign_eligible_bundles')
      .select(`
        campaign_id,
        override_min_amount,
        attraction_campaigns!inner (
          id, status, starts_at, ends_at, enrollment_deadline,
          completion_window_days, min_purchase_amount
        )
      `)
      .eq('bundle_id', bundleId)

    if (!eligibleCampaigns || eligibleCampaigns.length === 0) return

    for (const ec of eligibleCampaigns) {
      const campaign = ec.attraction_campaigns as unknown as {
        id: string; status: string; starts_at: string | null; ends_at: string | null;
        enrollment_deadline: string | null; completion_window_days: number; min_purchase_amount: number;
      }

      // Check campaign is active and within enrollment window
      if (campaign.status !== 'active') continue
      if (campaign.starts_at && campaign.starts_at > now) continue
      if (campaign.ends_at && campaign.ends_at < now) continue
      if (campaign.enrollment_deadline && campaign.enrollment_deadline < now) continue

      // Check minimum purchase amount
      const minAmount = ec.override_min_amount ?? campaign.min_purchase_amount ?? 0
      if (purchaseAmount < minAmount) continue

      // Check for existing active enrollment
      const { data: existing } = await supabaseAdmin
        .from('campaign_enrollments')
        .select('id')
        .eq('campaign_id', campaign.id)
        .eq('client_email', clientEmail)
        .in('status', ['active', 'criteria_met', 'payout_pending'])
        .limit(1)

      if (existing && existing.length > 0) continue

      // Check audit prerequisite
      const { data: audits } = await supabaseAdmin
        .from('diagnostic_audits')
        .select('*')
        .eq('email', clientEmail)
        .order('created_at', { ascending: false })
        .limit(1)

      if (!audits || audits.length === 0) {
        console.log(`Campaign auto-enroll skipped for ${clientEmail} in campaign ${campaign.id}: no audit data`)
        continue
      }

      const auditData = audits[0]

      // Build personalization context
      let valueEvidence: Record<string, unknown> | null = null
      const { data: evidence } = await supabaseAdmin
        .from('value_evidence')
        .select('*')
        .eq('contact_email', clientEmail)
        .order('created_at', { ascending: false })
        .limit(1)

      if (evidence && evidence.length > 0) valueEvidence = evidence[0]

      const personalizationContext: PersonalizationContext = {
        audit_data: auditData as Record<string, unknown>,
        value_evidence: valueEvidence as Record<string, unknown> | undefined,
      }

      // Fetch criteria templates
      const { data: templates } = await supabaseAdmin
        .from('campaign_criteria_templates')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('display_order', { ascending: true })

      // Create enrollment
      const enrolledAt = new Date()
      const deadlineAt = calculateDeadline(enrolledAt, campaign.completion_window_days)

      const { data: enrollment, error: enrollError } = await supabaseAdmin
        .from('campaign_enrollments')
        .insert({
          campaign_id: campaign.id,
          client_email: clientEmail,
          client_name: clientName,
          user_id: userId,
          order_id: orderId,
          bundle_id: bundleId,
          purchase_amount: purchaseAmount,
          enrollment_source: 'auto_purchase',
          status: 'active',
          enrolled_at: enrolledAt.toISOString(),
          deadline_at: deadlineAt.toISOString(),
          diagnostic_audit_id: auditData.id,
          personalization_context: personalizationContext,
        })
        .select()
        .single()

      if (enrollError) {
        console.error(`Error auto-enrolling ${clientEmail} in campaign ${campaign.id}:`, enrollError)
        continue
      }

      // Materialize criteria and create progress rows
      if (templates && templates.length > 0 && enrollment) {
        const materializedCriteria = materializeCriteria(templates, personalizationContext)
        const criteriaInserts = materializedCriteria.map((c) => ({
          ...c,
          enrollment_id: enrollment.id,
        }))

        const { data: insertedCriteria, error: criteriaError } = await supabaseAdmin
          .from('enrollment_criteria')
          .insert(criteriaInserts)
          .select()

        if (criteriaError) {
          console.error(`Error materializing criteria for enrollment ${enrollment.id}:`, criteriaError)
        } else if (insertedCriteria) {
          const progressInserts = insertedCriteria.map((c: { id: string; tracking_source: string }) => ({
            enrollment_id: enrollment.id,
            criterion_id: c.id,
            status: 'pending',
            progress_value: 0,
            auto_tracked: c.tracking_source !== 'manual',
          }))

          await supabaseAdmin.from('campaign_progress').insert(progressInserts)
        }
      }

      console.log(`Auto-enrolled ${clientEmail} in campaign ${campaign.id} (enrollment ${enrollment?.id})`)
    }
  } catch (error) {
    console.error('Error in campaign auto-enrollment:', error)
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature' },
      { status: 400 }
    )
  }

  if (!stripe) {
    return NextResponse.json(
      { error: 'Stripe not configured' },
      { status: 500 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // ---- Installment subscription checkout ----
        if (session.metadata?.installment === 'true' && session.mode === 'subscription') {
          const installmentPlanId = session.metadata?.installmentPlanId;
          const subscriptionId = session.subscription as string;

          if (installmentPlanId && subscriptionId) {
            await supabaseAdmin
              .from('installment_plans')
              .update({
                stripe_subscription_id: subscriptionId,
                status: 'active',
                updated_at: new Date().toISOString(),
              })
              .eq('id', installmentPlanId);

            // If this is for a proposal, mark it as accepted
            const proposalIdForInstallment = session.metadata?.proposalId;
            if (proposalIdForInstallment) {
              await supabaseAdmin
                .from('proposals')
                .update({
                  status: 'accepted',
                  accepted_at: new Date().toISOString(),
                  stripe_checkout_session_id: session.id,
                })
                .eq('id', proposalIdForInstallment);
            }

            console.log(`Installment plan ${installmentPlanId} activated with subscription ${subscriptionId}`);
          }
          break;
        }

        // ---- Standard proposal payment checkout ----
        const proposalId = session.metadata?.proposalId;
        
        if (proposalId) {
          // This is a proposal payment
          console.log(`Processing proposal payment for proposal ${proposalId}`);
          
          // Fetch the proposal
          const { data: proposal } = await supabaseAdmin
            .from('proposals')
            .select('*')
            .eq('id', proposalId)
            .single();
          
          if (proposal) {
            // Create order record
            const { data: order, error: orderError } = await supabaseAdmin
              .from('orders')
              .insert({
                user_id: null, // Proposals are typically for guests
                guest_email: proposal.client_email,
                guest_name: proposal.client_name,
                total_amount: proposal.subtotal,
                discount_amount: proposal.discount_amount || 0,
                final_amount: proposal.total_amount,
                status: 'completed',
                stripe_payment_intent_id: session.payment_intent as string,
                proposal_id: proposal.id,
                sales_session_id: proposal.sales_session_id,
              })
              .select()
              .single();
            
            if (orderError) {
              console.error('Error creating order for proposal:', orderError);
            } else {
              // Create order items from proposal line items
              const orderItems = proposal.line_items.map((item: any) => ({
                order_id: order.id,
                product_id: item.content_type === 'product' ? item.content_id : null,
                quantity: 1,
                price: item.price,
                total: item.price,
                item_type: item.content_type,
                item_name: item.title,
                item_metadata: {
                  content_type: item.content_type,
                  content_id: item.content_id,
                  offer_role: item.offer_role,
                },
              }));
              
              await supabaseAdmin
                .from('order_items')
                .insert(orderItems);
              
              // Update proposal with order ID and status
              await supabaseAdmin
                .from('proposals')
                .update({
                  status: 'paid',
                  paid_at: new Date().toISOString(),
                  order_id: order.id,
                  stripe_payment_intent_id: session.payment_intent as string,
                })
                .eq('id', proposalId);
              
              // Update sales session outcome if linked
              if (proposal.sales_session_id) {
                await supabaseAdmin
                  .from('sales_sessions')
                  .update({
                    outcome: 'converted',
                    actual_revenue: proposal.total_amount,
                  })
                  .eq('id', proposal.sales_session_id);
              }
              
              console.log(`Proposal ${proposalId} marked as paid, order ${order.id} created`)

              // Log Stripe fee for cost tracking
              const paymentIntentId = session.payment_intent as string
              if (paymentIntentId) {
                logStripeFee(paymentIntentId, order.id).catch(() => {})
              }

              // Send order confirmation email for proposal payment
              try {
                const proposalItems: OrderConfirmationItem[] = proposal.line_items.map((item: any) => ({
                  name: item.title || 'Item',
                  quantity: 1,
                  unitPrice: item.price ?? 0,
                  lineTotal: item.price ?? 0,
                }))

                const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://amadutown.com'
                const purchasesUrl = `${siteUrl}/purchases?orderId=${order.id}`
                const logoUrl = `${siteUrl}/logo.png`

                let invoicePdfBuffer: Buffer | undefined
                try {
                  const pdfData: InvoicePDFData = {
                    id: order.id,
                    created_at: order.created_at,
                    total_amount: proposal.subtotal ?? 0,
                    discount_amount: proposal.discount_amount,
                    final_amount: proposal.total_amount ?? 0,
                    status: 'completed',
                    order_items: proposal.line_items.map((item: any, idx: number) => ({
                      id: idx,
                      quantity: 1,
                      price_at_purchase: item.price ?? 0,
                      products: item.content_type === 'product' ? { title: item.title } : null,
                      services: item.content_type === 'service' ? { title: item.title } : null,
                    })),
                  }
                  invoicePdfBuffer = await generateInvoicePDFBuffer(pdfData, { logoUrl })
                } catch (pdfErr) {
                  console.error('[Order Email] Failed to generate proposal invoice PDF:', pdfErr)
                }

                await notifyOrderConfirmation({
                  clientEmail: proposal.client_email,
                  clientName: proposal.client_name,
                  orderId: order.id,
                  orderDate: order.created_at,
                  items: proposalItems,
                  subtotal: proposal.subtotal ?? 0,
                  discountAmount: proposal.discount_amount ?? 0,
                  totalAmount: proposal.total_amount ?? 0,
                  purchasesUrl,
                  invoicePdfBuffer,
                })

                console.log(`[Order Email] Proposal confirmation sent to ${proposal.client_email} for order ${order.id}`)
              } catch (emailErr) {
                console.error('[Order Email] Failed to send proposal confirmation:', emailErr)
              }
              
              // Activate guarantees for purchased items
              await activateGuaranteesForOrder(
                order.id,
                proposal.client_email,
                proposal.client_name,
                null // Proposals are typically for guests
              );

              // Auto-enroll in attraction campaigns
              const bundleId = proposal.bundle_id || session.metadata?.bundleId || null;
              await autoEnrollInCampaigns(
                order.id,
                bundleId,
                proposal.client_email,
                proposal.client_name,
                null,
                proposal.total_amount || 0
              );
              
              // Create client project + onboarding plan
              try {
                const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
                
                const projectResponse = await fetch(`${baseUrl}/api/client-projects`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ proposal_id: proposalId }),
                });
                
                if (projectResponse.ok) {
                  const projectData = await projectResponse.json();
                  console.log(
                    `Client project ${projectData.client_project_id} created with onboarding plan ${projectData.onboarding_plan_id}`
                  );
                } else if (projectResponse.status === 409) {
                  console.log('Client project already exists for this proposal');
                } else {
                  console.error('Failed to create client project:', await projectResponse.text());
                }
              } catch (projectError: any) {
                console.error('Error creating client project from webhook:', projectError);
                // Don't fail the webhook for project creation errors
              }
            }
          }
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata?.orderId

        if (orderId) {
          // Update order status to completed
          const { data: order } = await supabaseAdmin
            .from('orders')
            .update({
              status: 'completed',
              stripe_payment_intent_id: paymentIntent.id,
            })
            .eq('id', parseInt(orderId))
            .select()
            .single()

          // Log Stripe fee for cost tracking
          logStripeFee(paymentIntent.id, parseInt(orderId)).catch(() => {})

          // Send order confirmation email with invoice PDF
          if (order) {
            try {
              const [{ data: emailItems }, { data: profile }] = await Promise.all([
                supabaseAdmin
                  .from('order_items')
                  .select('id, quantity, price_at_purchase, products(title), services(title)')
                  .eq('order_id', order.id),
                order.user_id
                  ? supabaseAdmin
                      .from('user_profiles')
                      .select('email, full_name')
                      .eq('id', order.user_id)
                      .single()
                  : Promise.resolve({ data: null }),
              ])

              let recipientEmail = order.guest_email || ''
              let recipientName: string | null = order.guest_name || null

              if (profile?.email) {
                recipientEmail = profile.email
                recipientName = profile.full_name || recipientName
              }

              if (recipientEmail && emailItems) {
                const items: OrderConfirmationItem[] = emailItems.map((i: any) => ({
                  name: i.products?.title ?? i.services?.title ?? 'Item',
                  quantity: i.quantity,
                  unitPrice: i.price_at_purchase ?? 0,
                  lineTotal: (i.price_at_purchase ?? 0) * i.quantity,
                }))

                const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://amadutown.com'
                const purchasesUrl = `${siteUrl}/purchases?orderId=${order.id}`
                const logoUrl = `${siteUrl}/logo.png`

                let invoicePdfBuffer: Buffer | undefined
                try {
                  const pdfData: InvoicePDFData = {
                    id: order.id,
                    created_at: order.created_at,
                    total_amount: order.total_amount ?? 0,
                    discount_amount: order.discount_amount,
                    final_amount: order.final_amount ?? 0,
                    shipping_cost: order.shipping_cost,
                    tax: order.tax,
                    status: 'completed',
                    fulfillment_status: order.fulfillment_status,
                    shipping_address: order.shipping_address as any,
                    order_items: emailItems.map((i: any) => ({
                      id: i.id,
                      quantity: i.quantity,
                      price_at_purchase: i.price_at_purchase ?? 0,
                      products: i.products ? { title: i.products.title } : null,
                      services: i.services ? { title: i.services.title } : null,
                    })),
                  }
                  invoicePdfBuffer = await generateInvoicePDFBuffer(pdfData, { logoUrl })
                } catch (pdfErr) {
                  console.error('[Order Email] Failed to generate invoice PDF, sending without attachment:', pdfErr)
                }

                await notifyOrderConfirmation({
                  clientEmail: recipientEmail,
                  clientName: recipientName,
                  orderId: order.id,
                  orderDate: order.created_at,
                  items,
                  subtotal: order.total_amount ?? 0,
                  discountAmount: order.discount_amount ?? 0,
                  shippingCost: order.shipping_cost ?? 0,
                  tax: order.tax ?? 0,
                  totalAmount: order.final_amount ?? 0,
                  purchasesUrl,
                  invoicePdfBuffer,
                })

                console.log(`[Order Email] Confirmation sent to ${recipientEmail} for order ${order.id}`)
              }
            } catch (emailErr) {
              console.error('[Order Email] Failed to send confirmation:', emailErr)
            }
          }

          // Activate guarantees for purchased items
          if (order) {
            await activateGuaranteesForOrder(
              order.id,
              order.guest_email || '',
              order.guest_name || null,
              order.user_id || null
            )

            // Auto-enroll in attraction campaigns
            const bundleId = paymentIntent.metadata?.bundleId || null
            await autoEnrollInCampaigns(
              order.id,
              bundleId,
              order.guest_email || '',
              order.guest_name || null,
              order.user_id || null,
              order.final_amount || order.total_amount || 0
            )
          }

          // If order has merchandise items, submit to Printful (skip in Stripe test mode to avoid creating real Printful orders)
          if (!order) {
            // order already handled above
          } else if (event.livemode === false) {
            console.log(`[Printful] Stripe test mode (livemode=false): skipping Printful submission so no real order is created. Order ${order.id} would have been submitted.`)
          } else if (!order.shipping_address) {
            console.warn(`[Printful] Order ${order.id} skipped: no shipping_address (required for fulfillment)`)
          } else if (order.printful_order_id) {
            console.log(`[Printful] Order ${order.id} already submitted (printful_order_id=${order.printful_order_id})`)
          } else {
            try {
              // Check if order has merchandise items
              const { data: orderItems } = await supabaseAdmin
                .from('order_items')
                .select('product_variant_id, printful_variant_id, quantity')
                .eq('order_id', order.id)
                .not('product_variant_id', 'is', null)

              if (!orderItems || orderItems.length === 0) {
                console.warn(`[Printful] Order ${order.id} skipped: no merchandise order items (product_variant_id)`)
              } else {
                // Build Printful items (variant_id must be number for Printful API)
                const printfulItems = orderItems
                  .filter((item: OrderItemRow) => item.printful_variant_id != null)
                  .map((item: OrderItemRow) => ({
                    variant_id: Number(item.printful_variant_id),
                    quantity: item.quantity,
                  }))

                if (printfulItems.length === 0) {
                  console.warn(`[Printful] Order ${order.id} skipped: merchandise items have no printful_variant_id (sync products from Printful and ensure variants are linked)`)
                } else if (printfulItems.length < orderItems.length) {
                  console.warn(`[Printful] Order ${order.id}: only ${printfulItems.length}/${orderItems.length} items have printful_variant_id; submitting those`)
                }

                if (printfulItems.length > 0) {
                  const shippingAddress = order.shipping_address as any
                  let customerEmail = order.guest_email
                  let customerName = order.guest_name

                  if (order.user_id) {
                    const { data: userProfile } = await supabaseAdmin
                      .from('user_profiles')
                      .select('email, full_name')
                      .eq('id', order.user_id)
                      .single()

                    if (userProfile) {
                      customerEmail = userProfile.email
                      customerName = userProfile.full_name || customerName
                    }
                  }

                  // Submit to Printful
                  const printfulOrder = await printful.createOrder(
                    order.id.toString(),
                    {
                      name: customerName || 'Customer',
                      email: customerEmail || '',
                      phone: shippingAddress.phone || '',
                      address1: shippingAddress.address1 || '',
                      address2: shippingAddress.address2 || '',
                      city: shippingAddress.city || '',
                      state_code: shippingAddress.state_code || '',
                      country_code: shippingAddress.country_code || 'US',
                      zip: shippingAddress.zip || '',
                    },
                    printfulItems,
                    {
                      subtotal: order.total_amount?.toString() || '0',
                      shipping: order.shipping_cost?.toString() || '0',
                      tax: order.tax?.toString() || '0',
                    }
                  )

                  // Update order with Printful order ID
                  await supabaseAdmin
                    .from('orders')
                    .update({
                      printful_order_id: printfulOrder.id,
                      fulfillment_status: 'processing',
                    })
                    .eq('id', order.id)

                  // Log Printful fulfillment cost for P&L tracking
                  const fulfillmentCost = printfulOrder.costs?.total != null ? parsePrintfulPrice(printfulOrder.costs.total) : 0
                  if (fulfillmentCost > 0) {
                    recordCostEvent({
                      occurred_at: new Date().toISOString(),
                      source: 'printful_fulfillment',
                      amount: fulfillmentCost,
                      reference_type: 'order',
                      reference_id: String(order.id),
                      metadata: { printful_order_id: printfulOrder.id },
                    }).catch(() => {})
                  }

                  console.log(`[Printful] Order ${order.id} automatically submitted to Printful: ${printfulOrder.id}`)
                }
              }
            } catch (fulfillError: any) {
              console.error('[Printful] Auto-fulfill failed for order', order.id, fulfillError?.message || fulfillError)
              if (fulfillError?.message) console.error('[Printful] Full error:', fulfillError.message)
              // Don't fail the webhook - order is still marked as paid; admin can manually fulfill via POST /api/orders/fulfill
            }
          }
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata?.orderId

        if (orderId) {
          // Update order status to failed
          await supabaseAdmin
            .from('orders')
            .update({ status: 'failed' })
            .eq('id', parseInt(orderId))
            .eq('stripe_payment_intent_id', paymentIntent.id)
        }
        break
      }

      // ================================================================
      // Subscription webhook events (for continuity billing)
      // ================================================================

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string

        if (subscriptionId) {
          // ---- Check if this is an installment subscription ----
          const { data: installmentPlan } = await supabaseAdmin
            .from('installment_plans')
            .select('*')
            .eq('stripe_subscription_id', subscriptionId)
            .single()

          if (installmentPlan) {
            const newPaidCount = (installmentPlan.installments_paid || 0) + 1
            const amountPaid = (invoice.amount_paid || 0) / 100

            await supabaseAdmin
              .from('installment_payments')
              .insert({
                installment_plan_id: installmentPlan.id,
                payment_number: newPaidCount,
                stripe_invoice_id: invoice.id,
                amount: amountPaid,
                status: 'paid',
                paid_at: new Date().toISOString(),
              })

            const isComplete = newPaidCount >= installmentPlan.num_installments

            await supabaseAdmin
              .from('installment_plans')
              .update({
                installments_paid: newPaidCount,
                status: isComplete ? 'completed' : 'active',
                updated_at: new Date().toISOString(),
              })
              .eq('id', installmentPlan.id)

            console.log(`Installment ${newPaidCount}/${installmentPlan.num_installments} paid for plan ${installmentPlan.id}`)

            if (isComplete) {
              // Cancel the subscription since all installments are paid
              if (stripe) {
                try {
                  await stripe.subscriptions.cancel(subscriptionId)
                  console.log(`Installment subscription ${subscriptionId} canceled after final payment`)
                } catch (cancelErr) {
                  console.error(`Failed to cancel installment subscription ${subscriptionId}:`, cancelErr)
                }
              }

              // If linked to a proposal, create the order and mark paid
              if (installmentPlan.proposal_id) {
                const { data: proposal } = await supabaseAdmin
                  .from('proposals')
                  .select('*')
                  .eq('id', installmentPlan.proposal_id)
                  .single()

                if (proposal && proposal.status !== 'paid') {
                  const { data: order, error: orderError } = await supabaseAdmin
                    .from('orders')
                    .insert({
                      user_id: null,
                      guest_email: proposal.client_email,
                      guest_name: proposal.client_name,
                      total_amount: proposal.subtotal,
                      discount_amount: proposal.discount_amount || 0,
                      final_amount: proposal.total_amount,
                      status: 'completed',
                      proposal_id: proposal.id,
                      sales_session_id: proposal.sales_session_id,
                    })
                    .select()
                    .single()

                  if (!orderError && order) {
                    const orderItems = proposal.line_items.map((item: any) => ({
                      order_id: order.id,
                      product_id: item.content_type === 'product' ? item.content_id : null,
                      quantity: 1,
                      price: item.price,
                      total: item.price,
                      item_type: item.content_type,
                      item_name: item.title,
                      item_metadata: {
                        content_type: item.content_type,
                        content_id: item.content_id,
                        offer_role: item.offer_role,
                      },
                    }))

                    await supabaseAdmin.from('order_items').insert(orderItems)

                    await supabaseAdmin
                      .from('proposals')
                      .update({
                        status: 'paid',
                        paid_at: new Date().toISOString(),
                        order_id: order.id,
                      })
                      .eq('id', proposal.id)

                    if (proposal.sales_session_id) {
                      await supabaseAdmin
                        .from('sales_sessions')
                        .update({
                          outcome: 'converted',
                          actual_revenue: proposal.total_amount,
                        })
                        .eq('id', proposal.sales_session_id)
                    }

                    await activateGuaranteesForOrder(
                      order.id,
                      proposal.client_email,
                      proposal.client_name,
                      null
                    )

                    const bundleId = proposal.bundle_id || null
                    await autoEnrollInCampaigns(
                      order.id,
                      bundleId,
                      proposal.client_email,
                      proposal.client_name,
                      null,
                      proposal.total_amount || 0
                    )

                    console.log(`Installment plan ${installmentPlan.id} completed. Proposal ${proposal.id} marked paid, order ${order.id} created.`)
                  }
                }
              }

              // If linked to a store order, mark it completed
              if (installmentPlan.order_id) {
                await supabaseAdmin
                  .from('orders')
                  .update({ status: 'completed' })
                  .eq('id', installmentPlan.order_id)

                console.log(`Installment plan ${installmentPlan.id} completed. Order ${installmentPlan.order_id} marked completed.`)
              }
            }

            break
          }

          // ---- Continuity subscription (existing logic) ----
          const { data: sub } = await supabaseAdmin
            .from('client_subscriptions')
            .select('id, cycles_completed, credit_remaining, continuity_plan_id')
            .eq('stripe_subscription_id', subscriptionId)
            .single()

          if (sub) {
            const amountPaid = (invoice.amount_paid || 0) / 100
            const newCreditRemaining = Math.max(0, (sub.credit_remaining || 0) - amountPaid)

            await supabaseAdmin
              .from('client_subscriptions')
              .update({
                status: 'active',
                cycles_completed: (sub.cycles_completed || 0) + 1,
                credit_remaining: newCreditRemaining,
                current_period_start: invoice.period_start
                  ? new Date(invoice.period_start * 1000).toISOString()
                  : undefined,
                current_period_end: invoice.period_end
                  ? new Date(invoice.period_end * 1000).toISOString()
                  : undefined,
              })
              .eq('id', sub.id)

            console.log(`Subscription ${subscriptionId} invoice paid. Cycle ${sub.cycles_completed + 1}. Credit remaining: $${newCreditRemaining.toFixed(2)}`)
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string

        if (subscriptionId) {
          // Check if installment subscription
          const { data: failedInstallmentPlan } = await supabaseAdmin
            .from('installment_plans')
            .select('id, installments_paid')
            .eq('stripe_subscription_id', subscriptionId)
            .single()

          if (failedInstallmentPlan) {
            await supabaseAdmin
              .from('installment_payments')
              .insert({
                installment_plan_id: failedInstallmentPlan.id,
                payment_number: (failedInstallmentPlan.installments_paid || 0) + 1,
                stripe_invoice_id: invoice.id,
                amount: (invoice.amount_due || 0) / 100,
                status: 'failed',
              })

            console.log(`Installment payment failed for plan ${failedInstallmentPlan.id}`)
            break
          }

          // Continuity subscription
          await supabaseAdmin
            .from('client_subscriptions')
            .update({ status: 'past_due' })
            .eq('stripe_subscription_id', subscriptionId)

          console.log(`Subscription ${subscriptionId} payment failed. Marked past_due.`)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription

        const updateData: Record<string, unknown> = {
          cancel_at_period_end: subscription.cancel_at_period_end,
        }

        if (subscription.status === 'active') updateData.status = 'active'
        if (subscription.status === 'past_due') updateData.status = 'past_due'
        if (subscription.status === 'trialing') updateData.status = 'trialing'
        if (subscription.status === 'paused') updateData.status = 'paused'

        if (subscription.current_period_start) {
          updateData.current_period_start = new Date(subscription.current_period_start * 1000).toISOString()
        }
        if (subscription.current_period_end) {
          updateData.current_period_end = new Date(subscription.current_period_end * 1000).toISOString()
        }

        await supabaseAdmin
          .from('client_subscriptions')
          .update(updateData)
          .eq('stripe_subscription_id', subscription.id)

        console.log(`Subscription ${subscription.id} updated. Status: ${subscription.status}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        // Check if installment subscription
        const { data: deletedInstallmentPlan } = await supabaseAdmin
          .from('installment_plans')
          .select('id, status')
          .eq('stripe_subscription_id', subscription.id)
          .single()

        if (deletedInstallmentPlan) {
          // Only mark as canceled if not already completed
          if (deletedInstallmentPlan.status !== 'completed') {
            await supabaseAdmin
              .from('installment_plans')
              .update({
                status: 'canceled',
                updated_at: new Date().toISOString(),
              })
              .eq('id', deletedInstallmentPlan.id)

            console.log(`Installment plan ${deletedInstallmentPlan.id} subscription canceled.`)
          }
          break
        }

        // Continuity subscription
        await supabaseAdmin
          .from('client_subscriptions')
          .update({
            status: subscription.status === 'canceled' ? 'canceled' : 'expired',
            canceled_at: subscription.canceled_at
              ? new Date(subscription.canceled_at * 1000).toISOString()
              : new Date().toISOString(),
            ended_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id)

        console.log(`Subscription ${subscription.id} deleted/canceled.`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
