import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { clearPromptCache } from '@/lib/system-prompts'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/admin/chat-eval/diagnoses/[id]/apply-prompt
 * Auto-apply prompt changes from approved recommendations
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
    const { id } = await params
    const body = await request.json()
    const { recommendation_id, prompt_key, new_prompt } = body

    // Fetch diagnosis
    const { data: diagnosis, error: fetchError } = await supabaseAdmin
      .from('error_diagnoses')
      .select('recommendations, status')
      .eq('id', id)
      .single()

    if (fetchError || !diagnosis) {
      return NextResponse.json(
        { error: 'Diagnosis not found' },
        { status: 404 }
      )
    }

    // Find the recommendation
    const recommendations = diagnosis.recommendations || []
    let recommendation: any = null

    if (recommendation_id) {
      recommendation = recommendations.find((rec: any) => rec.id === recommendation_id)
    } else if (prompt_key) {
      recommendation = recommendations.find((rec: any) => 
        rec.type === 'prompt' && rec.changes?.target === prompt_key
      )
    }

    if (!recommendation || recommendation.type !== 'prompt') {
      return NextResponse.json(
        { error: 'Prompt recommendation not found' },
        { status: 404 }
      )
    }

    // Map LLM output "system_prompt" to actual DB key "chatbot" (portfolio chatbot)
    let targetKey = prompt_key || recommendation.changes.target
    if (targetKey === 'system_prompt') {
      targetKey = 'chatbot'
    }
    const promptValue = new_prompt || recommendation.changes.new_value

    // Update the prompt
    const { data: updatedPrompt, error: updateError } = await supabaseAdmin
      .from('system_prompts')
      .update({
        prompt: promptValue,
        updated_by: authResult.user.id,
      })
      .eq('key', targetKey)
      .select()
      .single()

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return NextResponse.json(
          { error: `Prompt "${targetKey}" not found` },
          { status: 404 }
        )
      }
      console.error('Error updating prompt:', updateError)
      return NextResponse.json(
        { error: 'Failed to update prompt' },
        { status: 500 }
      )
    }

    // Clear cache
    clearPromptCache(targetKey)

    // Record fix application
    await supabaseAdmin
      .from('fix_applications')
      .insert({
        diagnosis_id: id,
        change_type: 'prompt',
        target_identifier: targetKey,
        old_value: recommendation.changes.old_value,
        new_value: promptValue,
        application_method: 'auto',
        applied_by: authResult.user.id,
        verification_status: 'pending',
      })

    return NextResponse.json({
      success: true,
      prompt: updatedPrompt,
      message: `Prompt "${targetKey}" updated successfully`,
    })
  } catch (error) {
    console.error('Apply prompt error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
