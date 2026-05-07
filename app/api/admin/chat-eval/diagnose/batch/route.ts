import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { diagnoseError, DEFAULT_JUDGE_CONFIG, AVAILABLE_MODELS, LlmJudgeBudgetError, LLMProvider, type SessionData, type EvaluationData } from '@/lib/llm-judge'
import { getChatbotPrompt, getVoiceAgentPrompt } from '@/lib/system-prompts'
import { endAgentRun, markAgentRunFailed, recordAgentStep, startAgentRun } from '@/lib/agent-run'

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

  let agentRunId: string | null = null

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }
    if (!body || typeof body !== 'object' || !('session_ids' in body)) {
      return NextResponse.json(
        { error: 'session_ids array is required' },
        { status: 400 }
      )
    }
    const { session_ids, provider, model } = body as { session_ids?: unknown; provider?: string; model?: string }

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

    const agentRun = await startAgentRun({
      agentKey: 'manual-admin',
      runtime: 'manual',
      kind: 'chat_eval_diagnosis_batch',
      title: 'Batch diagnose Chat Eval errors',
      subject: {
        type: 'chat_eval_sessions',
        id: session_ids.slice(0, 5).join(','),
        label: `${session_ids.length} session(s)`,
      },
      triggerSource: 'admin:chat_eval_diagnose_batch',
      triggeredByUserId: authResult.user.id,
      currentStep: 'Preparing batch chat error diagnosis',
      metadata: {
        provider: selectedProvider,
        model: selectedModel,
        session_count: session_ids.length,
      },
    })
    agentRunId = agentRun.id

    await recordAgentStep({
      runId: agentRunId,
      stepKey: 'chat_eval_diagnosis_batch_validated',
      name: 'Validated batch diagnosis request',
      status: 'completed',
      outputSummary: `Diagnosing ${session_ids.length} chat session(s).`,
      metadata: {
        provider: selectedProvider,
        model: selectedModel,
        session_count: session_ids.length,
      },
      idempotencyKey: `${agentRunId}:chat_eval_diagnosis_batch_validated`,
    })

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
        const { data: evaluations, error: evalError } = await supabaseAdmin
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

        const hasVoice = messages.some((m: any) => m.metadata?.source === 'voice' || m.metadata?.channel === 'voice')
        const channel: 'voice' | 'text' = hasVoice ? 'voice' : 'text'

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
        const diagnosis = await diagnoseError(sessionData, evaluationData, systemPrompt, config, {
          agentRunId,
          runtime: 'manual',
          reference: { type: 'chat_eval_diagnosis', id: String(sessionId) },
          operation: 'diagnose',
        })

        // Store diagnosis
        const { data: storedDiagnosis, error: storeError } = await supabaseAdmin
          .from('error_diagnoses')
          .insert({
            session_id: sessionId,
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
          error: error instanceof LlmJudgeBudgetError
            ? 'This chat error diagnosis is over the current Agent Ops budget limit. Use a shorter session or lower-cost model before retrying.'
            : error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    if (failureCount === results.length) {
      await markAgentRunFailed(agentRunId, 'All batch chat error diagnoses failed', {
        operation: 'diagnose',
        total: results.length,
        successful: successCount,
        failed: failureCount,
      }).catch(() => {})
    } else {
      await endAgentRun({
        runId: agentRunId,
        status: 'completed',
        currentStep: 'Batch chat error diagnosis complete',
        outcome: {
          total: results.length,
          successful: successCount,
          failed: failureCount,
          provider: selectedProvider,
          model: selectedModel,
        },
      })
    }

    return NextResponse.json({
      agentRunId,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Batch diagnosis error:', error)
    if (agentRunId) {
      await recordAgentStep({
        runId: agentRunId,
        stepKey: 'chat_eval_diagnosis_batch_failed',
        name: 'Batch chat error diagnosis failed',
        status: 'failed',
        outputSummary: errorMessage,
        idempotencyKey: `${agentRunId}:chat_eval_diagnosis_batch_failed`,
      }).catch(() => {})
      await markAgentRunFailed(agentRunId, errorMessage, { operation: 'diagnose_batch' }).catch(() => {})
    }
    return NextResponse.json(
      { error: errorMessage || 'Internal server error' },
      { status: 500 }
    )
  }
}
