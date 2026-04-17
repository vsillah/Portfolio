import { ATAS_DARK_BLUE, ATAS_GOLD } from '@/lib/email/branding'

export interface ShipmentEmailInput {
  clientName: string | null
  orderId: number
  trackingNumber?: string | null
  trackingUrl?: string | null
  carrier?: string | null
  purchasesUrl: string
}

export function buildShipmentEmail(input: ShipmentEmailInput): { subject: string; html: string; text: string } {
  const carrierName = input.carrier || 'our shipping partner'
  const trackingLine = input.trackingUrl
    ? `Track your package: ${input.trackingUrl}`
    : input.trackingNumber
      ? `Tracking number: ${input.trackingNumber}`
      : ''

  const trackingHtml = input.trackingUrl
    ? `<a href="${input.trackingUrl}" style="background:${ATAS_GOLD};color:${ATAS_DARK_BLUE};padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;">Track Your Package</a>`
    : input.trackingNumber
      ? `<p style="font-size:14px;">Tracking number: <strong>${input.trackingNumber}</strong></p>`
      : ''

  const subject = `Your Order Has Shipped — Order #${input.orderId}`

  const text = [
    `Hi ${input.clientName || 'there'},`,
    '',
    `Great news! Your order #${input.orderId} has been shipped via ${carrierName}.`,
    '',
    trackingLine,
    '',
    `View your order: ${input.purchasesUrl}`,
    '',
    'Thank you for your business.',
    'We Rise Together.',
    '',
    'Best regards,',
    'Amadutown Advisory Solutions',
  ]
    .filter(Boolean)
    .join('\n')

  const html = `
      <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:${ATAS_DARK_BLUE};padding:20px 24px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Amadutown Advisory Solutions</h1>
        </div>

        <div style="padding:24px;">
          <h2 style="color:${ATAS_DARK_BLUE};margin:0 0 4px;">Your Order Has Shipped!</h2>
          <p style="color:#6b7280;margin:0 0 20px;font-size:14px;">Order #${input.orderId}</p>

          <p>Hi ${input.clientName || 'there'},</p>
          <p>Great news — your order has been shipped${input.carrier ? ` via <strong>${input.carrier}</strong>` : ''}! You should receive it soon.</p>

          ${trackingHtml ? `<div style="text-align:center;margin:28px 0;">${trackingHtml}</div>` : ''}

          <div style="text-align:center;margin:20px 0;">
            <a href="${input.purchasesUrl}" style="color:${ATAS_DARK_BLUE};font-weight:600;text-decoration:underline;">View your order details</a>
          </div>

          <p style="color:#4b5563;font-size:13px;">If you have any questions about your shipment, simply reply to this email and we'll be happy to help.</p>
        </div>

        <div style="background:${ATAS_DARK_BLUE};padding:16px 24px;text-align:center;">
          <p style="margin:0;color:${ATAS_GOLD};font-style:italic;font-size:13px;">We Rise Together</p>
          <p style="margin:4px 0 0;color:#ffffff;font-size:11px;">Amadutown Advisory Solutions</p>
        </div>
      </div>
    `

  return { subject, html, text }
}
