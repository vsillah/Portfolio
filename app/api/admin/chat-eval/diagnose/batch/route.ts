import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { diagnoseError, DEFAULT_JUDGE_CONFIG, AVAILABLE_MODELS, LLMProvider, type SessionData, type EvaluationData } from '@/lib/llm-judge'
import { getChatbotPrompt, getVoiceAgentPrompt } from '@/lib/system-prompts'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/chat-eval/diagnose/batch
 * Diagnose multiple errors at once
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
    const { session_ids, provider, model } = body

    if (!session_ids || !Array.isArray(session_ids) || session_ids.length === 0) {
      return NextResponse.json(
        { error: 'session_ids array is required' },
        { status: 400 }
      )
    }

    // Validate provider and model
    const selectedProvider: LLMProvider = provider === 'openai' ? 'openai' : 'anthropic'
    const availableModels = AVAILABLE_MODELS[selectedProvider]
    const selectedModel = model && availableModels.some(m => m.id === model) 
      ? model 
      : DEFAULT_JUDGE_CONFIG.model

    const config = {
      provider: selectedProvider,
      model: selectedModel,
      promptVersion: 'v1',
      temperature: 0.3,
    }

    const results = []

    // Process each session
    for (const sessionId of session_ids) {
      try {
        // Fetch session
        const { data: session, error: sessionError } = await supabaseAdmin
          .from('chat_sessions')
          .select(`
            *,
            chat_messages(
              id,
              role,
              content,
              metadata,
              created_at
            )
          `)
          .eq('session_id', sessionId)
          .single()

        if (sessionError || !session) {
          results.push({
            session_id: sessionId,
            success: false,
            error: 'Session not found',
          })
          continue
        }

        // Fetch bad evaluation
        const { data: evaluations } = await supabaseAdmin
          .from('chat_evaluations')
          .select(`
            *,
            evaluation_categories(id, name, description, color)
          `)
          .eq('session_id', sessionId)
          .eq('rating', 'bad')
          .limit(1)
          .single()

        if (!evaluations) {
          results.push({
            session_id: sessionId,
            success: false,
            error: 'No bad-rated evaluation found',
          })
          continue
        }

        const evaluation = evaluations

        // Prepare data
        const messages = (session.chat_messages || []).sort(
          (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )

        const hasVoice = messages.some((m: any) => 
          m.metadata?.source === 'voice' || m.metadata?.channel === 'voice'
        )
        const channel = hasVoice ? 'voice' : 'text'

        const messagesForDiagnosis = messages.map((m: any) => ({
          role: m.role,
          content: m.content,
          timestamp: m.created_at,
          metadata: m.metadata?.isToolCall ? {
            isToolCall: true,
            toolCall: m.metadata.toolCall,
          } : undefined,
        }))

        const sessionData: SessionData = {
          session_id: session.session_id,
          visitor_name: session.visitor_name,
          visitor_email: session.visitor_email,
          is_escalated: session.is_escalated,
          channel,
          messages: messagesForDiagnosis,
          metadata: session.metadata,
        }

        const evaluationData: EvaluationData = {
          id: evaluation.id,
          rating: 'bad',
          notes: evaluation.notes,
          tags: evaluation.tags,
          category_id: evaluation.category_id,
          open_code: evaluation.open_code,
          category: evaluation.evaluation_categories ? {
            name: evaluation.evaluation_categories.name,
            description: evaluation.evaluation_categories.description,
          } : undefined,
        }

        // Get system prompt
        let systemPrompt: string | undefined
        try {
          if (channel === 'voice') {
            systemPrompt = await getVoiceAgentPrompt()
          } else {
            systemPrompt = await getChatbotPrompt()
          }
        } catch (error) {
          // Continue without system prompt
        }

        // Run diagnosis
        const diagnosis = await diagnoseError(sessionData, evaluationData, systemPrompt, config)

        // Store diagnosis
        const { data: storedDiagnosis, error: storeError } = await supabaseAdmin
          .from('error_diagnoses')
          .insert({
            session_id,
            evaluation_id: evaluation.id,
            root_cause: diagnosis.root_cause,
            error_type: diagnosis.error_type,
            confidence_score: diagnosis.confidence,
            diagnosis_details: diagnosis.diagnosis_details,
            recommendations: diagnosis.recommendations,
            status: 'pending',
            diagnosed_by: authResult.user.id,
            model_used: selectedModel,
            prompt_version: 'v1',
          })
          .select()
          .single()

        if (storeError) {
          results.push({
            session_id: sessionId,
            success: false,
            error: 'Failed to store diagnosis',
          })
          continue
        }

        results.push({
          session_id: sessionId,
          success: true,
          diagnosis_id: storedDiagnosis.id,
        })
      } catch (error) {
        results.push({
          session_id: sessionId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    return NextResponse.json({
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
      },
    })
  } catch (error) {
    console.error('Batch diagnosis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
