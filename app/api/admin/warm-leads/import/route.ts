// API Route: Bulk Import Warm Leads
// POST - Import multiple leads from CSV/JSON payload (e.g. Apollo export, Apify results)

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase';
import { triggerWarmLeadEnrichmentWebhook } from '@/lib/n8n-warm-leads';

export const dynamic = 'force-dynamic';

interface ImportLead {
  full_name: string;
  email?: string;
  phone?: string;
  company?: string;
  job_title?: string;
  company_domain?: string;
  location?: string;
  linkedin_url?: string;
  twitter_url?: string;
  instagram_url?: string;
  source?: string;
  source_detail?: string;
  source_url?: string;
  tags?: string[];
  // Pre-enriched data from Apollo
  apollo_person_id?: string;
  apollo_data?: Record<string, unknown>;
  // Pre-scraped social data from Apify
  social_data?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const body = await request.json();
    const {
      leads,
      source = 'csv_import',
      source_detail,
      auto_enrich = true,
      skip_duplicates = true,
      tags: global_tags = [],
    }: {
      leads: ImportLead[];
      source?: string;
      source_detail?: string;
      auto_enrich?: boolean;
      skip_duplicates?: boolean;
      tags?: string[];
    } = body;

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'leads array is required and must not be empty' }, { status: 400 });
    }

    if (leads.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 leads per import' }, { status: 400 });
    }

    const results = {
      imported: 0,
      duplicates: 0,
      errors: 0,
      imported_ids: [] as string[],
      duplicate_ids: [] as string[],
      error_details: [] as { index: number; name: string; error: string }[],
    };

    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);

      for (let j = 0; j < batch.length; j++) {
        const lead = batch[j];
        const index = i + j;

        if (!lead.full_name) {
          results.errors++;
          results.error_details.push({ index, name: 'unknown', error: 'full_name is required' });
          continue;
        }

        try {
          // Check for duplicates
          if (skip_duplicates && (lead.email || lead.linkedin_url || lead.apollo_person_id)) {
            const conditions: string[] = [];
            if (lead.email) conditions.push(`email.eq.${lead.email.trim().toLowerCase()}`);
            if (lead.linkedin_url) conditions.push(`linkedin_url.eq.${lead.linkedin_url.trim()}`);
            if (lead.apollo_person_id) conditions.push(`apollo_person_id.eq.${lead.apollo_person_id}`);

            const { data: existing } = await supabaseAdmin
              .from('warm_leads')
              .select('id')
              .or(conditions.join(','))
              .limit(1);

            if (existing && existing.length > 0) {
              results.duplicates++;
              results.duplicate_ids.push(existing[0].id);
              continue;
            }
          }

          // Determine enrichment status based on pre-existing data
          const hasApolloData = lead.apollo_data && Object.keys(lead.apollo_data).length > 0;
          const hasSocialData = lead.social_data && Object.keys(lead.social_data).length > 0;
          let enrichment_status = 'pending';
          if (hasApolloData && hasSocialData) enrichment_status = 'enriched';
          else if (hasApolloData || hasSocialData) enrichment_status = 'partial';

          const mergedTags = [
            ...(lead.tags || []),
            ...global_tags,
          ].filter((t, idx, arr) => arr.indexOf(t) === idx); // dedupe

          const { data: created, error } = await supabaseAdmin
            .from('warm_leads')
            .insert({
              full_name: lead.full_name.trim(),
              email: lead.email?.trim().toLowerCase() || null,
              phone: lead.phone?.trim() || null,
              company: lead.company?.trim() || null,
              job_title: lead.job_title?.trim() || null,
              company_domain: lead.company_domain?.trim() || null,
              location: lead.location?.trim() || null,
              linkedin_url: lead.linkedin_url?.trim() || null,
              twitter_url: lead.twitter_url?.trim() || null,
              instagram_url: lead.instagram_url?.trim() || null,
              source: lead.source || source,
              source_detail: lead.source_detail || source_detail || null,
              source_url: lead.source_url || null,
              tags: mergedTags,
              apollo_person_id: lead.apollo_person_id || null,
              apollo_data: lead.apollo_data || {},
              social_data: lead.social_data || {},
              enrichment_status,
              enriched_at: enrichment_status !== 'pending' ? new Date().toISOString() : null,
            })
            .select('id')
            .single();

          if (error) throw error;

          results.imported++;
          results.imported_ids.push(created.id);

          // Log activity
          await supabaseAdmin.from('warm_lead_activities').insert({
            warm_lead_id: created.id,
            activity_type: 'imported',
            description: `Bulk imported from source: ${lead.source || source}`,
            metadata: {
              source: lead.source || source,
              source_detail: lead.source_detail || source_detail,
              had_apollo_data: hasApolloData,
              had_social_data: hasSocialData,
            },
            performed_by: adminResult.user.id,
          });
        } catch (err) {
          results.errors++;
          results.error_details.push({
            index,
            name: lead.full_name,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
    }

    // Trigger enrichment for leads that need it
    if (auto_enrich && results.imported_ids.length > 0) {
      // Fetch the leads that need enrichment
      const { data: needsEnrichment } = await supabaseAdmin
        .from('warm_leads')
        .select('*')
        .in('id', results.imported_ids)
        .eq('enrichment_status', 'pending');

      if (needsEnrichment && needsEnrichment.length > 0) {
        // Fire enrichment webhooks (fire-and-forget, don't block)
        for (const lead of needsEnrichment) {
          triggerWarmLeadEnrichmentWebhook(lead).catch((err) => {
            console.error(`Enrichment webhook failed for lead ${lead.id}:`, err);
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Warm leads import error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
