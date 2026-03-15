// API Route: Warm Leads Management
// GET  - List warm leads with filters
// POST - Create a single warm lead (manual add)

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase';
import { triggerWarmLeadEnrichmentWebhook } from '@/lib/n8n-warm-leads';

export const dynamic = 'force-dynamic';

// ─── GET: List warm leads with filters ────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');           // qualification_status
    const outreach = searchParams.get('outreach');       // outreach_status
    const temperature = searchParams.get('temperature'); // lead_temperature
    const enrichment = searchParams.get('enrichment');   // enrichment_status
    const source = searchParams.get('source');
    const search = searchParams.get('search');
    const tag = searchParams.get('tag');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const view = searchParams.get('view');               // 'outreach_ready' | 'follow_up_due'

    // Use pre-built views for common queries
    if (view === 'outreach_ready') {
      const { data, error, count } = await supabaseAdmin
        .from('warm_leads_outreach_ready')
        .select('*', { count: 'exact' })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return NextResponse.json({ leads: data, total: count });
    }

    if (view === 'follow_up_due') {
      const { data, error, count } = await supabaseAdmin
        .from('warm_leads_follow_up_due')
        .select('*', { count: 'exact' })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return NextResponse.json({ leads: data, total: count });
    }

    // Standard filtered query
    let query = supabaseAdmin
      .from('warm_leads')
      .select('*', { count: 'exact' });

    if (status) query = query.eq('qualification_status', status);
    if (outreach) query = query.eq('outreach_status', outreach);
    if (temperature) query = query.eq('lead_temperature', temperature);
    if (enrichment) query = query.eq('enrichment_status', enrichment);
    if (source) query = query.eq('source', source);
    if (tag) query = query.contains('tags', [tag]);
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query
      .order('lead_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ leads: data, total: count });
  } catch (error) {
    console.error('Warm leads GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Create a single warm lead ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const body = await request.json();
    const {
      full_name,
      email,
      phone,
      company,
      job_title,
      company_domain,
      location,
      linkedin_url,
      twitter_url,
      instagram_url,
      facebook_url,
      github_url,
      personal_website,
      source = 'manual',
      source_detail,
      source_url,
      tags,
      internal_notes,
      auto_enrich = true,  // trigger enrichment by default
    } = body;

    if (!full_name) {
      return NextResponse.json({ error: 'full_name is required' }, { status: 400 });
    }

    // Check for duplicate by email or LinkedIn URL
    if (email || linkedin_url) {
      const conditions: string[] = [];
      if (email) conditions.push(`email.eq.${email.trim().toLowerCase()}`);
      if (linkedin_url) conditions.push(`linkedin_url.eq.${linkedin_url.trim()}`);

      const { data: existing } = await supabaseAdmin
        .from('warm_leads')
        .select('id, full_name, email')
        .or(conditions.join(','))
        .limit(1);

      if (existing && existing.length > 0) {
        return NextResponse.json(
          {
            error: 'Duplicate lead found',
            existing_id: existing[0].id,
            existing_name: existing[0].full_name,
          },
          { status: 409 }
        );
      }
    }

    const { data: lead, error } = await supabaseAdmin
      .from('warm_leads')
      .insert({
        full_name: full_name.trim(),
        email: email?.trim().toLowerCase() || null,
        phone: phone?.trim() || null,
        company: company?.trim() || null,
        job_title: job_title?.trim() || null,
        company_domain: company_domain?.trim() || null,
        location: location?.trim() || null,
        linkedin_url: linkedin_url?.trim() || null,
        twitter_url: twitter_url?.trim() || null,
        instagram_url: instagram_url?.trim() || null,
        facebook_url: facebook_url?.trim() || null,
        github_url: github_url?.trim() || null,
        personal_website: personal_website?.trim() || null,
        source,
        source_detail: source_detail || null,
        source_url: source_url || null,
        tags: tags || [],
        internal_notes: internal_notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Log the activity
    await supabaseAdmin.from('warm_lead_activities').insert({
      warm_lead_id: lead.id,
      activity_type: 'imported',
      description: `Lead manually created from source: ${source}`,
      performed_by: adminResult.user.id,
    });

    // Trigger enrichment if requested
    if (auto_enrich) {
      triggerWarmLeadEnrichmentWebhook(lead).catch((err) => {
        console.error('Warm lead enrichment webhook failed:', err);
      });
    }

    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    console.error('Warm leads POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
