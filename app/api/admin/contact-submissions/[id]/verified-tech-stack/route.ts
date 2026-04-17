/**
 * GET/PATCH admin-verified tech stack for a contact submission.
 *
 * GET  — returns the BuiltWith (website_tech_stack), audit (enriched_tech_stack),
 *        and admin-resolved (client_verified_tech_stack) stacks so the admin can
 *        review and reconcile conflicts between sources.
 *
 * PATCH — writes a canonical admin-resolved list of technologies to
 *         `contact_submissions.client_verified_tech_stack`. This takes
 *         precedence over the other sources when the feasibility engine runs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface TechnologyEntry {
  name: string
  tag?: string | null
  categories?: string[]
  parent?: string | null
}

function sanitizeTechnologies(raw: unknown): TechnologyEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((t) => {
      if (!t || typeof t !== 'object') return null
      const name = typeof (t as { name?: unknown }).name === 'string' ? (t as { name: string }).name.trim() : ''
      if (!name) return null
      const entry: TechnologyEntry = { name }
      const tag = (t as { tag?: unknown }).tag
      if (typeof tag === 'string' && tag.trim()) entry.tag = tag.trim()
      const categories = (t as { categories?: unknown }).categories
      if (Array.isArray(categories)) {
        entry.categories = categories.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      }
      const parent = (t as { parent?: unknown }).parent
      if (typeof parent === 'string' && parent.trim()) entry.parent = parent.trim()
      return entry
    })
    .filter((t): t is TechnologyEntry => t !== null)
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
    }

    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const { data: contact, error } = await supabaseAdmin
      .from('contact_submissions')
      .select('id, website_tech_stack, client_verified_tech_stack')
      .eq('id', id)
      .single()

    if (error || !contact) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data: audit } = await supabaseAdmin
      .from('diagnostic_audits')
      .select('enriched_tech_stack')
      .eq('contact_submission_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      contactSubmissionId: id,
      builtwith: contact.website_tech_stack ?? null,
      audit: audit?.enriched_tech_stack ?? null,
      verified: contact.client_verified_tech_stack ?? null,
    })
  } catch (err) {
    console.error('[verified-tech-stack GET] error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
    }

    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const clearOnly = body.clear === true
    const technologies = clearOnly ? [] : sanitizeTechnologies(body.technologies)

    const payload = clearOnly
      ? null
      : {
          technologies,
          resolved_at: new Date().toISOString(),
          resolved_by: auth.user.id,
        }

    const { error } = await supabaseAdmin
      .from('contact_submissions')
      .update({ client_verified_tech_stack: payload })
      .eq('id', id)

    if (error) {
      console.error('[verified-tech-stack PATCH] update failed', error)
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, verified: payload })
  } catch (err) {
    console.error('[verified-tech-stack PATCH] error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
