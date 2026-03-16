import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface ContactResult {
  email: string
  name: string | null
  company: string | null
  source: 'client' | 'lead'
}

/**
 * GET /api/admin/contacts-search
 *
 * Unified search across client_projects and contact_submissions.
 * Returns deduplicated results by email, preferring client_projects.
 *
 * Query params:
 *   - q: search term (matches name, email, company — case-insensitive)
 *   - limit: max results (default 20, max 50)
 */
export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()
  const limit = Math.min(Number(searchParams.get('limit') || 20), 50)

  try {
    const seen = new Map<string, ContactResult>()

    // 1. Client projects (higher priority)
    let clientQuery = supabaseAdmin
      .from('client_projects')
      .select('client_email, client_name, client_company')
      .not('client_email', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (q) {
      clientQuery = clientQuery.or(
        `client_name.ilike.%${q}%,client_email.ilike.%${q}%,client_company.ilike.%${q}%`
      )
    }

    const { data: clients } = await clientQuery
    for (const c of clients ?? []) {
      if (!c.client_email) continue
      const email = c.client_email.trim().toLowerCase()
      if (!seen.has(email)) {
        seen.set(email, { email, name: c.client_name, company: c.client_company, source: 'client' })
      }
    }

    // 2. Contact submissions (leads) — fill remaining slots
    const remaining = limit - seen.size
    if (remaining > 0) {
      let leadQuery = supabaseAdmin
        .from('contact_submissions')
        .select('email, name, company')
        .not('email', 'is', null)
        .is('removed_at', null)
        .eq('do_not_contact', false)
        .order('created_at', { ascending: false })
        .limit(remaining + seen.size)

      if (q) {
        leadQuery = leadQuery.or(
          `name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`
        )
      }

      const { data: leads } = await leadQuery
      for (const l of leads ?? []) {
        if (!l.email) continue
        const email = l.email.trim().toLowerCase()
        if (!seen.has(email)) {
          seen.set(email, { email, name: l.name, company: l.company, source: 'lead' })
        }
        if (seen.size >= limit) break
      }
    }

    const contacts = Array.from(seen.values())

    return NextResponse.json({ contacts })
  } catch (error) {
    console.error('[admin/contacts-search] Error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
