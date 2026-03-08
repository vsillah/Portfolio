import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/communication-templates
 * List all progress_update_templates (admin only).
 * Optional ?update_type=action_items_update to filter.
 */
export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { searchParams } = new URL(request.url)
  const updateType = searchParams.get('update_type')

  let query = supabaseAdmin
    .from('progress_update_templates')
    .select('*')
    .order('update_type')
    .order('created_at', { ascending: false })

  if (updateType) {
    query = query.eq('update_type', updateType)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching communication templates:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }

  return NextResponse.json({ templates: data })
}

/**
 * PUT /api/admin/communication-templates
 * Update a template by id. Body: { id, email_subject?, email_body?, slack_body?, is_active?, tone? }
 */
export async function PUT(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const allowedFields = ['email_subject', 'email_body', 'slack_body', 'is_active', 'tone']
    const sanitized: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (key in updates) {
        sanitized[key] = updates[key]
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('progress_update_templates')
      .update(sanitized)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('Error updating communication template:', error)
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
    }

    return NextResponse.json({ template: data })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
