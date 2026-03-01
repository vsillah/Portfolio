import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { printful } from '@/lib/printful'
import Stripe from 'stripe'
import type { GuaranteeCondition } from '@/lib/guarantees'
import { materializeCriteria, calculateDeadline } from '@/lib/campaigns'
import type { PersonalizationContext } from '@/lib/campaigns'

export const dynamic = 'force-dynamic'

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
              
              console.log(`Proposal ${proposalId} marked as paid, order ${order.id} created`);
              
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

          // If order has merchandise items, submit to Printful
          if (!order) {
            // order already handled above
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
          // Update client_subscriptions with new period info
          const { data: sub } = await supabaseAdmin
            .from('client_subscriptions')
            .select('id, cycles_completed, credit_remaining, continuity_plan_id')
            .eq('stripe_subscription_id', subscriptionId)
            .single()

          if (sub) {
            const amountPaid = (invoice.amount_paid || 0) / 100 // cents to dollars
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
