import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ key: string }>
}

/**
 * GET /api/prompts/[key]
 * Public endpoint to fetch an active system prompt
 * Used by chat, voice agent, and LLM judge
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { key } = await params

    // Only return active prompts for public access
    const { data: prompt, error } = await supabaseAdmin
      .from('system_prompts')
      .select('id, key, name, prompt, config, version')
      .eq('key', key)
      .eq('is_active', true)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
      }
      console.error('Error fetching prompt:', error)
      return NextResponse.json({ error: 'Failed to fetch prompt' }, { status: 500 })
    }

    return NextResponse.json({ prompt })
  } catch (error) {
    console.error('Error in GET /api/prompts/[key]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
