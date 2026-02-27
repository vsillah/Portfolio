import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/chat-eval/categories/from-open-code
 * Create an evaluation category directly from an existing open code (no axial code generation).
 * Use when you want an open code like "Referencing AI tools" to appear in the Issue Category dropdown.
 */
export async function POST(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()
    const code = typeof body?.code === 'string' ? body.code.trim() : ''

    if (!code) {
      return NextResponse.json(
        { error: 'Open code (code) is required' },
        { status: 400 }
      )
    }

    // Optional: get description from open_codes if the code exists there
    const { data: openCodeRow } = await supabaseAdmin
      .from('open_codes')
      .select('description')
      .eq('code', code)
      .maybeSingle()

    const description = (openCodeRow as { description?: string } | null)?.description ?? null

    const { data: maxOrder } = await supabaseAdmin
      .from('evaluation_categories')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrder = ((maxOrder as { sort_order?: number } | null)?.sort_order ?? 0) + 1

    const { data: category, error } = await supabaseAdmin
      .from('evaluation_categories')
      .insert({
        name: code,
        description,
        color: '#8B5CF6',
        sort_order: nextOrder,
        is_active: true,
        source: 'open_code',
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A category with this name already exists' },
          { status: 409 }
        )
      }
      if (error.code === '23514') {
        return NextResponse.json(
          { error: "Database does not allow source 'open_code' yet. Run migration 2026_02_27_evaluation_categories_source_open_code.sql" },
          { status: 500 }
        )
      }
      console.error('Error creating category from open code:', error)
      return NextResponse.json(
        { error: 'Failed to create category' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      category,
      message: `"${code}" is now an issue category and will appear in the Issue Category dropdown.`,
    })
  } catch (err) {
    console.error('from-open-code error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
