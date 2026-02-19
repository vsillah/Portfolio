import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rawScoreToTen } from '@/lib/scorecard'
import { triggerLeadQualificationWebhook } from '@/lib/n8n'

export const dynamic = 'force-dynamic'

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const RATE_LIMIT_MAX = 5

const ipTimestamps: Map<string, number[]> = new Map()

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const cut = now - RATE_LIMIT_WINDOW_MS
  let list = ipTimestamps.get(ip) ?? []
  list = list.filter((t) => t > cut)
  if (list.length >= RATE_LIMIT_MAX) return true
  list.push(now)
  ipTimestamps.set(ip, list)
  return false
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { email, name, score: rawScore, answers } = body as {
      email?: string
      name?: string
      score?: number
      answers?: Record<string, string>
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email || !emailRegex.test(String(email).trim())) {
      return NextResponse.json(
        { error: 'A valid email is required.' },
        { status: 400 }
      )
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const scoreOutOf10 = rawScore != null ? rawScoreToTen(Number(rawScore)) : 0

    const { data: existing } = await supabaseAdmin
      .from('contact_submissions')
      .select('id')
      .eq('email', normalizedEmail)
      .limit(1)
      .maybeSingle()

    const scoreOutOf10Clamped = Math.min(10, Math.max(0, scoreOutOf10))
    const fullReport =
      typeof answers === 'object' && answers !== null && Object.keys(answers).length > 0
        ? JSON.stringify(answers)
        : null

    // Minimal payload: only columns that exist on all contact_submissions schemas.
    // Omit submission_source and ai_readiness_score so submit works without those migrations.
    const payloadWithReport = {
      name: (name && String(name).trim()) || null,
      email: normalizedEmail,
      message: 'AI Readiness Scorecard',
      lead_source: 'website_form' as const,
      ...(fullReport ? { full_report: fullReport } : {}),
    }
    const payloadCore = {
      name: payloadWithReport.name,
      email: payloadWithReport.email,
      message: payloadWithReport.message,
      lead_source: payloadWithReport.lead_source,
    }

    let submissionId: number

    const doUpdate = async (row: typeof payloadCore & { full_report?: string | null }) => {
      return supabaseAdmin
        .from('contact_submissions')
        .update({
          name: row.name ?? undefined,
          message: row.message,
          lead_source: row.lead_source,
          ...(row.full_report != null ? { full_report: row.full_report } : {}),
        })
        .eq('id', existing!.id)
    }
    const doInsert = async (row: typeof payloadCore & { full_report?: string | null }) => {
      return supabaseAdmin
        .from('contact_submissions')
        .insert([{ ...row, ...(row.full_report != null ? { full_report: row.full_report } : {}) }])
        .select('id')
        .single()
    }

    if (existing) {
      submissionId = existing.id
      let result = await doUpdate(payloadWithReport)
      if (result.error) {
        result = await doUpdate(payloadCore)
      }
      if (result.error) {
        console.error('Scorecard submit update error:', result.error)
        return NextResponse.json(
          { error: 'Something went wrong. Please try again.' },
          { status: 500 }
        )
      }
    } else {
      let result = await doInsert(payloadWithReport)
      if (result.error && result.error.code !== '23505') {
        result = await doInsert(payloadCore)
      }
      if (result.error) {
        if (result.error.code === '23505') {
          return NextResponse.json({ success: true }, { status: 201 })
        }
        console.error('Scorecard submit insert error:', result.error)
        return NextResponse.json(
          { error: 'Something went wrong. Please try again.' },
          { status: 500 }
        )
      }
      submissionId = (result.data as { id: number })?.id ?? 0
    }

    // Fire lead qualification webhook asynchronously (same as contact form)
    triggerLeadQualificationWebhook({
      name: payloadWithReport.name ?? '',
      email: payloadWithReport.email,
      message: payloadWithReport.message,
      submissionId: String(submissionId),
      submittedAt: new Date().toISOString(),
      source: 'scorecard',
      aiReadinessScore: scoreOutOf10Clamped,
    }).catch((err) => {
      console.error('Lead qualification webhook failed:', err)
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error('Scorecard submit error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
