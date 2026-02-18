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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/chat-eval/diagnose/batch/route.ts:try-entry',message:'Batch handler entered',data:{},hypothesisId:'H2',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/chat-eval/diagnose/batch/route.ts:start',message:'Batch diagnose start',data:{sessionIdsCount:session_ids.length,sessionIds:session_ids.slice(0,3)},hypothesisId:'H2',timestamp:Date.now()})}).catch(()=>{});
    // #endregion

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
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/chat-eval/diagnose/batch/route.ts:session-miss',message:'Session not found',data:{sessionId},hypothesisId:'H2',timestamp:Date.now()})}).catch(()=>{});
          // #endregion
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
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/chat-eval/diagnose/batch/route.ts:no-bad-eval',message:'No bad-rated evaluation',data:{sessionId,evalErrorCode:evalError?.code,evalErrorMsg:evalError?.message},hypothesisId:'H2',timestamp:Date.now()})}).catch(()=>{});
          // #endregion
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
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/chat-eval/diagnose/batch/route.ts:store-error',message:'Store diagnosis failed',data:{sessionId,storeError:storeError.message},hypothesisId:'H4',timestamp:Date.now()})}).catch(()=>{});
          // #endregion
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
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/chat-eval/diagnose/batch/route.ts:catch',message:'Batch session error',data:{sessionId,errorMsg:error instanceof Error ? error.message : String(error)},hypothesisId:'H3',timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        results.push({
          session_id: sessionId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/chat-eval/diagnose/batch/route.ts:done',message:'Batch diagnose done',data:{successCount,failureCount,results:results.map(r=>({session_id:r.session_id,success:r.success,error:(r as any).error}))},hypothesisId:'H4',timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    return NextResponse.json({
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/chat-eval/diagnose/batch/route.ts:catch',message:'Batch diagnosis error',data:{errorMsg:errorMessage},hypothesisId:'H3',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    console.error('Batch diagnosis error:', error)
    return NextResponse.json(
      { error: errorMessage || 'Internal server error' },
      { status: 500 }
    )
  }
}
