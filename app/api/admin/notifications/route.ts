import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const unreadOnly = url.searchParams.get('unread') === 'true'
  const limit = Math.min(Number(url.searchParams.get('limit') || 20), 50)

  let query = supabaseAdmin
    .from('admin_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unreadOnly) {
    query = query.eq('read', false)
  }

  const { data, error } = await query

  if (error) {
    console.error('admin_notifications fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { count } = await supabaseAdmin
    .from('admin_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('read', false)

  return NextResponse.json({
    notifications: data ?? [],
    unread_count: count ?? 0,
  })
}

export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  const ids: string[] = body.ids

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array is required' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('admin_notifications')
    .update({ read: true })
    .in('id', ids)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
