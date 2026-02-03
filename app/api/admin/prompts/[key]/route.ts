import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { clearPromptCache } from '@/lib/system-prompts'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ key: string }>
}

/**
 * GET /api/admin/prompts/[key]
 * Get a specific prompt by key (admin only for full details)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { key } = await params
    
    // Verify admin access (optional - public can read but admin gets history)
    const authResult = await verifyAdmin(request)
    const isAdmin = !isAuthError(authResult)

    const { data: prompt, error } = await supabaseAdmin
      .from('system_prompts')
      .select('*')
      .eq('key', key)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
      }
      console.error('Error fetching prompt:', error)
      return NextResponse.json({ error: 'Failed to fetch prompt' }, { status: 500 })
    }

    // If admin, also fetch history
    let history = null
    if (isAdmin) {
      const { data: historyData } = await supabaseAdmin
        .from('system_prompt_history')
        .select('*')
        .eq('prompt_id', prompt.id)
        .order('version', { ascending: false })
        .limit(10)
      
      history = historyData
    }

    return NextResponse.json({ prompt, history })
  } catch (error) {
    console.error('Error in GET /api/admin/prompts/[key]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/admin/prompts/[key]
 * Update a system prompt (admin only)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  // Verify admin access
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const { key } = await params
    const body = await request.json()
    const { name, description, prompt, config, is_active } = body

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {
      updated_by: authResult.user.id,
    }

    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (prompt !== undefined) updates.prompt = prompt
    if (config !== undefined) updates.config = config
    if (is_active !== undefined) updates.is_active = is_active

    const { data, error } = await supabaseAdmin
      .from('system_prompts')
      .update(updates)
      .eq('key', key)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
      }
      console.error('Error updating prompt:', error)
      return NextResponse.json({ error: 'Failed to update prompt' }, { status: 500 })
    }

    // Clear cache so prompt updates are immediately available to n8n and other consumers
    clearPromptCache(key)

    return NextResponse.json({ prompt: data })
  } catch (error) {
    console.error('Error in PUT /api/admin/prompts/[key]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/prompts/[key]
 * Delete a system prompt (admin only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // Verify admin access
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const { key } = await params

    // Prevent deletion of core prompts
    const corePrompts = ['chatbot', 'voice_agent', 'llm_judge', 'diagnostic']
    if (corePrompts.includes(key)) {
      return NextResponse.json(
        { error: 'Cannot delete core system prompts. Disable them instead.' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('system_prompts')
      .delete()
      .eq('key', key)

    if (error) {
      console.error('Error deleting prompt:', error)
      return NextResponse.json({ error: 'Failed to delete prompt' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/admin/prompts/[key]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

