import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await Promise.resolve(params)

    const { data, error } = await supabaseAdmin
      .from('outcome_groups')
      .select('id, slug, label, display_order, created_at, updated_at')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Outcome group not found' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('Error fetching outcome group:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch outcome group' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await Promise.resolve(params)
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json() as Record<string, unknown>
    const updateData: Record<string, unknown> = {}

    if (typeof body.slug === 'string' && body.slug.trim()) updateData.slug = body.slug.trim()
    if (typeof body.label === 'string' && body.label.trim()) updateData.label = body.label.trim()
    if (typeof body.display_order === 'number' && Number.isInteger(body.display_order)) {
      updateData.display_order = body.display_order
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('outcome_groups')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Outcome group not found' }, { status: 404 })
      }
      if (error.code === '23505') {
        return NextResponse.json({ error: 'An outcome group with this slug already exists' }, { status: 400 })
      }
      throw error
    }

    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('Error updating outcome group:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update outcome group' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await Promise.resolve(params)
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { error } = await supabaseAdmin
      .from('outcome_groups')
      .delete()
      .eq('id', id)

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Outcome group not found' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error deleting outcome group:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete outcome group' },
      { status: 500 }
    )
  }
}
