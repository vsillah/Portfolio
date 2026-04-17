import { ATAS_DARK_BLUE, ATAS_GOLD } from '@/lib/email/branding'

export interface OrderConfirmationLineItem {
  name: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface OrderConfirmationEmailInput {
  clientName: string | null
  orderId: number
  orderDate: string
  items: OrderConfirmationLineItem[]
  subtotal: number
  discountAmount?: number
  shippingCost?: number
  tax?: number
  totalAmount: number
  purchasesUrl: string
}

export function buildOrderConfirmationEmail(input: OrderConfirmationEmailInput): {
  subject: string
  html: string
  text: string
} {
  const itemsText = input.items
    .map((i) => `  ${i.name} × ${i.quantity} — $${i.lineTotal.toFixed(2)}`)
    .join('\n')

  const itemsHtml = input.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${i.name}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${i.quantity}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">$${i.unitPrice.toFixed(2)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">$${i.lineTotal.toFixed(2)}</td>
        </tr>`,
    )
    .join('')

  const totalsHtml = [
    `<tr><td style="padding:4px 0;color:#6b7280;">Subtotal</td><td style="padding:4px 0;text-align:right;">$${input.subtotal.toFixed(2)}</td></tr>`,
    input.discountAmount && input.discountAmount > 0
      ? `<tr><td style="padding:4px 0;color:#6b7280;">Discount</td><td style="padding:4px 0;text-align:right;color:#16a34a;">-$${input.discountAmount.toFixed(2)}</td></tr>`
      : '',
    input.shippingCost && input.shippingCost > 0
      ? `<tr><td style="padding:4px 0;color:#6b7280;">Shipping</td><td style="padding:4px 0;text-align:right;">$${input.shippingCost.toFixed(2)}</td></tr>`
      : '',
    input.tax && input.tax > 0
      ? `<tr><td style="padding:4px 0;color:#6b7280;">Tax</td><td style="padding:4px 0;text-align:right;">$${input.tax.toFixed(2)}</td></tr>`
      : '',
    `<tr style="border-top:2px solid #1a2d4a;"><td style="padding:8px 0;font-size:16px;font-weight:700;">Total</td><td style="padding:8px 0;text-align:right;font-size:16px;font-weight:700;">$${input.totalAmount.toFixed(2)}</td></tr>`,
  ]
    .filter(Boolean)
    .join('')

  const orderDateFormatted = new Date(input.orderDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const subject = `Order Confirmed — Order #${input.orderId}`

  const text = [
    `Hi ${input.clientName || 'there'},`,
    '',
    `Thank you for your order! Here's your confirmation for Order #${input.orderId}.`,
    '',
    `Date: ${orderDateFormatted}`,
    '',
    'Items:',
    itemsText,
    '',
    `Total: $${input.totalAmount.toFixed(2)}`,
    '',
    `View your order: ${input.purchasesUrl}`,
    '',
    'Thank you for your business.',
    'We Rise Together.',
    '',
    'Best regards,',
    'Amadutown Advisory Solutions',
  ].join('\n')

  const html = `
      <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:${ATAS_DARK_BLUE};padding:20px 24px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Amadutown Advisory Solutions</h1>
        </div>

        <div style="padding:24px;">
          <h2 style="color:${ATAS_DARK_BLUE};margin:0 0 4px;">Order Confirmed</h2>
          <p style="color:#6b7280;margin:0 0 20px;font-size:14px;">Order #${input.orderId} · ${orderDateFormatted}</p>

          <p>Hi ${input.clientName || 'there'},</p>
          <p>Thank you for your order! Here's a summary of what you purchased.</p>

          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <thead>
              <tr style="background:${ATAS_DARK_BLUE};">
                <th style="padding:10px 12px;color:#ffffff;text-align:left;font-size:12px;text-transform:uppercase;">Item</th>
                <th style="padding:10px 12px;color:#ffffff;text-align:center;font-size:12px;text-transform:uppercase;">Qty</th>
                <th style="padding:10px 12px;color:#ffffff;text-align:right;font-size:12px;text-transform:uppercase;">Price</th>
                <th style="padding:10px 12px;color:#ffffff;text-align:right;font-size:12px;text-transform:uppercase;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <table style="width:220px;margin-left:auto;border-collapse:collapse;">
            <tbody>
              ${totalsHtml}
            </tbody>
          </table>

          <div style="text-align:center;margin:28px 0;">
            <a href="${input.purchasesUrl}" style="background:${ATAS_GOLD};color:${ATAS_DARK_BLUE};padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;">View Your Order</a>
          </div>

          <p style="color:#4b5563;font-size:13px;">If you have any questions about your order, simply reply to this email and we'll be happy to help.</p>
        </div>

        <div style="background:${ATAS_DARK_BLUE};padding:16px 24px;text-align:center;">
          <p style="margin:0;color:${ATAS_GOLD};font-style:italic;font-size:13px;">We Rise Together</p>
          <p style="margin:4px 0 0;color:#ffffff;font-size:11px;">Amadutown Advisory Solutions</p>
        </div>
      </div>
    `

  return { subject, html, text }
}
