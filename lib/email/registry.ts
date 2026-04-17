/**
 * Phase 2 — typed email template registry (static, LLM, external).
 * Single source for Email Preview labels + System Prompts cross-reference.
 */

import { EMAIL_TEMPLATE_KEYS, getPromptDisplayName } from '@/lib/constants/prompt-keys'
import { buildOrderConfirmationEmail } from '@/lib/email/templates/order-confirmation'
import { buildShipmentEmail } from '@/lib/email/templates/shipment'
import { buildMeetingBookedEmail } from '@/lib/email/templates/meeting-booked'
import { buildChatTranscriptEmail } from '@/lib/email/templates/chat-transcript'
import {
  generateProposalEmailDraft,
  proposalEmailPreviewHtml,
} from '@/lib/email/templates/proposal'
import {
  sampleOrderConfirmationInput,
  sampleShipmentInput,
  sampleMeetingBookedInput,
  sampleChatTranscriptInput,
  sampleProposalInput,
} from '@/lib/email/preview-samples'

export type EmailTemplateMode = 'static' | 'llm' | 'external'

export type EmailRegistryCategory = 'transactional' | 'sales' | 'llm' | 'external'

export interface EmailTemplateRegistryEntry {
  id: string
  label: string
  mode: EmailTemplateMode
  category: EmailRegistryCategory
  description: string
  /** Correlates with `email_messages.email_kind` when logged */
  emailKind?: string
  /** `system_prompts.key` when mode === 'llm' */
  systemPromptKey?: string
  /** Admin HTML preview — only for static layouts */
  getPreviewHtml?: () => string
}

const STATIC_SENDER_LABEL = 'ATAS'

function llmEntries(): EmailTemplateRegistryEntry[] {
  return EMAIL_TEMPLATE_KEYS.map((key) => ({
    id: `llm_${key}`,
    label: getPromptDisplayName(key),
    mode: 'llm' as const,
    category: 'llm' as const,
    description: 'Body generated at send time from the active system prompt in Admin → System Prompts.',
    systemPromptKey: key,
  }))
}

export const EMAIL_TEMPLATE_REGISTRY: EmailTemplateRegistryEntry[] = [
  {
    id: 'order_confirmation',
    label: 'Order confirmation',
    mode: 'static',
    category: 'transactional',
    description: 'Store order confirmation after successful payment (Stripe → notifications).',
    emailKind: 'order_confirmation',
    getPreviewHtml: () => buildOrderConfirmationEmail(sampleOrderConfirmationInput()).html,
  },
  {
    id: 'shipment',
    label: 'Shipment update',
    mode: 'static',
    category: 'transactional',
    description: 'Shipped notification when fulfillment updates (e.g. Printful webhook).',
    emailKind: 'shipment',
    getPreviewHtml: () => buildShipmentEmail(sampleShipmentInput()).html,
  },
  {
    id: 'meeting_booked',
    label: 'Meeting confirmed',
    mode: 'static',
    category: 'transactional',
    description: 'Visitor meeting confirmation from chat flow.',
    emailKind: 'meeting_booked',
    getPreviewHtml: () =>
      buildMeetingBookedEmail(sampleMeetingBookedInput(STATIC_SENDER_LABEL)).html,
  },
  {
    id: 'chat_transcript',
    label: 'Chat summary',
    mode: 'static',
    category: 'transactional',
    description: 'Post-session transcript email from chat.',
    emailKind: 'chat_transcript',
    getPreviewHtml: () =>
      buildChatTranscriptEmail(sampleChatTranscriptInput(STATIC_SENDER_LABEL)).html,
  },
  {
    id: 'proposal_client_copy',
    label: 'Proposal email (sales copy)',
    mode: 'static',
    category: 'sales',
    description: 'Plain-text draft for the client; composed in Admin → Sales (mailto / copy). Logged via communications when sent.',
    emailKind: 'proposal',
    getPreviewHtml: () => {
      const d = generateProposalEmailDraft(sampleProposalInput())
      return proposalEmailPreviewHtml(d.body)
    },
  },
  {
    id: 'audit_pdf',
    label: 'Audit PDF delivery',
    mode: 'static',
    category: 'transactional',
    description: 'Short intro email with PDF attachment from the audit tool.',
    emailKind: 'audit_pdf',
    getPreviewHtml: () =>
      `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
        <p>Hi,</p>
        <p>Attached is a printable PDF of your <strong>AI &amp; Automation audit</strong> report.</p>
        <p style="color:#555;font-size:13px;">(Preview only — attachment not shown.)</p>
      </div>`,
  },
  {
    id: 'external_onboarding_email',
    label: 'Onboarding plan email',
    mode: 'external',
    category: 'external',
    description: 'Sent via n8n (ATAS-Onboarding-Plan-Email-Delivery) when client project onboarding is approved.',
    emailKind: 'onboarding_plan',
  },
  {
    id: 'external_provisioning_reminder',
    label: 'Provisioning reminder',
    mode: 'external',
    category: 'external',
    description: 'n8n WF-PROV — Slack or email branch.',
    emailKind: 'provisioning_reminder',
  },
  ...llmEntries(),
]

export function getEmailTemplateRegistry(): EmailTemplateRegistryEntry[] {
  return EMAIL_TEMPLATE_REGISTRY
}

export function getRegistryEntryById(id: string): EmailTemplateRegistryEntry | undefined {
  return EMAIL_TEMPLATE_REGISTRY.find((e) => e.id === id)
}

/** Rows for Admin → Email Preview (static HTML + legacy samples appended by the page). */
export function getRegistryPreviewRows(): { id: string; label: string; html: string; mode: EmailTemplateMode }[] {
  return EMAIL_TEMPLATE_REGISTRY.flatMap((e) =>
    e.getPreviewHtml
      ? [{ id: e.id, label: e.label, html: e.getPreviewHtml(), mode: e.mode }]
      : [],
  )
}

export function getLlmRegistryKeys(): readonly string[] {
  return EMAIL_TEMPLATE_KEYS
}
