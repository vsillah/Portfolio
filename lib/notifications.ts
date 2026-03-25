// Notification Service — Guarantee, Subscription, and Chat lifecycle emails
// Uses Gmail SMTP via Nodemailer. Requires GMAIL_USER and GMAIL_APP_PASSWORD env vars.

import nodemailer from 'nodemailer';

// ============================================================================
// Email sending abstraction
// ============================================================================

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

const gmailUser = process.env.GMAIL_USER;
const gmailPass = process.env.GMAIL_APP_PASSWORD;
const fromName = process.env.EMAIL_FROM_NAME || 'ATAS';

const transporter = gmailUser && gmailPass
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    })
  : null;

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (!transporter || !gmailUser) {
    console.warn('[NOTIFICATION EMAIL] Gmail not configured — logging instead:', {
      to: payload.to,
      subject: payload.subject,
      textPreview: payload.text?.slice(0, 100) || payload.html.slice(0, 100),
    });
    return true;
  }

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${gmailUser}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      attachments: payload.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    return true;
  } catch (err) {
    console.error('[NOTIFICATION EMAIL] Send failed:', err);
    return false;
  }
}

// ============================================================================
// Guarantee Notifications
// ============================================================================

export async function notifyGuaranteeActivated(params: {
  clientEmail: string;
  clientName: string | null;
  guaranteeName: string;
  durationDays: number;
  conditions: { label: string }[];
  expiresAt: string;
}) {
  const conditionsList = params.conditions
    .map((c, i) => `${i + 1}. ${c.label}`)
    .join('\n');

  await sendEmail({
    to: params.clientEmail,
    subject: `Your ${params.guaranteeName} is now active`,
    text: [
      `Hi ${params.clientName || 'there'},`,
      '',
      `Your ${params.guaranteeName} is now active!`,
      '',
      `Duration: ${params.durationDays} days (expires ${new Date(params.expiresAt).toLocaleDateString()})`,
      '',
      'To qualify, you need to meet these conditions:',
      conditionsList,
      '',
      'We\'ll check in periodically to track your progress.',
      '',
      'Best regards,',
      'Your Team',
    ].join('\n'),
    html: `
      <h2>Your ${params.guaranteeName} is now active!</h2>
      <p>Hi ${params.clientName || 'there'},</p>
      <p>Duration: <strong>${params.durationDays} days</strong> (expires ${new Date(params.expiresAt).toLocaleDateString()})</p>
      <h3>Conditions to qualify:</h3>
      <ol>${params.conditions.map(c => `<li>${c.label}</li>`).join('')}</ol>
      <p>We'll check in periodically to track your progress.</p>
    `,
  });
}

export async function notifyMilestoneVerified(params: {
  clientEmail: string;
  clientName: string | null;
  conditionLabel: string;
  metCount: number;
  totalCount: number;
  guaranteeName: string;
}) {
  await sendEmail({
    to: params.clientEmail,
    subject: `Milestone verified: ${params.conditionLabel}`,
    text: [
      `Hi ${params.clientName || 'there'},`,
      '',
      `We've confirmed you completed: "${params.conditionLabel}"`,
      '',
      `Progress: ${params.metCount} of ${params.totalCount} conditions met.`,
      '',
      params.metCount === params.totalCount
        ? 'Congratulations! You\'ve met all conditions. You\'ll receive payout options shortly.'
        : 'Keep going! You\'re making great progress.',
    ].join('\n'),
    html: `
      <h2>Milestone Verified</h2>
      <p>We've confirmed: <strong>${params.conditionLabel}</strong></p>
      <p>Progress: <strong>${params.metCount} of ${params.totalCount}</strong> conditions met.</p>
      ${params.metCount === params.totalCount 
        ? '<p style="color: green;"><strong>All conditions met! Payout options coming soon.</strong></p>' 
        : '<p>Keep going!</p>'}
    `,
  });
}

export async function notifyConditionsMetPayoutChoice(params: {
  clientEmail: string;
  clientName: string | null;
  guaranteeName: string;
  refundAmount: number;
  rolloverCreditAmount?: number;
  bonusMultiplier?: number;
  upsellServiceNames?: string[];
  continuityPlanName?: string;
  choosePayoutUrl: string;
}) {
  const options: string[] = [];
  options.push(`Option A: Refund of $${params.refundAmount.toFixed(2)} back to your payment method.`);

  if (params.rolloverCreditAmount && params.upsellServiceNames?.length) {
    options.push(
      `Option B: $${params.rolloverCreditAmount.toFixed(2)} credit toward ${params.upsellServiceNames.join(', ')}${
        params.bonusMultiplier && params.bonusMultiplier > 1 ? ` (${((params.bonusMultiplier - 1) * 100).toFixed(0)}% bonus!)` : ''
      }`
    );
  }

  if (params.rolloverCreditAmount && params.continuityPlanName) {
    options.push(
      `Option C: $${params.rolloverCreditAmount.toFixed(2)} credit spread across your ${params.continuityPlanName} subscription — pay $0 for months!${
        params.bonusMultiplier && params.bonusMultiplier > 1 ? ` (${((params.bonusMultiplier - 1) * 100).toFixed(0)}% bonus!)` : ''
      }`
    );
  }

  await sendEmail({
    to: params.clientEmail,
    subject: `You've qualified for your ${params.guaranteeName}! Choose your payout.`,
    text: [
      `Hi ${params.clientName || 'there'},`,
      '',
      `Congratulations! You've met all the conditions for your ${params.guaranteeName}.`,
      '',
      'Here are your options:',
      ...options.map(o => `  ${o}`),
      '',
      `Choose your payout: ${params.choosePayoutUrl}`,
    ].join('\n'),
    html: `
      <h2>You've qualified! Choose your payout.</h2>
      <p>Congratulations! You've met all the conditions for your <strong>${params.guaranteeName}</strong>.</p>
      <h3>Your options:</h3>
      <ul>${options.map(o => `<li>${o}</li>`).join('')}</ul>
      <p><a href="${params.choosePayoutUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin-top: 16px;">Choose Your Payout</a></p>
    `,
  });
}

export async function notifyPayoutProcessed(params: {
  clientEmail: string;
  clientName: string | null;
  payoutType: string;
  amount: number;
  discountCode?: string;
  planName?: string;
}) {
  let details = '';
  switch (params.payoutType) {
    case 'refund':
      details = `A refund of $${params.amount.toFixed(2)} has been processed to your original payment method. Please allow 5-10 business days for it to appear.`;
      break;
    case 'credit':
      details = `A credit of $${params.amount.toFixed(2)} has been issued. Use discount code <strong>${params.discountCode}</strong> on your next purchase.`;
      break;
    case 'rollover_upsell':
      details = `A credit of $${params.amount.toFixed(2)} has been issued toward your upgrade. Use discount code <strong>${params.discountCode}</strong>.`;
      break;
    case 'rollover_continuity':
      details = `A credit of $${params.amount.toFixed(2)} has been applied to your ${params.planName} subscription. You'll pay $0 until the credit is used up.`;
      break;
  }

  await sendEmail({
    to: params.clientEmail,
    subject: 'Your guarantee payout has been processed',
    text: `Hi ${params.clientName || 'there'},\n\n${details.replace(/<[^>]*>/g, '')}\n\nThank you for your trust in us.`,
    html: `
      <h2>Payout Processed</h2>
      <p>${details}</p>
      <p>Thank you for your trust in us.</p>
    `,
  });
}

export async function notifyGuaranteeExpiring(params: {
  clientEmail: string;
  clientName: string | null;
  guaranteeName: string;
  daysLeft: number;
  pendingConditions: string[];
}) {
  await sendEmail({
    to: params.clientEmail,
    subject: `Your ${params.guaranteeName} expires in ${params.daysLeft} days`,
    text: [
      `Hi ${params.clientName || 'there'},`,
      '',
      `Your ${params.guaranteeName} expires in ${params.daysLeft} days.`,
      '',
      params.pendingConditions.length > 0
        ? `Outstanding conditions:\n${params.pendingConditions.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}`
        : 'All conditions have been met!',
    ].join('\n'),
    html: `
      <h2>Guarantee Expiring Soon</h2>
      <p>Your <strong>${params.guaranteeName}</strong> expires in <strong>${params.daysLeft} days</strong>.</p>
      ${params.pendingConditions.length > 0 
        ? `<h3>Outstanding conditions:</h3><ol>${params.pendingConditions.map(c => `<li>${c}</li>`).join('')}</ol>`
        : '<p style="color: green;">All conditions met!</p>'}
    `,
  });
}

// ============================================================================
// Subscription Notifications
// ============================================================================

export async function notifySubscriptionStarted(params: {
  clientEmail: string;
  clientName: string | null;
  planName: string;
  amountPerInterval: number;
  billingInterval: string;
  features: string[];
  creditApplied?: number;
}) {
  await sendEmail({
    to: params.clientEmail,
    subject: `Welcome to ${params.planName}`,
    text: [
      `Hi ${params.clientName || 'there'},`,
      '',
      `Welcome to ${params.planName}!`,
      `Billing: $${params.amountPerInterval.toFixed(2)}/${params.billingInterval}`,
      params.creditApplied ? `Credit applied: $${params.creditApplied.toFixed(2)}` : '',
      '',
      'What\'s included:',
      ...params.features.map(f => `  - ${f}`),
    ].filter(Boolean).join('\n'),
    html: `
      <h2>Welcome to ${params.planName}!</h2>
      <p>Billing: <strong>$${params.amountPerInterval.toFixed(2)}/${params.billingInterval}</strong></p>
      ${params.creditApplied ? `<p>Credit applied: <strong>$${params.creditApplied.toFixed(2)}</strong></p>` : ''}
      <h3>What's included:</h3>
      <ul>${params.features.map(f => `<li>${f}</li>`).join('')}</ul>
    `,
  });
}

export async function notifySubscriptionPaymentFailed(params: {
  clientEmail: string;
  clientName: string | null;
  planName: string;
}) {
  await sendEmail({
    to: params.clientEmail,
    subject: `Payment failed for ${params.planName}`,
    text: [
      `Hi ${params.clientName || 'there'},`,
      '',
      `We couldn't process your payment for ${params.planName}.`,
      'Please update your payment method to avoid service interruption.',
    ].join('\n'),
    html: `
      <h2>Payment Failed</h2>
      <p>We couldn't process your payment for <strong>${params.planName}</strong>.</p>
      <p>Please update your payment method to avoid service interruption.</p>
    `,
  });
}

export async function notifyCreditExhausted(params: {
  clientEmail: string;
  clientName: string | null;
  planName: string;
  nextAmount: number;
  billingInterval: string;
}) {
  await sendEmail({
    to: params.clientEmail,
    subject: `Your guarantee credit has been fully used — ${params.planName}`,
    text: [
      `Hi ${params.clientName || 'there'},`,
      '',
      `Your guarantee credit for ${params.planName} has been fully applied.`,
      `Your next invoice will be $${params.nextAmount.toFixed(2)}/${params.billingInterval}.`,
      '',
      'Thank you for continuing with us!',
    ].join('\n'),
    html: `
      <h2>Credit Fully Applied</h2>
      <p>Your guarantee credit for <strong>${params.planName}</strong> has been fully used.</p>
      <p>Your next invoice: <strong>$${params.nextAmount.toFixed(2)}/${params.billingInterval}</strong></p>
    `,
  });
}

// ============================================================================
// Order Confirmation & Shipment Notifications
// ============================================================================

export interface OrderConfirmationItem {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export async function notifyOrderConfirmation(params: {
  clientEmail: string;
  clientName: string | null;
  orderId: number;
  orderDate: string;
  items: OrderConfirmationItem[];
  subtotal: number;
  discountAmount?: number;
  shippingCost?: number;
  tax?: number;
  totalAmount: number;
  purchasesUrl: string;
  invoicePdfBuffer?: Buffer;
}) {
  const itemsText = params.items
    .map((i) => `  ${i.name} × ${i.quantity} — $${i.lineTotal.toFixed(2)}`)
    .join('\n');

  const itemsHtml = params.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${i.name}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${i.quantity}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">$${i.unitPrice.toFixed(2)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">$${i.lineTotal.toFixed(2)}</td>
        </tr>`
    )
    .join('');

  const totalsHtml = [
    `<tr><td style="padding:4px 0;color:#6b7280;">Subtotal</td><td style="padding:4px 0;text-align:right;">$${params.subtotal.toFixed(2)}</td></tr>`,
    params.discountAmount && params.discountAmount > 0
      ? `<tr><td style="padding:4px 0;color:#6b7280;">Discount</td><td style="padding:4px 0;text-align:right;color:#16a34a;">-$${params.discountAmount.toFixed(2)}</td></tr>`
      : '',
    params.shippingCost && params.shippingCost > 0
      ? `<tr><td style="padding:4px 0;color:#6b7280;">Shipping</td><td style="padding:4px 0;text-align:right;">$${params.shippingCost.toFixed(2)}</td></tr>`
      : '',
    params.tax && params.tax > 0
      ? `<tr><td style="padding:4px 0;color:#6b7280;">Tax</td><td style="padding:4px 0;text-align:right;">$${params.tax.toFixed(2)}</td></tr>`
      : '',
    `<tr style="border-top:2px solid #1a2d4a;"><td style="padding:8px 0;font-size:16px;font-weight:700;">Total</td><td style="padding:8px 0;text-align:right;font-size:16px;font-weight:700;">$${params.totalAmount.toFixed(2)}</td></tr>`,
  ]
    .filter(Boolean)
    .join('');

  const orderDateFormatted = new Date(params.orderDate).toLocaleDateString(
    'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  const attachments = params.invoicePdfBuffer
    ? [
        {
          filename: `invoice-order-${params.orderId}.pdf`,
          content: params.invoicePdfBuffer,
          contentType: 'application/pdf',
        },
      ]
    : undefined;

  await sendEmail({
    to: params.clientEmail,
    subject: `Order Confirmed — Order #${params.orderId}`,
    text: [
      `Hi ${params.clientName || 'there'},`,
      '',
      `Thank you for your order! Here's your confirmation for Order #${params.orderId}.`,
      '',
      `Date: ${orderDateFormatted}`,
      '',
      'Items:',
      itemsText,
      '',
      `Total: $${params.totalAmount.toFixed(2)}`,
      '',
      `View your order: ${params.purchasesUrl}`,
      '',
      'Thank you for your business.',
      'We Rise Together.',
      '',
      'Best regards,',
      'Amadutown Advisory Solutions',
    ].join('\n'),
    html: `
      <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;">
        <!-- Header -->
        <div style="background:#1a2d4a;padding:20px 24px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Amadutown Advisory Solutions</h1>
        </div>

        <div style="padding:24px;">
          <h2 style="color:#1a2d4a;margin:0 0 4px;">Order Confirmed</h2>
          <p style="color:#6b7280;margin:0 0 20px;font-size:14px;">Order #${params.orderId} · ${orderDateFormatted}</p>

          <p>Hi ${params.clientName || 'there'},</p>
          <p>Thank you for your order! Here's a summary of what you purchased.</p>

          <!-- Items table -->
          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <thead>
              <tr style="background:#1a2d4a;">
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

          <!-- Totals -->
          <table style="width:220px;margin-left:auto;border-collapse:collapse;">
            <tbody>
              ${totalsHtml}
            </tbody>
          </table>

          <!-- CTA -->
          <div style="text-align:center;margin:28px 0;">
            <a href="${params.purchasesUrl}" style="background:#C9A227;color:#1a2d4a;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;">View Your Order</a>
          </div>

          <p style="color:#4b5563;font-size:13px;">If you have any questions about your order, simply reply to this email and we'll be happy to help.</p>
        </div>

        <!-- Footer -->
        <div style="background:#1a2d4a;padding:16px 24px;text-align:center;">
          <p style="margin:0;color:#C9A227;font-style:italic;font-size:13px;">We Rise Together</p>
          <p style="margin:4px 0 0;color:#ffffff;font-size:11px;">Amadutown Advisory Solutions</p>
        </div>
      </div>
    `,
    attachments,
  });
}

export async function notifyShipmentUpdate(params: {
  clientEmail: string;
  clientName: string | null;
  orderId: number;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  carrier?: string | null;
  purchasesUrl: string;
}) {
  const carrierName = params.carrier || 'our shipping partner';
  const trackingLine = params.trackingUrl
    ? `Track your package: ${params.trackingUrl}`
    : params.trackingNumber
      ? `Tracking number: ${params.trackingNumber}`
      : '';

  const trackingHtml = params.trackingUrl
    ? `<a href="${params.trackingUrl}" style="background:#C9A227;color:#1a2d4a;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;">Track Your Package</a>`
    : params.trackingNumber
      ? `<p style="font-size:14px;">Tracking number: <strong>${params.trackingNumber}</strong></p>`
      : '';

  await sendEmail({
    to: params.clientEmail,
    subject: `Your Order Has Shipped — Order #${params.orderId}`,
    text: [
      `Hi ${params.clientName || 'there'},`,
      '',
      `Great news! Your order #${params.orderId} has been shipped via ${carrierName}.`,
      '',
      trackingLine,
      '',
      `View your order: ${params.purchasesUrl}`,
      '',
      'Thank you for your business.',
      'We Rise Together.',
      '',
      'Best regards,',
      'Amadutown Advisory Solutions',
    ].filter(Boolean).join('\n'),
    html: `
      <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;">
        <!-- Header -->
        <div style="background:#1a2d4a;padding:20px 24px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Amadutown Advisory Solutions</h1>
        </div>

        <div style="padding:24px;">
          <h2 style="color:#1a2d4a;margin:0 0 4px;">Your Order Has Shipped!</h2>
          <p style="color:#6b7280;margin:0 0 20px;font-size:14px;">Order #${params.orderId}</p>

          <p>Hi ${params.clientName || 'there'},</p>
          <p>Great news — your order has been shipped${params.carrier ? ` via <strong>${params.carrier}</strong>` : ''}! You should receive it soon.</p>

          ${trackingHtml ? `<div style="text-align:center;margin:28px 0;">${trackingHtml}</div>` : ''}

          <div style="text-align:center;margin:20px 0;">
            <a href="${params.purchasesUrl}" style="color:#1a2d4a;font-weight:600;text-decoration:underline;">View your order details</a>
          </div>

          <p style="color:#4b5563;font-size:13px;">If you have any questions about your shipment, simply reply to this email and we'll be happy to help.</p>
        </div>

        <!-- Footer -->
        <div style="background:#1a2d4a;padding:16px 24px;text-align:center;">
          <p style="margin:0;color:#C9A227;font-style:italic;font-size:13px;">We Rise Together</p>
          <p style="margin:4px 0 0;color:#ffffff;font-size:11px;">Amadutown Advisory Solutions</p>
        </div>
      </div>
    `,
  });
}

// ============================================================================
// Chat / Meeting Notifications
// ============================================================================

export async function notifyMeetingBooked(params: {
  clientEmail: string;
  clientName: string;
  meetingType?: string;
  meetingDate?: string;
  meetingTime?: string;
  calendlyLink?: string;
}) {
  const dateInfo = params.meetingDate
    ? `<p>Date: <strong>${params.meetingDate}</strong>${params.meetingTime ? ` at <strong>${params.meetingTime}</strong>` : ''}</p>`
    : '';

  const linkInfo = params.calendlyLink
    ? `<p>You can manage your booking here: <a href="${params.calendlyLink}">${params.calendlyLink}</a></p>`
    : '';

  await sendEmail({
    to: params.clientEmail,
    subject: `Meeting Confirmed${params.meetingType ? `: ${params.meetingType}` : ''}`,
    text: [
      `Hi ${params.clientName},`,
      '',
      `Your meeting${params.meetingType ? ` (${params.meetingType})` : ''} has been confirmed!`,
      params.meetingDate ? `Date: ${params.meetingDate}${params.meetingTime ? ` at ${params.meetingTime}` : ''}` : '',
      '',
      params.calendlyLink ? `Manage your booking: ${params.calendlyLink}` : '',
      '',
      'Looking forward to speaking with you!',
      '',
      'Best regards,',
      fromName,
    ].filter(Boolean).join('\n'),
    html: `
      <h2>Meeting Confirmed!</h2>
      <p>Hi ${params.clientName},</p>
      <p>Your meeting${params.meetingType ? ` (<strong>${params.meetingType}</strong>)` : ''} has been confirmed.</p>
      ${dateInfo}
      ${linkInfo}
      <p>Looking forward to speaking with you!</p>
      <p>Best regards,<br/>${fromName}</p>
    `,
  });
}

export async function notifyChatTranscript(params: {
  clientEmail: string;
  clientName: string;
  transcript: string;
  sessionDate: string;
}) {
  const transcriptHtml = params.transcript
    .split('\n')
    .map(line => {
      if (line.startsWith('User:')) return `<p style="color: #d4a843;"><strong>${line}</strong></p>`;
      if (line.startsWith('Assistant:')) return `<p style="color: #94a3b8;">${line}</p>`;
      return `<p>${line}</p>`;
    })
    .join('');

  await sendEmail({
    to: params.clientEmail,
    subject: `Your Chat Summary — ${params.sessionDate}`,
    text: [
      `Hi ${params.clientName},`,
      '',
      `Here's a summary of your chat session on ${params.sessionDate}:`,
      '',
      params.transcript,
      '',
      'If you have any follow-up questions, feel free to start a new chat or reply to this email.',
      '',
      'Best regards,',
      fromName,
    ].join('\n'),
    html: `
      <h2>Chat Summary</h2>
      <p>Hi ${params.clientName},</p>
      <p>Here's a summary of your chat session on <strong>${params.sessionDate}</strong>:</p>
      <div style="background: #0f1729; padding: 16px; border-radius: 8px; margin: 16px 0;">
        ${transcriptHtml}
      </div>
      <p>If you have any follow-up questions, feel free to start a new chat or reply to this email.</p>
      <p>Best regards,<br/>${fromName}</p>
    `,
  });
}
