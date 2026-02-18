import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { clearPromptCache } from '@/lib/system-prompts'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/admin/chat-eval/diagnoses/[id]/apply
 * Apply approved fixes (routes to prompt or code apply based on recommendation type)
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
    const { recommendation_ids, auto_apply = true } = body

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

    if (diagnosis.status !== 'approved') {
      return NextResponse.json(
        { error: 'Diagnosis must be approved before applying fixes' },
        { status: 400 }
      )
    }

    const recommendations = diagnosis.recommendations || []
    
    // Filter recommendations if specific IDs provided
    const recommendationsToApply = recommendation_ids && Array.isArray(recommendation_ids)
      ? recommendations.filter((rec: any) => recommendation_ids.includes(rec.id))
      : recommendations.filter((rec: any) => rec.approved !== false)

    if (recommendationsToApply.length === 0) {
      return NextResponse.json(
        { error: 'No recommendations to apply' },
        { status: 400 }
      )
    }

    // Separate prompt and code recommendations
    const promptRecommendations = recommendationsToApply.filter((rec: any) => rec.type === 'prompt')
    const codeRecommendations = recommendationsToApply.filter((rec: any) => rec.type === 'code')

    const applied: Array<{
      recommendation_id: string
      status: string
      method: string
      changes?: any
    }> = []

    const instructions: Array<{
      recommendation_id: string
      instructions: string
    }> = []

    // Apply prompt changes
    for (const rec of promptRecommendations) {
      try {
        if (rec.changes?.can_auto_apply && auto_apply) {
          // Auto-apply prompt change directly via database
          // Map LLM output "system_prompt" to actual DB key "chatbot" (portfolio chatbot)
          let promptKey = rec.changes.target
          if (promptKey === 'system_prompt') {
            promptKey = 'chatbot'
          }
          const newPrompt = rec.changes.new_value

          const { data: updatedPrompt, error: updateError } = await supabaseAdmin
            .from('system_prompts')
            .update({
              prompt: newPrompt,
              updated_by: authResult.user.id,
            })
            .eq('key', promptKey)
            .select('id, version')
            .single()

          if (!updateError && updatedPrompt) {
            // Tie the new history row (just created by trigger) to this diagnosis
            await supabaseAdmin
              .from('system_prompt_history')
              .update({
                diagnosis_id: id,
                change_reason: 'Applied from Error Diagnosis',
              })
              .eq('prompt_id', updatedPrompt.id)
              .eq('version', updatedPrompt.version - 1)

            // Clear cache
            clearPromptCache(promptKey)

            // Record fix application
            await supabaseAdmin
              .from('fix_applications')
              .insert({
                diagnosis_id: id,
                change_type: 'prompt',
                target_identifier: promptKey,
                old_value: rec.changes.old_value,
                new_value: newPrompt,
                application_method: 'auto',
                applied_by: authResult.user.id,
              })

            applied.push({
              recommendation_id: rec.id || 'unknown',
              status: 'applied',
              method: 'auto',
              changes: {
                target: promptKey,
                old_value: rec.changes.old_value,
                new_value: newPrompt,
              },
            })
          } else {
            instructions.push({
              recommendation_id: rec.id || 'unknown',
              instructions: rec.application_instructions || `Failed to auto-apply. Please update prompt "${promptKey}" manually.`,
            })
          }
        } else {
          instructions.push({
            recommendation_id: rec.id || 'unknown',
            instructions: rec.application_instructions || `Update prompt "${rec.changes.target}" with: ${rec.changes.new_value}`,
          })
        }
      } catch (error) {
        instructions.push({
          recommendation_id: rec.id || 'unknown',
          instructions: rec.application_instructions || `Error applying prompt change: ${error}`,
        })
      }
    }

    // Handle code recommendations
    for (const rec of codeRecommendations) {
      if (rec.changes?.can_auto_apply && auto_apply) {
        // For code, we'll generate instructions unless it's a simple config change
        instructions.push({
          recommendation_id: rec.id || 'unknown',
          instructions: rec.application_instructions || `Code change required for "${rec.changes.target}". See recommendation details.`,
        })
      } else {
        instructions.push({
          recommendation_id: rec.id || 'unknown',
          instructions: rec.application_instructions || `Manual code change required for "${rec.changes.target}": ${rec.description}`,
        })
      }
    }

    // Update diagnosis status
    const applicationMethod = applied.length > 0 && instructions.length > 0
      ? 'partial'
      : applied.length > 0
      ? 'auto'
      : 'manual'

    await supabaseAdmin
      .from('error_diagnoses')
      .update({
        status: 'applied',
        applied_changes: {
          applied: applied.map(a => a.recommendation_id),
          instructions: instructions.map(i => i.recommendation_id),
        },
        application_method: applicationMethod,
        application_instructions: instructions.length > 0
          ? instructions.map(i => `${i.recommendation_id}: ${i.instructions}`).join('\n\n')
          : null,
        applied_by: authResult.user.id,
        applied_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({
      applied,
      instructions,
      summary: {
        total: recommendationsToApply.length,
        auto_applied: applied.length,
        requires_manual: instructions.length,
      },
    })
  } catch (error) {
    console.error('Apply fixes error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
