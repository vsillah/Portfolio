import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('outcome_groups')
      .select('id, slug, label, display_order, created_at, updated_at')
      .order('display_order', { ascending: true })
      .order('slug', { ascending: true })

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json([])
      }
      throw error
    }

    return NextResponse.json(data ?? [])
  } catch (error: unknown) {
    console.error('Error fetching outcome groups:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch outcome groups' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json()
    const { slug, label, display_order } = body as { slug?: string; label?: string; display_order?: number }

    if (!slug || typeof slug !== 'string' || !slug.trim()) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 })
    }
    if (!label || typeof label !== 'string' || !label.trim()) {
      return NextResponse.json({ error: 'label is required' }, { status: 400 })
    }

    const order = typeof display_order === 'number' && Number.isInteger(display_order) ? display_order : 0

    const { data, error } = await supabaseAdmin
      .from('outcome_groups')
      .insert([{ slug: slug.trim(), label: label.trim(), display_order: order }])
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'An outcome group with this slug already exists' }, { status: 400 })
      }
      throw error
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error: unknown) {
    console.error('Error creating outcome group:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create outcome group' },
      { status: 500 }
    )
  }
}
