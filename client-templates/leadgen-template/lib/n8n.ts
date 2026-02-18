/**
 * n8n Webhook Client for Lead Qualification
 */

export interface LeadQualificationRequest {
  name: string
  email: string
  company?: string
  companyDomain?: string
  linkedinUrl?: string
  message: string
  annualRevenue?: string
  interestAreas?: string[]
  interestSummary?: string
  isDecisionMaker?: boolean
  submissionId: string
  submittedAt: string
  source: string
  leadScore?: number
  potentialRecommendations?: string[]
}

const N8N_LEAD_WEBHOOK_URL = process.env.N8N_LEAD_WEBHOOK_URL

/**
 * Trigger the n8n lead qualification workflow
 * Fire-and-forget to avoid blocking the user
 */
export async function triggerLeadQualificationWebhook(
  request: LeadQualificationRequest
): Promise<void> {
  if (!N8N_LEAD_WEBHOOK_URL) {
    console.warn('N8N_LEAD_WEBHOOK_URL not configured - skipping lead qualification')
    return
  }

  try {
    const response = await fetch(N8N_LEAD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Lead webhook error:', response.status, errorText)
    }
  } catch (error) {
    console.error('Lead webhook failed:', error)
    // Don't throw - this is fire-and-forget
  }
}

/**
 * Trigger diagnostic completion webhook for sales enablement
 */
export async function triggerDiagnosticCompletionWebhook(
  diagnosticAuditId: string,
  diagnosticData: Record<string, unknown>,
  contactInfo?: { email?: string; name?: string; company?: string }
): Promise<void> {
  const completionWebhookUrl = process.env.N8N_DIAGNOSTIC_COMPLETION_WEBHOOK_URL || N8N_LEAD_WEBHOOK_URL
  
  if (!completionWebhookUrl) {
    console.warn('Diagnostic completion webhook URL not configured')
    return
  }

  try {
    const payload = {
      diagnosticAuditId,
      diagnosticData,
      contactInfo,
      completedAt: new Date().toISOString(),
      source: 'lead_diagnostic',
    }

    const response = await fetch(completionWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Diagnostic completion webhook error:', response.status, errorText)
    }
  } catch (error) {
    console.error('Diagnostic completion webhook failed:', error)
  }
}
