import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const contactId = searchParams.get('contactId')
  const auditId = searchParams.get('auditId')

  if (!contactId) {
    return NextResponse.json({ error: 'contactId is required' }, { status: 400 })
  }

  const contactIdNum = parseInt(contactId, 10)
  if (isNaN(contactIdNum)) {
    return NextResponse.json({ error: 'contactId must be a number' }, { status: 400 })
  }

  const auditIdParam = auditId?.trim() || null

  try {
    const [contactResult, auditResult, painPointResult, marketIntelResult, meetingsResult] = await Promise.all([
      supabaseAdmin
        .from('contact_submissions')
        .select('id, name, company, industry, company_domain, website_tech_stack')
        .eq('id', contactIdNum)
        .single(),

      auditIdParam
        ? supabaseAdmin
            .from('diagnostic_audits')
            .select(
              'id, diagnostic_summary, key_insights, recommended_actions, business_challenges, tech_stack, automation_needs, ai_readiness, budget_timeline, decision_making, urgency_score, opportunity_score'
            )
            .eq('id', auditIdParam)
            .single()
        : Promise.resolve({ data: null, error: null }),

      auditIdParam
        ? supabaseAdmin
            .from('pain_point_evidence')
            .select('id, source_excerpt, source_type, pain_point_category_id')
            .eq('source_type', 'diagnostic_audit')
            .eq('source_id', auditIdParam)
            .limit(20)
        : Promise.resolve({ data: [], error: null }),

      supabaseAdmin
        .from('market_intelligence')
        .select('id, content_text, source_platform, content_type, industry_detected, sentiment_score, relevance_score')
        .order('relevance_score', { ascending: false })
        .limit(15),

      supabaseAdmin
        .from('meeting_records')
        .select('id, meeting_type, meeting_date, transcript, structured_notes')
        .eq('contact_submission_id', contactIdNum)
        .order('meeting_date', { ascending: false })
        .limit(20),
    ])

    const contact = contactResult.data
    const audit = auditResult.data
    const painPoints = painPointResult.data || []
    let marketIntel = marketIntelResult.data || []

    // Filter market intel by contact industry when available
    if (contact?.industry && marketIntel.length > 0) {
      const industryFiltered = marketIntel.filter(
        (mi: { industry_detected: string | null }) =>
          mi.industry_detected?.toLowerCase().includes(contact.industry.toLowerCase())
      )
      if (industryFiltered.length > 0) {
        marketIntel = industryFiltered
      }
    }

    const auditFindings = audit
      ? {
          summary: audit.diagnostic_summary,
          insights: audit.key_insights || [],
          actions: audit.recommended_actions || [],
          categories: {
            business_challenges: audit.business_challenges,
            tech_stack: audit.tech_stack,
            automation_needs: audit.automation_needs,
            ai_readiness: audit.ai_readiness,
            budget_timeline: audit.budget_timeline,
            decision_making: audit.decision_making,
          },
          scores: {
            urgency: audit.urgency_score,
            opportunity: audit.opportunity_score,
          },
          painPointExcerpts: painPoints.map((pp: { id: string; source_excerpt: string; pain_point_category_id: string }) => ({
            id: pp.id,
            excerpt: pp.source_excerpt,
            categoryId: pp.pain_point_category_id,
          })),
        }
      : null

    const meetings = (meetingsResult.data || []) as Array<{
      id: string
      meeting_type: string | null
      meeting_date: string | null
      transcript: string | null
      structured_notes: Record<string, unknown> | null
    }>

    const meetingExcerpts = meetings.flatMap((m) => {
      const items: Array<{
        meetingId: string
        excerptId: string
        sourceLabel: string
        dateLabel?: string
        text: string
      }> = []
      const dateLabel = m.meeting_date
        ? new Date(m.meeting_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : undefined
      const sourceLabel = `${(m.meeting_type || 'meeting').replace(/_/g, ' ')}${dateLabel ? ` (${dateLabel})` : ''}`

      const transcriptText = (m.transcript || '').trim()
      if (transcriptText) {
        const sentences = transcriptText
          .split(/(?<=[.?!])\s+/)
          .map((s) => s.trim())
          .filter((s) => s.length >= 30 && s.length <= 320)
        sentences.slice(0, 6).forEach((sentence, idx) => {
          items.push({
            meetingId: m.id,
            excerptId: `${m.id}:t${idx}`,
            sourceLabel,
            dateLabel,
            text: sentence,
          })
        })
      }

      const notes = m.structured_notes
      if (notes && typeof notes === 'object') {
        for (const [key, value] of Object.entries(notes)) {
          if (typeof value === 'string' && value.trim().length >= 20) {
            items.push({
              meetingId: m.id,
              excerptId: `${m.id}:n:${key}`,
              sourceLabel,
              dateLabel,
              text: `${key.replace(/_/g, ' ')}: ${value.trim().slice(0, 320)}`,
            })
          } else if (Array.isArray(value)) {
            value.slice(0, 5).forEach((entry, idx) => {
              if (typeof entry === 'string' && entry.trim().length >= 20) {
                items.push({
                  meetingId: m.id,
                  excerptId: `${m.id}:n:${key}:${idx}`,
                  sourceLabel,
                  dateLabel,
                  text: `${key.replace(/_/g, ' ')}: ${entry.trim().slice(0, 320)}`,
                })
              }
            })
          }
        }
      }

      return items
    })

    return NextResponse.json({
      auditFindings,
      marketIntel: marketIntel.map((mi: {
        id: string
        content_text: string
        source_platform: string | null
        content_type: string | null
        industry_detected: string | null
        sentiment_score: number | null
        relevance_score: number | null
      }) => ({
        id: mi.id,
        text: mi.content_text,
        platform: mi.source_platform,
        type: mi.content_type,
        industry: mi.industry_detected,
        sentiment: mi.sentiment_score,
        relevance: mi.relevance_score,
      })),
      techStack: contact?.website_tech_stack || null,
      companyDomain: contact?.company_domain || null,
      contactIndustry: contact?.industry || null,
      meetingExcerpts,
    })
  } catch (err) {
    console.error('Report context preview error:', err)
    return NextResponse.json(
      { error: 'Failed to load report context' },
      { status: 500 }
    )
  }
}
