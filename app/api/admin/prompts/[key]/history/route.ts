import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ key: string }>
}

/**
 * GET /api/admin/prompts/[key]/history
 * Get version history for a prompt (admin only)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Get prompt ID
    const { data: prompt, error: promptError } = await supabaseAdmin
      .from('system_prompts')
      .select('id')
      .eq('key', key)
      .single()

    if (promptError || !prompt) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
    }

    // Fetch history (include diagnosis_id for traceability to Error Diagnosis)
    const { data: history, error } = await supabaseAdmin
      .from('system_prompt_history')
      .select('id, prompt_id, version, prompt, config, changed_by, changed_at, change_reason, diagnosis_id')
      .eq('prompt_id', prompt.id)
      .order('version', { ascending: false })

    if (error) {
      console.error('Error fetching prompt history:', error)
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
    }

    return NextResponse.json({ history })
  } catch (error) {
    console.error('Error in GET /api/admin/prompts/[key]/history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/prompts/[key]/history/rollback
 * Rollback to a specific version (admin only)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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
    const { version } = body

    if (!version || typeof version !== 'number') {
      return NextResponse.json(
        { error: 'Version number is required' },
        { status: 400 }
      )
    }

    // Get prompt
    const { data: prompt, error: promptError } = await supabaseAdmin
      .from('system_prompts')
      .select('id')
      .eq('key', key)
      .single()

    if (promptError || !prompt) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
    }

    // Get history version
    const { data: historyVersion, error: historyError } = await supabaseAdmin
      .from('system_prompt_history')
      .select('*')
      .eq('prompt_id', prompt.id)
      .eq('version', version)
      .single()

    if (historyError || !historyVersion) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    // Update prompt with historical version
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('system_prompts')
      .update({
        prompt: historyVersion.prompt,
        config: historyVersion.config,
        updated_by: authResult.user.id,
      })
      .eq('key', key)
      .select()
      .single()

    if (updateError) {
      console.error('Error rolling back prompt:', updateError)
      return NextResponse.json({ error: 'Failed to rollback' }, { status: 500 })
    }

    return NextResponse.json({
      prompt: updated,
      message: `Rolled back to version ${version}`,
    })
  } catch (error) {
    console.error('Error in POST /api/admin/prompts/[key]/history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
