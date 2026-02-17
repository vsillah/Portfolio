import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { LEAD_SOURCE_VALUES, getRelationshipStrength } from '@/lib/constants/lead-source'
import { isLikelyOrganization } from '@/lib/lead-filters'

export const dynamic = 'force-dynamic'

interface IngestLead {
  name: string
  email?: string
  company?: string
  company_domain?: string
  job_title?: string
  industry?: string
  location?: string
  employee_count?: string
  lead_source: string
  linkedin_url?: string
  linkedin_username?: string
  facebook_profile_url?: string
  phone_number?: string
  warm_source_detail?: string
  message?: string
}

/**
 * POST /api/admin/outreach/ingest
 * Webhook endpoint for n8n to push scraped warm/cold leads.
 * Authenticated via a shared secret (N8N_INGEST_SECRET).
 * Deduplicates by email, linkedin_username, or facebook_profile_url.
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate via shared secret (simpler than OAuth for n8n webhooks)
    const authHeader = request.headers.get('authorization')
    const expectedSecret = process.env.N8N_INGEST_SECRET
    const token = authHeader?.replace('Bearer ', '')

    if (!expectedSecret || token !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { leads } = body as { leads: IngestLead[] }

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { error: 'leads array is required and must not be empty' },
        { status: 400 }
      )
    }

    // Validate lead sources
    for (const lead of leads) {
      if (!lead.name) {
        return NextResponse.json(
          { error: `Each lead must have a name` },
          { status: 400 }
        )
      }
      if (!LEAD_SOURCE_VALUES.includes(lead.lead_source as (typeof LEAD_SOURCE_VALUES)[number])) {
        return NextResponse.json(
          { error: `Invalid lead_source: ${lead.lead_source}` },
          { status: 400 }
        )
      }
    }

    let inserted = 0
    let skipped = 0
    let updated = 0
    let skippedCompany = 0
    let skippedDnc = 0
    const errors: string[] = []

    for (const lead of leads) {
      try {
        // Filter out companies/organizations so they are not pushed to the lead dashboard
        if (isLikelyOrganization(lead.name.trim(), lead.company)) {
          skippedCompany++
          continue
        }

        // Normalize email to lowercase for consistent matching
        const normalizedEmail = lead.email?.trim().toLowerCase() || null

        // Check for duplicates: email → linkedin_username → linkedin_url → facebook → name+source+company
        // Select id and do_not_contact so we can skip re-ingesting DNC leads
        let existingRow: { id: number; do_not_contact: boolean } | null = null

        if (normalizedEmail) {
          const { data } = await supabaseAdmin
            .from('contact_submissions')
            .select('id, do_not_contact')
            .eq('email', normalizedEmail)
            .limit(1)
            .single()
          if (data) existingRow = { id: data.id, do_not_contact: data.do_not_contact === true }
        }

        if (!existingRow && lead.linkedin_username) {
          const { data } = await supabaseAdmin
            .from('contact_submissions')
            .select('id, do_not_contact')
            .eq('linkedin_username', lead.linkedin_username.trim())
            .limit(1)
            .single()
          if (data) existingRow = { id: data.id, do_not_contact: data.do_not_contact === true }
        }

        if (!existingRow && lead.linkedin_url) {
          const { data } = await supabaseAdmin
            .from('contact_submissions')
            .select('id, do_not_contact')
            .eq('linkedin_url', lead.linkedin_url.trim())
            .limit(1)
            .single()
          if (data) existingRow = { id: data.id, do_not_contact: data.do_not_contact === true }
        }

        if (!existingRow && lead.facebook_profile_url) {
          const { data } = await supabaseAdmin
            .from('contact_submissions')
            .select('id, do_not_contact')
            .eq('facebook_profile_url', lead.facebook_profile_url.trim())
            .limit(1)
            .single()
          if (data) existingRow = { id: data.id, do_not_contact: data.do_not_contact === true }
        }

        // Fallback: name + source + company match for leads with no unique identifiers
        // Prevents re-importing the same Google Contact, business card, etc.
        if (!existingRow && !normalizedEmail && !lead.linkedin_username && !lead.linkedin_url && !lead.facebook_profile_url) {
          const { data } = await supabaseAdmin
            .from('contact_submissions')
            .select('id, do_not_contact')
            .ilike('name', lead.name.trim())
            .eq('lead_source', lead.lead_source)
            .limit(1)
            .single()
          if (data) existingRow = { id: data.id, do_not_contact: data.do_not_contact === true }
        }

        // Do not overwrite leads marked Do Not Contact when re-pushing from n8n
        if (existingRow?.do_not_contact) {
          skippedDnc++
          continue
        }

        const existingId = existingRow?.id ?? null

        if (existingId) {
          // Update existing contact with any new data
          const updatePayload: Record<string, unknown> = {}
          if (lead.facebook_profile_url) updatePayload.facebook_profile_url = lead.facebook_profile_url
          if (lead.phone_number) updatePayload.phone_number = lead.phone_number
          if (lead.warm_source_detail) updatePayload.warm_source_detail = lead.warm_source_detail
          if (lead.job_title) updatePayload.job_title = lead.job_title
          if (lead.industry) updatePayload.industry = lead.industry
          if (lead.location) updatePayload.location = lead.location
          if (lead.linkedin_url) updatePayload.linkedin_url = lead.linkedin_url
          if (lead.linkedin_username) updatePayload.linkedin_username = lead.linkedin_username

          // Update lead_source to reflect the most recent source
          updatePayload.lead_source = lead.lead_source

          // Only update relationship_strength if the new one is stronger
          const newStrength = getRelationshipStrength(lead.lead_source)
          updatePayload.relationship_strength = newStrength

          if (Object.keys(updatePayload).length > 0) {
            await supabaseAdmin
              .from('contact_submissions')
              .update(updatePayload)
              .eq('id', existingId)
            updated++
          } else {
            skipped++
          }
        } else {
          // Insert new contact submission
          const insertPayload = {
            name: lead.name.trim(),
            email: normalizedEmail,
            company: lead.company?.trim() || null,
            company_domain: lead.company_domain?.trim() || null,
            job_title: lead.job_title?.trim() || null,
            industry: lead.industry?.trim() || null,
            location: lead.location?.trim() || null,
            employee_count: lead.employee_count?.trim() || null,
            lead_source: lead.lead_source,
            outreach_status: 'not_contacted',
            linkedin_url: lead.linkedin_url?.trim() || null,
            linkedin_username: lead.linkedin_username?.trim() || null,
            facebook_profile_url: lead.facebook_profile_url?.trim() || null,
            phone_number: lead.phone_number?.trim() || null,
            relationship_strength: getRelationshipStrength(lead.lead_source),
            warm_source_detail: lead.warm_source_detail?.trim() || null,
            message: lead.message || `Imported from ${lead.lead_source}`,
          }

          const { error: insertError } = await supabaseAdmin
            .from('contact_submissions')
            .insert(insertPayload)

          if (insertError) {
            // If unique constraint violation (race condition), treat as update/skip
            if (insertError.code === '23505') {
              skipped++
            } else {
              errors.push(`Failed to insert ${lead.name}: ${insertError.message}`)
            }
          } else {
            inserted++
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        errors.push(`Error processing ${lead.name}: ${errorMsg}`)
      }
    }

    // Record successful run for 24h gate: update most recent 'running' audit row for this source (app-triggered runs)
    const firstLeadSource = leads[0]?.lead_source
    const auditSource =
      firstLeadSource?.startsWith('warm_facebook_')
        ? 'facebook'
        : firstLeadSource?.startsWith('warm_google_')
          ? 'google_contacts'
          : firstLeadSource?.startsWith('warm_linkedin_')
            ? 'linkedin'
            : null
    if (auditSource) {
      const completedAt = new Date().toISOString()
      const { data: runningRow } = await supabaseAdmin
        .from('warm_lead_trigger_audit')
        .select('id')
        .eq('source', auditSource)
        .eq('status', 'running')
        .order('triggered_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (runningRow) {
        await supabaseAdmin
          .from('warm_lead_trigger_audit')
          .update({ status: 'success', completed_at: completedAt })
          .eq('id', runningRow.id)
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: leads.length,
        inserted,
        updated,
        skipped,
        skipped_company: skippedCompany,
        skipped_dnc: skippedDnc,
        errors: errors.length,
      },
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Error in POST /api/admin/outreach/ingest:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
