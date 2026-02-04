import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/prompts
 * List all system prompts (admin only)
 */
export async function GET(request: NextRequest) {
  // Verify admin access
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    // Fetch all prompts
    const { data: prompts, error } = await supabaseAdmin
      .from('system_prompts')
      .select('*')
      .order('key')

    if (error) {
      console.error('Error fetching prompts:', error)
      return NextResponse.json({ error: 'Failed to fetch prompts' }, { status: 500 })
    }

    return NextResponse.json({ prompts })
  } catch (error) {
    console.error('Error in GET /api/admin/prompts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/prompts
 * Create a new system prompt (admin only)
 */
export async function POST(request: NextRequest) {
  // Verify admin access
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()
    const { key, name, description, prompt, config, is_active } = body

    if (!key || !name || !prompt) {
      return NextResponse.json(
        { error: 'Key, name, and prompt are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('system_prompts')
      .insert({
        key,
        name,
        description,
        prompt,
        config: config || {},
        is_active: is_active ?? true,
        created_by: authResult.user.id,
        updated_by: authResult.user.id,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A prompt with this key already exists' },
          { status: 409 }
        )
      }
      console.error('Error creating prompt:', error)
      return NextResponse.json({ error: 'Failed to create prompt' }, { status: 500 })
    }

    return NextResponse.json({ prompt: data }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/admin/prompts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
