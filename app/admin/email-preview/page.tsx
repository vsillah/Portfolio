'use client'

import { useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'

const ATAS_DARK_BLUE = '#1a2d4a'
const ATAS_GOLD = '#C9A227'

const sampleOrderDate = new Date().toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

const templates: Record<string, { label: string; html: string }> = {
  orderConfirmation: {
    label: 'Order Confirmation',
    html: `
      <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:${ATAS_DARK_BLUE};padding:20px 24px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Amadutown Advisory Solutions</h1>
        </div>
        <div style="padding:24px;">
          <h2 style="color:${ATAS_DARK_BLUE};margin:0 0 4px;">Order Confirmed</h2>
          <p style="color:#6b7280;margin:0 0 20px;font-size:14px;">Order #1042 · ${sampleOrderDate}</p>
          <p>Hi Juliana,</p>
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
              <tr>
                <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">Business Growth Blueprint</td>
                <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">1</td>
                <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">$497.00</td>
                <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">$497.00</td>
              </tr>
              <tr>
                <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">ATAS Classic Tee — Black / L</td>
                <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">2</td>
                <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">$29.99</td>
                <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">$59.98</td>
              </tr>
            </tbody>
          </table>
          <table style="width:220px;margin-left:auto;border-collapse:collapse;">
            <tbody>
              <tr><td style="padding:4px 0;color:#6b7280;">Subtotal</td><td style="padding:4px 0;text-align:right;">$556.98</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280;">Discount</td><td style="padding:4px 0;text-align:right;color:#16a34a;">-$50.00</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280;">Shipping</td><td style="padding:4px 0;text-align:right;">$8.99</td></tr>
              <tr style="border-top:2px solid ${ATAS_DARK_BLUE};"><td style="padding:8px 0;font-size:16px;font-weight:700;">Total</td><td style="padding:8px 0;text-align:right;font-size:16px;font-weight:700;">$515.97</td></tr>
            </tbody>
          </table>
          <div style="text-align:center;margin:28px 0;">
            <a href="#" style="background:${ATAS_GOLD};color:${ATAS_DARK_BLUE};padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;">View Your Order</a>
          </div>
          <p style="color:#4b5563;font-size:13px;">If you have any questions about your order, simply reply to this email and we'll be happy to help.</p>
        </div>
        <div style="background:${ATAS_DARK_BLUE};padding:16px 24px;text-align:center;">
          <p style="margin:0;color:${ATAS_GOLD};font-style:italic;font-size:13px;">We Rise Together</p>
          <p style="margin:4px 0 0;color:#ffffff;font-size:11px;">Amadutown Advisory Solutions</p>
        </div>
      </div>
    `,
  },

  shipmentUpdate: {
    label: 'Shipment Update',
    html: `
      <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:${ATAS_DARK_BLUE};padding:20px 24px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Amadutown Advisory Solutions</h1>
        </div>
        <div style="padding:24px;">
          <h2 style="color:${ATAS_DARK_BLUE};margin:0 0 4px;">Your Order Has Shipped!</h2>
          <p style="color:#6b7280;margin:0 0 20px;font-size:14px;">Order #1042</p>
          <p>Hi Juliana,</p>
          <p>Great news — your order has been shipped via <strong>USPS</strong>! You should receive it soon.</p>
          <div style="text-align:center;margin:28px 0;">
            <a href="#" style="background:${ATAS_GOLD};color:${ATAS_DARK_BLUE};padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;">Track Your Package</a>
          </div>
          <div style="text-align:center;margin:20px 0;">
            <a href="#" style="color:${ATAS_DARK_BLUE};font-weight:600;text-decoration:underline;">View your order details</a>
          </div>
          <p style="color:#4b5563;font-size:13px;">If you have any questions about your shipment, simply reply to this email and we'll be happy to help.</p>
        </div>
        <div style="background:${ATAS_DARK_BLUE};padding:16px 24px;text-align:center;">
          <p style="margin:0;color:${ATAS_GOLD};font-style:italic;font-size:13px;">We Rise Together</p>
          <p style="margin:4px 0 0;color:#ffffff;font-size:11px;">Amadutown Advisory Solutions</p>
        </div>
      </div>
    `,
  },

  guaranteeActivated: {
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

  milestoneVerified: {
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

  conditionsMetPayout: {
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

  meetingBooked: {
    label: 'Meeting Confirmed',
    html: `
      <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:${ATAS_DARK_BLUE};padding:20px 24px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Amadutown Advisory Solutions</h1>
        </div>
        <div style="padding:24px;">
          <h2 style="color:${ATAS_DARK_BLUE};">Meeting Confirmed!</h2>
          <p>Hi Juliana,</p>
          <p>Your meeting (<strong>Discovery Call</strong>) has been confirmed.</p>
          <p>Date: <strong>March 15, 2026</strong> at <strong>2:00 PM</strong></p>
          <p>Looking forward to speaking with you!</p>
          <p>Best regards,<br/>ATAS</p>
        </div>
        <div style="background:${ATAS_DARK_BLUE};padding:16px 24px;text-align:center;">
          <p style="margin:0;color:${ATAS_GOLD};font-style:italic;font-size:13px;">We Rise Together</p>
          <p style="margin:4px 0 0;color:#ffffff;font-size:11px;">Amadutown Advisory Solutions</p>
        </div>
      </div>
    `,
  },

  subscriptionStarted: {
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
}

const templateKeys = Object.keys(templates)

export default function EmailPreviewPage() {
  const [selected, setSelected] = useState(templateKeys[0])
  const current = templates[selected]

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Toolbar */}
        <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4">
          <h1 className="text-lg font-bold whitespace-nowrap">Email Preview</h1>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {templateKeys.map((key) => (
              <option key={key} value={key}>
                {templates[key].label}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-500 ml-auto">
            Admin only — sample data
          </span>
        </div>

        {/* Preview area */}
        <div className="flex justify-center py-8 px-4">
          <div className="w-full max-w-[640px] bg-white rounded-xl shadow-2xl overflow-hidden">
            <div dangerouslySetInnerHTML={{ __html: current.html }} />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
