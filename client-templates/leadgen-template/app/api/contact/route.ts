import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { triggerLeadQualificationWebhook } from '@/lib/n8n'

export const dynamic = 'force-dynamic'

// Map interest area codes to human-readable labels
// CUSTOMIZE: Update these for your client's use case
const interestLabels: Record<string, string> = {
  consulting: 'Consulting Services',
  technology: 'Technology Solutions',
  partnership: 'Partnership Opportunity',
  other: 'Other',
}

// Helper function to normalize URLs
const normalizeUrl = (url: string | undefined): string | null => {
  if (!url || !url.trim()) return null
  const trimmed = url.trim()
  if (trimmed.match(/^https?:\/\//i)) return trimmed
  return `https://${trimmed}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      name, 
      email, 
      company, 
      companyDomain,
      linkedinUrl,
      annualRevenue, 
      interestAreas, 
      isDecisionMaker, 
      message 
    } = body

    // Basic validation
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      )
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // Generate interest summary
    const interestAreasArray = Array.isArray(interestAreas) ? interestAreas : []
    const interestSummary = interestAreasArray.length > 0
      ? interestAreasArray.map(code => interestLabels[code] || code).join(', ')
      : undefined

    // Normalize URLs
    const normalizedCompanyDomain = normalizeUrl(companyDomain)
    const normalizedLinkedinUrl = normalizeUrl(linkedinUrl)

    // Insert into database
    const { data, error } = await supabaseAdmin
      .from('contact_submissions')
      .insert([
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          company: company?.trim() || null,
          company_domain: normalizedCompanyDomain,
          linkedin_url: normalizedLinkedinUrl,
          annual_revenue: annualRevenue || null,
          interest_areas: interestAreasArray.length > 0 ? interestAreasArray : null,
          interest_summary: interestSummary || null,
          is_decision_maker: isDecisionMaker || false,
          message: message.trim(),
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to save message' },
        { status: 500 }
      )
    }

    // Fire lead qualification webhook asynchronously
    triggerLeadQualificationWebhook({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      company: company?.trim() || undefined,
      companyDomain: normalizedCompanyDomain || undefined,
      linkedinUrl: normalizedLinkedinUrl || undefined,
      message: message.trim(),
      annualRevenue: annualRevenue || undefined,
      interestAreas: interestAreasArray.length > 0 ? interestAreasArray : undefined,
      interestSummary,
      isDecisionMaker: isDecisionMaker || false,
      submissionId: data.id,
      submittedAt: new Date().toISOString(),
      source: 'contact_form',
    }).catch((err) => {
      console.error('Lead qualification webhook failed:', err)
    })

    return NextResponse.json(
      { success: true, id: data.id },
      { status: 201 }
    )
  } catch (error) {
    console.error('Contact form error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve submissions (admin only)
export async function GET(request: NextRequest) {
  try {
    // TODO: Add authentication check here
    const { data, error } = await supabaseAdmin
      .from('contact_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      throw error
    }

    return NextResponse.json({ submissions: data })
  } catch (error) {
    console.error('Error fetching submissions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    )
  }
}
