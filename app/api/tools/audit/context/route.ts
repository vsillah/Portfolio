import { NextRequest, NextResponse } from 'next/server'
import { getDiagnosticAudit, saveDiagnosticAudit } from '@/lib/diagnostic'
import { fetchTechStackByDomain, domainForLookup } from '@/lib/tech-stack-lookup'
import { getIndustryGicsCode, INDUSTRIES } from '@/lib/constants/industry'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/tools/audit/context
 * Update business context (URL, email, industry) on an existing diagnostic audit.
 * Used by the chat diagnostic side panel and for late-binding context.
 * Body: { auditId, websiteUrl?, email?, industry? }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { auditId } = body as { auditId?: string }

    if (!auditId) {
      return NextResponse.json({ error: 'auditId is required' }, { status: 400 })
    }

    const auditResult = await getDiagnosticAudit(auditId)
    if (!auditResult.data) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    const existing = auditResult.data
    const websiteUrl = typeof body.websiteUrl === 'string' ? body.websiteUrl.trim() : undefined
    const contactEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined
    const industrySlug = typeof body.industry === 'string' && body.industry in INDUSTRIES
      ? body.industry
      : undefined

    const result = await saveDiagnosticAudit(existing.session_id, {
      diagnosticAuditId: auditId,
      websiteUrl: websiteUrl || undefined,
      contactEmail: contactEmail || undefined,
      industrySlug: industrySlug || undefined,
      industryGicsCode: industrySlug ? getIndustryGicsCode(industrySlug) : undefined,
    })

    if (result.error) {
      return NextResponse.json({ error: result.error.message || 'Update failed' }, { status: 500 })
    }

    // Fire-and-forget: BuiltWith enrichment if URL provided and not already enriched
    if (websiteUrl && !existing.enriched_tech_stack) {
      enrichWithBuiltWith(auditId, websiteUrl).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Audit context update error', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

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
