// Notification Service — Guarantee & Subscription lifecycle emails
// Currently logs notifications; replace sendEmail implementation with
// your provider (Resend, SendGrid, SES, etc.) when ready.

// ============================================================================
// Email sending abstraction
// ============================================================================

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email. Replace this with your email provider.
 * For now, logs the email payload to console.
 */
async function sendEmail(payload: EmailPayload): Promise<boolean> {
  // TODO: Replace with actual email provider
  // Example with Resend:
  //   const resend = new Resend(process.env.RESEND_API_KEY);
  //   await resend.emails.send({ from: 'noreply@yourdomain.com', ...payload });

  console.log('[NOTIFICATION EMAIL]', {
    to: payload.to,
    subject: payload.subject,
    textPreview: payload.text?.slice(0, 100) || payload.html.slice(0, 100),
  });

  return true;
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
