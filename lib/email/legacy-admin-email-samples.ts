/**
 * Static HTML samples for admin Email Preview only.
 * Transactional order/shipment/meeting/chat live in `lib/email/templates/*` + registry.
 */

import { ATAS_DARK_BLUE, ATAS_GOLD } from '@/lib/email/branding'

export interface LegacyEmailPreviewSample {
  id: string
  label: string
  html: string
}

export const LEGACY_EMAIL_PREVIEW_SAMPLES: LegacyEmailPreviewSample[] = [
  {
    id: 'guarantee_activated',
    label: 'Guarantee Activated',
    html: `
      <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:${ATAS_DARK_BLUE};padding:20px 24px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Amadutown Advisory Solutions</h1>
        </div>
        <div style="padding:24px;">
          <h2 style="color:${ATAS_DARK_BLUE};">Your Growth Guarantee is now active!</h2>
          <p>Hi Juliana,</p>
          <p>Duration: <strong>90 days</strong> (expires June 10, 2026)</p>
          <h3 style="color:${ATAS_DARK_BLUE};">Conditions to qualify:</h3>
          <ol>
            <li>Complete onboarding within 14 days</li>
            <li>Implement 3 recommended strategies</li>
            <li>Attend all scheduled check-ins</li>
          </ol>
          <p>We'll check in periodically to track your progress.</p>
        </div>
        <div style="background:${ATAS_DARK_BLUE};padding:16px 24px;text-align:center;">
          <p style="margin:0;color:${ATAS_GOLD};font-style:italic;font-size:13px;">We Rise Together</p>
          <p style="margin:4px 0 0;color:#ffffff;font-size:11px;">Amadutown Advisory Solutions</p>
        </div>
      </div>
    `,
  },
  {
    id: 'milestone_verified',
    label: 'Milestone Verified',
    html: `
      <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:${ATAS_DARK_BLUE};padding:20px 24px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Amadutown Advisory Solutions</h1>
        </div>
        <div style="padding:24px;">
          <h2 style="color:${ATAS_DARK_BLUE};">Milestone Verified</h2>
          <p>We've confirmed: <strong>Complete onboarding within 14 days</strong></p>
          <p>Progress: <strong>2 of 3</strong> conditions met.</p>
          <p>Keep going!</p>
        </div>
        <div style="background:${ATAS_DARK_BLUE};padding:16px 24px;text-align:center;">
          <p style="margin:0;color:${ATAS_GOLD};font-style:italic;font-size:13px;">We Rise Together</p>
          <p style="margin:4px 0 0;color:#ffffff;font-size:11px;">Amadutown Advisory Solutions</p>
        </div>
      </div>
    `,
  },
  {
    id: 'conditions_met_payout',
    label: 'Conditions Met — Choose Payout',
    html: `
      <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:${ATAS_DARK_BLUE};padding:20px 24px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Amadutown Advisory Solutions</h1>
        </div>
        <div style="padding:24px;">
          <h2 style="color:${ATAS_DARK_BLUE};">You've qualified! Choose your payout.</h2>
          <p>Congratulations! You've met all the conditions for your <strong>Growth Guarantee</strong>.</p>
          <h3 style="color:${ATAS_DARK_BLUE};">Your options:</h3>
          <ul>
            <li>Option A: Refund of $497.00 back to your payment method.</li>
            <li>Option B: $596.40 credit toward Advanced Strategy Package (20% bonus!)</li>
            <li>Option C: $596.40 credit spread across your Monthly Retainer subscription — pay $0 for months! (20% bonus!)</li>
          </ul>
          <div style="text-align:center;margin:28px 0;">
            <a href="#" style="background:${ATAS_GOLD};color:${ATAS_DARK_BLUE};padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;">Choose Your Payout</a>
          </div>
        </div>
        <div style="background:${ATAS_DARK_BLUE};padding:16px 24px;text-align:center;">
          <p style="margin:0;color:${ATAS_GOLD};font-style:italic;font-size:13px;">We Rise Together</p>
          <p style="margin:4px 0 0;color:#ffffff;font-size:11px;">Amadutown Advisory Solutions</p>
        </div>
      </div>
    `,
  },
  {
    id: 'subscription_started',
    label: 'Subscription Started',
    html: `
      <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:${ATAS_DARK_BLUE};padding:20px 24px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Amadutown Advisory Solutions</h1>
        </div>
        <div style="padding:24px;">
          <h2 style="color:${ATAS_DARK_BLUE};">Welcome to Monthly Growth Retainer!</h2>
          <p>Billing: <strong>$199.00/month</strong></p>
          <p>Credit applied: <strong>$596.40</strong></p>
          <h3 style="color:${ATAS_DARK_BLUE};">What's included:</h3>
          <ul>
            <li>Monthly strategy session</li>
            <li>Priority support</li>
            <li>Growth tracking dashboard</li>
          </ul>
        </div>
        <div style="background:${ATAS_DARK_BLUE};padding:16px 24px;text-align:center;">
          <p style="margin:0;color:${ATAS_GOLD};font-style:italic;font-size:13px;">We Rise Together</p>
          <p style="margin:4px 0 0;color:#ffffff;font-size:11px;">Amadutown Advisory Solutions</p>
        </div>
      </div>
    `,
  },
]
