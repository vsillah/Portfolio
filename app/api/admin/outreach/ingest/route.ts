import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Valid warm lead source values
 */
const VALID_LEAD_SOURCES = [
  'warm_facebook_friends',
  'warm_facebook_groups',
  'warm_facebook_engagement',
  'warm_google_contacts',
  'warm_linkedin_connections',
  'warm_linkedin_engagement',
  // Also allow cold sources for reuse
  'cold_apollo',
  'cold_linkedin',
  'cold_referral',
  'cold_google_maps',
] as const

/**
 * Relationship strength mapping from lead source
 */
function getRelationshipStrength(leadSource: string): 'strong' | 'moderate' | 'weak' {
  switch (leadSource) {
    case 'warm_facebook_friends':
    case 'warm_linkedin_connections':
    case 'warm_google_contacts':
      return 'strong'
    case 'warm_facebook_groups':
      return 'moderate'
    case 'warm_facebook_engagement':
    case 'warm_linkedin_engagement':
      return 'weak'
    default:
      return 'weak'
  }
}

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
      if (!VALID_LEAD_SOURCES.includes(lead.lead_source as typeof VALID_LEAD_SOURCES[number])) {
        return NextResponse.json(
          { error: `Invalid lead_source: ${lead.lead_source}` },
          { status: 400 }
        )
      }
    }

    let inserted = 0
    let skipped = 0
    let updated = 0
    const errors: string[] = []

    for (const lead of leads) {
      try {
        // Check for duplicates by email, linkedin_username, or facebook_profile_url
        let existingId: number | null = null

        if (lead.email) {
          const { data } = await supabaseAdmin
            .from('contact_submissions')
            .select('id')
            .eq('email', lead.email)
            .limit(1)
            .single()
          if (data) existingId = data.id
        }

        if (!existingId && lead.linkedin_username) {
          const { data } = await supabaseAdmin
            .from('contact_submissions')
            .select('id')
            .eq('linkedin_username', lead.linkedin_username)
            .limit(1)
            .single()
          if (data) existingId = data.id
        }

        if (!existingId && lead.linkedin_url) {
          const { data } = await supabaseAdmin
            .from('contact_submissions')
            .select('id')
            .eq('linkedin_url', lead.linkedin_url)
            .limit(1)
            .single()
          if (data) existingId = data.id
        }

        if (!existingId && lead.facebook_profile_url) {
          const { data } = await supabaseAdmin
            .from('contact_submissions')
            .select('id')
            .eq('facebook_profile_url', lead.facebook_profile_url)
            .limit(1)
            .single()
          if (data) existingId = data.id
        }

        if (existingId) {
          // Update existing contact with any new warm lead data
          const updatePayload: Record<string, unknown> = {}
          if (lead.facebook_profile_url) updatePayload.facebook_profile_url = lead.facebook_profile_url
          if (lead.phone_number) updatePayload.phone_number = lead.phone_number
          if (lead.warm_source_detail) updatePayload.warm_source_detail = lead.warm_source_detail
          if (lead.job_title) updatePayload.job_title = lead.job_title
          if (lead.industry) updatePayload.industry = lead.industry
          if (lead.location) updatePayload.location = lead.location
          if (lead.linkedin_url) updatePayload.linkedin_url = lead.linkedin_url
          if (lead.linkedin_username) updatePayload.linkedin_username = lead.linkedin_username

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
            name: lead.name,
            email: lead.email || null,
            company: lead.company || null,
            company_domain: lead.company_domain || null,
            job_title: lead.job_title || null,
            industry: lead.industry || null,
            location: lead.location || null,
            employee_count: lead.employee_count || null,
            lead_source: lead.lead_source,
            outreach_status: 'not_contacted',
            linkedin_url: lead.linkedin_url || null,
            linkedin_username: lead.linkedin_username || null,
            facebook_profile_url: lead.facebook_profile_url || null,
            phone_number: lead.phone_number || null,
            relationship_strength: getRelationshipStrength(lead.lead_source),
            warm_source_detail: lead.warm_source_detail || null,
            message: lead.message || `Imported from ${lead.lead_source}`,
          }

          const { error: insertError } = await supabaseAdmin
            .from('contact_submissions')
            .insert(insertPayload)

          if (insertError) {
            errors.push(`Failed to insert ${lead.name}: ${insertError.message}`)
          } else {
            inserted++
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        errors.push(`Error processing ${lead.name}: ${errorMsg}`)
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: leads.length,
        inserted,
        updated,
        skipped,
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
