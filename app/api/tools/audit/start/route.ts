import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { saveDiagnosticAudit } from '@/lib/diagnostic'
import { tryVerifyAuth } from '@/lib/auth-server'
import { fetchTechStackByDomain, domainForLookup } from '@/lib/tech-stack-lookup'
import { getIndustryGicsCode, INDUSTRIES } from '@/lib/constants/industry'

export const dynamic = 'force-dynamic'

function generateAuditSessionId(): string {
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).substring(2, 12)
  return `audit_${t}_${r}`
}

/**
 * Fire-and-forget BuiltWith lookup. Stores result on the audit row
 * as enriched_tech_stack without blocking the response.
 */
async function enrichWithBuiltWith(auditId: string, websiteUrl: string): Promise<void> {
  try {
    const domain = domainForLookup(websiteUrl)
    if (!domain) return

    const result = await fetchTechStackByDomain(domain)
    if (!result.ok || !result.technologies?.length) return

    await supabaseAdmin
      .from('diagnostic_audits')
      .update({
        enriched_tech_stack: {
          domain: result.domain,
          technologies: result.technologies,
          byTag: result.byTag ?? {},
          fetchedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', auditId)
  } catch (err) {
    console.error('BuiltWith enrichment failed (non-blocking):', err)
  }
}

/**
 * POST /api/tools/audit/start
 * Creates a chat_sessions row and a diagnostic_audits row for the standalone audit tool.
 * Accepts optional Step 0 context: { businessName, websiteUrl, email, industry }
 * Returns { sessionId, auditId } for the client to use in subsequent update calls.
 */
export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown> = {}
    try {
      body = await request.json()
    } catch {
      // No body is fine — backwards compatible with original no-body POST
    }

    const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : undefined
    const websiteUrl = typeof body.websiteUrl === 'string' ? body.websiteUrl.trim() : undefined
    const contactEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined
    const industrySlug = typeof body.industry === 'string' && body.industry in INDUSTRIES
      ? body.industry
      : undefined

    const sessionId = generateAuditSessionId()

    const authUser = await tryVerifyAuth(request)
    const userId = authUser?.user?.id

    const { error: sessionError } = await supabaseAdmin
      .from('chat_sessions')
      .insert({
        session_id: sessionId,
        visitor_email: contactEmail || null,
        visitor_name: businessName || null,
      })

    if (sessionError) {
      const err = sessionError as { message?: string }
      console.error('Audit start: chat_sessions insert failed', sessionError)
      return NextResponse.json(
        { error: err?.message || 'Could not start audit session' },
        { status: 500 }
      )
    }

    const result = await saveDiagnosticAudit(sessionId, {
      status: 'in_progress',
      auditType: 'standalone',
      businessName: businessName || undefined,
      websiteUrl: websiteUrl || undefined,
      contactEmail: contactEmail || undefined,
      industrySlug: industrySlug || undefined,
      industryGicsCode: industrySlug ? getIndustryGicsCode(industrySlug) : undefined,
      ...(userId ? { userId } : {}),
    })

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message || 'Could not create audit' },
        { status: 500 }
      )
    }

    // Fire-and-forget: enrich with BuiltWith if URL provided
    if (websiteUrl && result.id) {
      enrichWithBuiltWith(result.id, websiteUrl).catch(() => {})
    }

    return NextResponse.json({
      sessionId,
      auditId: result.id,
    })
  } catch (e) {
    console.error('Audit start error', e)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
