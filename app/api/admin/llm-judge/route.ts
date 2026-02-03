import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { 
  evaluateConversation, 
  AVAILABLE_MODELS,
  DEFAULT_JUDGE_CONFIG,
  type ChatMessageForJudge, 
  type JudgeContext,
  type JudgeConfig,
  type LLMProvider
} from '@/lib/llm-judge'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/llm-judge
 * Trigger LLM evaluation for a session
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
    const { session_id, provider, model, prompt_version } = body

    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      )
    }

    // Validate provider and model
    const selectedProvider: LLMProvider = provider === 'openai' ? 'openai' : 'anthropic'
    const availableModels = AVAILABLE_MODELS[selectedProvider]
    const selectedModel = model && availableModels.some((m: any) => m.id === model) 
      ? model 
      : availableModels[0].id

    // Fetch session with messages
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
      .eq('session_id', session_id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Sort messages by created_at
    const messages = (session.chat_messages || []).sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'Session has no messages to evaluate' },
        { status: 400 }
      )
    }

    // Prepare messages for judge
    const messagesForJudge: ChatMessageForJudge[] = messages.map((m: any) => ({
      role: m.role,
      content: m.content,
      timestamp: m.created_at,
      metadata: m.metadata?.isToolCall ? {
        isToolCall: true,
        toolCall: m.metadata.toolCall,
      } : undefined,
    }))

    // Determine channel
    const hasVoice = messages.some((m: any) => 
      m.metadata?.source === 'voice' || m.metadata?.channel === 'voice'
    )

    // Build context
    const context: JudgeContext = {
      visitorName: session.visitor_name,
      visitorEmail: session.visitor_email,
      isEscalated: session.is_escalated,
      channel: hasVoice ? 'voice' : 'text',
      totalMessages: messages.length,
    }

    // Configure judge with selected provider and model
    const config: JudgeConfig = {
      provider: selectedProvider,
      model: selectedModel,
      promptVersion: prompt_version || 'v1',
      temperature: 0.3,
    }

    // Run evaluation
    const evaluation = await evaluateConversation(messagesForJudge, context, config)

    // Save evaluation to database
    const { data: savedEval, error: saveError } = await supabaseAdmin
      .from('llm_judge_evaluations')
      .upsert({
        session_id,
        rating: evaluation.rating,
        reasoning: evaluation.reasoning,
        confidence_score: evaluation.confidence,
        identified_categories: evaluation.categories,
        model_used: config.model,
        prompt_version: config.promptVersion,
        evaluated_at: new Date().toISOString(),
      }, {
        onConflict: 'session_id,message_id,model_used,prompt_version',
      })
      .select()
      .single()

    if (saveError) {
      console.error('Error saving LLM evaluation:', saveError)
      // Still return the evaluation even if save fails
    }

    return NextResponse.json({
      success: true,
      evaluation: {
        id: savedEval?.id,
        session_id,
        rating: evaluation.rating,
        reasoning: evaluation.reasoning,
        confidence: evaluation.confidence,
        categories: evaluation.categories,
        suggestions: evaluation.suggestions,
        provider: config.provider,
        model: config.model,
        prompt_version: config.promptVersion,
      },
    })
  } catch (error) {
    console.error('LLM Judge API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/llm-judge
 * Get LLM evaluations for a session, list recent evaluations, or get available models
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
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')
    const getModels = searchParams.get('models')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Return available models for the UI
    if (getModels === 'true') {
      return NextResponse.json({
        available_models: AVAILABLE_MODELS,
        default_config: DEFAULT_JUDGE_CONFIG,
      })
    }

    if (sessionId) {
      // Get evaluations for specific session
      const { data: evaluations, error } = await supabaseAdmin
        .from('llm_judge_evaluations')
        .select('*')
        .eq('session_id', sessionId)
        .order('evaluated_at', { ascending: false })

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch evaluations' },
          { status: 500 }
        )
      }

      return NextResponse.json({ evaluations })
    }

    // Get recent evaluations
    const { data: evaluations, error } = await supabaseAdmin
      .from('llm_judge_evaluations')
      .select(`
        *,
        chat_sessions(visitor_name, visitor_email)
      `)
      .order('evaluated_at', { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch evaluations' },
        { status: 500 }
      )
    }

    return NextResponse.json({ evaluations })
  } catch (error) {
    console.error('Error fetching LLM evaluations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
