// API Route: Trigger Enrichment for Warm Leads
// POST - Manually trigger enrichment for one or more warm leads

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase';
import { triggerWarmLeadEnrichmentWebhook } from '@/lib/n8n-warm-leads';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const body = await request.json();
    const { lead_ids, enrich_all_pending = false } = body;

    let leads;

    if (enrich_all_pending) {
      // Fetch all pending leads
      const { data, error } = await supabaseAdmin
        .from('warm_leads')
        .select('*')
        .in('enrichment_status', ['pending', 'failed'])
        .limit(100);

      if (error) throw error;
      leads = data;
    } else if (lead_ids && Array.isArray(lead_ids) && lead_ids.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('warm_leads')
        .select('*')
        .in('id', lead_ids);

      if (error) throw error;
      leads = data;
    } else {
      return NextResponse.json(
        { error: 'Provide lead_ids array or set enrich_all_pending: true' },
        { status: 400 }
      );
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({ message: 'No leads found to enrich', triggered: 0 });
    }

    // Mark leads as enriching
    const leadIds = leads.map((l: { id: string }) => l.id);
    await supabaseAdmin
      .from('warm_leads')
      .update({ enrichment_status: 'enriching' })
      .in('id', leadIds);

    // Trigger enrichment webhooks
    let triggered = 0;
    for (const lead of leads) {
      try {
        await triggerWarmLeadEnrichmentWebhook(lead);
        triggered++;
      } catch (err) {
        console.error(`Failed to trigger enrichment for ${lead.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      triggered,
      total: leads.length,
    });
  } catch (error) {
    console.error('Warm lead enrich error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
