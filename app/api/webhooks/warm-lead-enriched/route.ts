// Webhook Route: Receive enriched warm lead data from n8n
// POST - n8n sends enrichment results (Apollo data, social data, commonalities) back here
//
// This webhook is called by the n8n enrichment workflow after it has:
// 1. Queried Apollo for company/contact enrichment
// 2. Scraped social media profiles via Apify
// 3. Run AI commonality analysis
// 4. Generated a personalized outreach message

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface EnrichmentPayload {
  warm_lead_id: string;

  // Apollo enrichment
  apollo_person_id?: string;
  apollo_data?: Record<string, unknown>;

  // Social media scraped data
  social_data?: Record<string, unknown>;

  // AI-generated commonalities
  commonalities?: {
    shared_connections?: string[];
    shared_interests?: string[];
    shared_industries?: string[];
    shared_skills?: string[];
    shared_groups?: string[];
    shared_events?: string[];
    geographic_proximity?: string;
    talking_points?: string[];
    icebreakers?: string[];
    relevance_score?: number;
    analyzed_at?: string;
  };

  // AI-generated personalized outreach
  personalized_message?: string;

  // Updated lead info from enrichment
  email?: string;
  phone?: string;
  company?: string;
  job_title?: string;
  company_domain?: string;
  location?: string;

  // Scoring
  lead_score?: number;
  lead_temperature?: 'cold' | 'warm' | 'hot';

  // Status
  enrichment_status?: 'enriched' | 'partial' | 'failed';
  error_message?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret (basic auth for n8n)
    const webhookSecret = process.env.WARM_LEAD_WEBHOOK_SECRET;
    if (webhookSecret) {
      const authHeader = request.headers.get('x-webhook-secret');
      if (authHeader !== webhookSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const payload: EnrichmentPayload = await request.json();
    const { warm_lead_id } = payload;

    if (!warm_lead_id) {
      return NextResponse.json({ error: 'warm_lead_id is required' }, { status: 400 });
    }

    // Verify the lead exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('warm_leads')
      .select('id, enrichment_status')
      .eq('id', warm_lead_id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Warm lead not found' }, { status: 404 });
    }

    // Build the update object (only include fields that were provided)
    const updates: Record<string, unknown> = {};

    if (payload.apollo_person_id) updates.apollo_person_id = payload.apollo_person_id;
    if (payload.apollo_data) updates.apollo_data = payload.apollo_data;
    if (payload.social_data) updates.social_data = payload.social_data;
    if (payload.commonalities) updates.commonalities = payload.commonalities;
    if (payload.personalized_message) updates.personalized_message = payload.personalized_message;
    if (payload.email) updates.email = payload.email.trim().toLowerCase();
    if (payload.phone) updates.phone = payload.phone;
    if (payload.company) updates.company = payload.company;
    if (payload.job_title) updates.job_title = payload.job_title;
    if (payload.company_domain) updates.company_domain = payload.company_domain;
    if (payload.location) updates.location = payload.location;
    if (payload.lead_score !== undefined) updates.lead_score = payload.lead_score;
    if (payload.lead_temperature) updates.lead_temperature = payload.lead_temperature;

    // Set enrichment status
    updates.enrichment_status = payload.enrichment_status || 'enriched';
    updates.enriched_at = new Date().toISOString();

    // If enrichment provided a personalized message, mark as draft_ready
    if (payload.personalized_message && !payload.error_message) {
      updates.outreach_status = 'draft_ready';
      updates.qualification_status = 'qualified';
    }

    // Update the lead
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('warm_leads')
      .update(updates)
      .eq('id', warm_lead_id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log enrichment activity
    await supabaseAdmin.from('warm_lead_activities').insert({
      warm_lead_id,
      activity_type: 'enriched',
      description: payload.error_message
        ? `Enrichment failed: ${payload.error_message}`
        : `Enrichment completed. Score: ${payload.lead_score || 'N/A'}. Commonalities found: ${payload.commonalities?.talking_points?.length || 0} talking points.`,
      metadata: {
        has_apollo: !!payload.apollo_data,
        has_social: !!payload.social_data,
        has_commonalities: !!payload.commonalities,
        has_personalized_message: !!payload.personalized_message,
        relevance_score: payload.commonalities?.relevance_score,
        lead_score: payload.lead_score,
        error: payload.error_message || null,
      },
    });

    // If commonalities were found, log that separately
    if (payload.commonalities && (payload.commonalities.talking_points?.length ?? 0) > 0) {
      await supabaseAdmin.from('warm_lead_activities').insert({
        warm_lead_id,
        activity_type: 'commonalities_found',
        description: `Found ${payload.commonalities.talking_points?.length || 0} talking points and ${payload.commonalities.icebreakers?.length || 0} icebreakers. Relevance: ${payload.commonalities.relevance_score || 'N/A'}/100.`,
        metadata: payload.commonalities,
      });
    }

    // If personalized message was drafted, log it
    if (payload.personalized_message) {
      await supabaseAdmin.from('warm_lead_activities').insert({
        warm_lead_id,
        activity_type: 'message_drafted',
        description: 'AI-generated personalized outreach message ready for review.',
        metadata: {
          message_preview: payload.personalized_message.substring(0, 200),
          based_on_commonalities: (payload.commonalities?.talking_points?.length ?? 0) > 0,
        },
      });
    }

    return NextResponse.json({ success: true, lead: updated });
  } catch (error) {
    console.error('Warm lead enrichment webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
