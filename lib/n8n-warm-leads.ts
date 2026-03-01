/**
 * n8n Warm Lead Pipeline — Webhook Client
 *
 * Triggers n8n workflows for:
 *  1. Enriching warm leads via Apollo + Apify
 *  2. Running AI commonality analysis
 *  3. Generating personalized outreach messages
 *  4. Scheduling follow-up sequences
 *
 * Environment variables used:
 *   N8N_WARM_LEAD_ENRICH_WEBHOOK_URL  — triggers the enrichment + commonality pipeline
 *   N8N_WARM_LEAD_OUTREACH_WEBHOOK_URL — triggers the outreach sequence
 *   WARM_LEAD_WEBHOOK_SECRET           — shared secret for webhook auth
 */

// ============================================================================
// Types
// ============================================================================

export interface WarmLead {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  job_title?: string | null;
  company_domain?: string | null;
  location?: string | null;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  github_url?: string | null;
  personal_website?: string | null;
  source?: string;
  source_detail?: string | null;
  source_url?: string | null;
  tags?: string[];
  apollo_person_id?: string | null;
  apollo_data?: Record<string, unknown>;
  social_data?: Record<string, unknown>;
  commonalities?: Record<string, unknown>;
  lead_score?: number | null;
  lead_temperature?: string;
  enrichment_status?: string;
}

export interface OutreachRequest {
  warm_lead_id: string;
  channel: 'email' | 'linkedin_dm' | 'twitter_dm' | 'instagram_dm' | 'phone' | 'other';
  message?: string;           // override AI-generated message
  follow_up_sequence?: boolean; // enable automated follow-ups
  sender_name?: string;
  sender_email?: string;
}

export interface EnrichmentWebhookPayload {
  // Lead data
  warm_lead_id: string;
  full_name: string;
  email?: string | null;
  company?: string | null;
  job_title?: string | null;
  company_domain?: string | null;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  instagram_url?: string | null;
  github_url?: string | null;
  personal_website?: string | null;
  source?: string;
  tags?: string[];

  // Existing data (so n8n can skip redundant lookups)
  existing_apollo_data?: Record<string, unknown>;
  existing_social_data?: Record<string, unknown>;

  // Callback URL for n8n to send results back
  callback_url: string;

  // Timestamp
  triggered_at: string;
}

// ============================================================================
// Configuration
// ============================================================================

const N8N_WARM_LEAD_ENRICH_WEBHOOK_URL = process.env.N8N_WARM_LEAD_ENRICH_WEBHOOK_URL;
const N8N_WARM_LEAD_OUTREACH_WEBHOOK_URL = process.env.N8N_WARM_LEAD_OUTREACH_WEBHOOK_URL;
const WARM_LEAD_WEBHOOK_SECRET = process.env.WARM_LEAD_WEBHOOK_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

// ============================================================================
// Enrichment Pipeline Trigger
// ============================================================================

/**
 * Trigger the n8n warm lead enrichment pipeline.
 *
 * This fires a webhook to n8n which orchestrates:
 *   1. Apollo People Enrichment (email, company, seniority, tech stack)
 *   2. Apify LinkedIn Profile Scraper (headline, experience, posts)
 *   3. Apify Twitter Profile Scraper (bio, tweets, topics)
 *   4. AI Commonality Analysis (shared interests, connections, icebreakers)
 *   5. AI Personalized Outreach Drafting
 *   6. Callback to /api/webhooks/warm-lead-enriched with results
 *
 * The function is fire-and-forget — it does not wait for enrichment to complete.
 */
export async function triggerWarmLeadEnrichmentWebhook(lead: WarmLead): Promise<void> {
  if (!N8N_WARM_LEAD_ENRICH_WEBHOOK_URL) {
    console.warn('N8N_WARM_LEAD_ENRICH_WEBHOOK_URL not configured — skipping enrichment');
    return;
  }

  const payload: EnrichmentWebhookPayload = {
    warm_lead_id: lead.id,
    full_name: lead.full_name,
    email: lead.email,
    company: lead.company,
    job_title: lead.job_title,
    company_domain: lead.company_domain,
    linkedin_url: lead.linkedin_url,
    twitter_url: lead.twitter_url,
    instagram_url: lead.instagram_url,
    github_url: lead.github_url,
    personal_website: lead.personal_website,
    source: lead.source,
    tags: lead.tags,
    existing_apollo_data: lead.apollo_data || {},
    existing_social_data: lead.social_data || {},
    callback_url: `${APP_URL}/api/webhooks/warm-lead-enriched`,
    triggered_at: new Date().toISOString(),
  };

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (WARM_LEAD_WEBHOOK_SECRET) {
      headers['x-webhook-secret'] = WARM_LEAD_WEBHOOK_SECRET;
    }

    const response = await fetch(N8N_WARM_LEAD_ENRICH_WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Warm lead enrichment webhook error:', response.status, errorText);
      throw new Error(`Enrichment webhook returned ${response.status}: ${errorText}`);
    }
  } catch (error) {
    console.error('Warm lead enrichment webhook failed:', error);
    // Don't throw — this is fire-and-forget
  }
}

// ============================================================================
// Outreach Pipeline Trigger
// ============================================================================

/**
 * Trigger the n8n outreach sequence for a warm lead.
 *
 * This fires a webhook to n8n which orchestrates:
 *   1. Send initial outreach message (email / LinkedIn DM / etc.)
 *   2. Schedule follow-up sequence (if enabled)
 *   3. Monitor for replies
 *   4. Update lead status via callback
 */
export async function triggerWarmLeadOutreachWebhook(request: OutreachRequest): Promise<void> {
  if (!N8N_WARM_LEAD_OUTREACH_WEBHOOK_URL) {
    console.warn('N8N_WARM_LEAD_OUTREACH_WEBHOOK_URL not configured — skipping outreach');
    return;
  }

  const payload = {
    ...request,
    callback_url: `${APP_URL}/api/webhooks/warm-lead-enriched`, // reuse same endpoint
    triggered_at: new Date().toISOString(),
  };

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (WARM_LEAD_WEBHOOK_SECRET) {
      headers['x-webhook-secret'] = WARM_LEAD_WEBHOOK_SECRET;
    }

    const response = await fetch(N8N_WARM_LEAD_OUTREACH_WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Warm lead outreach webhook error:', response.status, errorText);
      throw new Error(`Outreach webhook returned ${response.status}: ${errorText}`);
    }
  } catch (error) {
    console.error('Warm lead outreach webhook failed:', error);
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a personalized outreach prompt for the AI node in n8n.
 * This is exported so it can be used in the n8n workflow Code node or
 * as a system prompt in the AI Agent node.
 */
export function buildOutreachPrompt(lead: WarmLead): string {
  const commonalities = lead.commonalities as {
    shared_connections?: string[];
    shared_interests?: string[];
    shared_skills?: string[];
    talking_points?: string[];
    icebreakers?: string[];
    geographic_proximity?: string;
  } | undefined;

  const parts: string[] = [
    `Write a personalized, warm outreach message to ${lead.full_name}.`,
    '',
    '## Lead Context',
    lead.job_title ? `- Title: ${lead.job_title}` : '',
    lead.company ? `- Company: ${lead.company}` : '',
    lead.location ? `- Location: ${lead.location}` : '',
    '',
  ];

  if (commonalities) {
    parts.push('## What We Have in Common');
    if (commonalities.shared_interests?.length) {
      parts.push(`- Shared interests: ${commonalities.shared_interests.join(', ')}`);
    }
    if (commonalities.shared_connections?.length) {
      parts.push(`- Mutual connections: ${commonalities.shared_connections.join(', ')}`);
    }
    if (commonalities.shared_skills?.length) {
      parts.push(`- Shared skills/tech: ${commonalities.shared_skills.join(', ')}`);
    }
    if (commonalities.geographic_proximity) {
      parts.push(`- Location: ${commonalities.geographic_proximity}`);
    }
    if (commonalities.talking_points?.length) {
      parts.push('');
      parts.push('## Suggested Talking Points');
      commonalities.talking_points.forEach((tp) => parts.push(`- ${tp}`));
    }
    if (commonalities.icebreakers?.length) {
      parts.push('');
      parts.push('## Icebreaker Ideas');
      commonalities.icebreakers.forEach((ib) => parts.push(`- ${ib}`));
    }
  }

  parts.push('');
  parts.push('## Instructions');
  parts.push('- Keep it under 150 words');
  parts.push('- Lead with the strongest commonality or icebreaker');
  parts.push('- Be genuine and conversational, not salesy');
  parts.push('- End with a low-pressure question or soft CTA');
  parts.push('- Do NOT mention that you scraped their data or used AI');

  return parts.filter(Boolean).join('\n');
}
