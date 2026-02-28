import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { diagnoseError, DEFAULT_JUDGE_CONFIG, AVAILABLE_MODELS, LLMProvider, type SessionData, type EvaluationData } from '@/lib/llm-judge'
import { getChatbotPrompt, getVoiceAgentPrompt } from '@/lib/system-prompts'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/chat-eval/diagnose
 * Diagnose a single error in a chat session
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
    const { session_id, evaluation_id, provider, model } = body

    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      )
    }

    // Validate provider and model
    const selectedProvider: LLMProvider = provider === 'openai' ? 'openai' : 'anthropic'
    const availableModels = AVAILABLE_MODELS[selectedProvider]
    const selectedModel = model && availableModels.some(m => m.id === model) 
      ? model 
      : DEFAULT_JUDGE_CONFIG.model

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

    // Fetch evaluation (must be bad rating)
    let evaluationQuery = supabaseAdmin
      .from('chat_evaluations')
      .select(`
        *,
        evaluation_categories(id, name, description, color)
      `)
      .eq('session_id', session_id)
      .eq('rating', 'bad')

    if (evaluation_id) {
      evaluationQuery = evaluationQuery.eq('id', evaluation_id)
    }

    const { data: evaluations, error: evalError } = await evaluationQuery

    if (evalError || !evaluations || evaluations.length === 0) {
      return NextResponse.json(
        { error: 'No bad-rated evaluation found for this session' },
        { status: 404 }
      )
    }

    const evaluation = evaluations[0]

    // Sort messages by created_at
    const messages = (session.chat_messages || []).sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    // Determine primary channel (voice = website voice; non-voice uses chatbot prompt)
    const hasVoice = messages.some((m: any) => m.metadata?.source === 'voice' || m.metadata?.channel === 'voice')
    const hasChatbot = messages.some((m: any) => {
      const s = m.metadata?.source || m.metadata?.channel
      return s === 'chatbot' || s === 'text' || !s
    })
    const hasText = messages.some((m: any) => (m.metadata?.source || m.metadata?.channel) === 'sms')
    const hasEmail = messages.some((m: any) => (m.metadata?.source || m.metadata?.channel) === 'email')
    const channel = hasVoice ? 'voice' : hasChatbot ? 'chatbot' : hasText ? 'text' : hasEmail ? 'email' : 'chatbot'

    // Prepare messages for diagnosis
    const messagesForDiagnosis = messages.map((m: any) => ({
      role: m.role,
      content: m.content,
      timestamp: m.created_at,
      metadata: m.metadata?.isToolCall ? {
        isToolCall: true,
        toolCall: m.metadata.toolCall,
      } : undefined,
    }))

    // Prepare session data (SessionData.channel is 'voice' | 'text'; map others to 'text')
    const sessionData: SessionData = {
      session_id: session.session_id,
      visitor_name: session.visitor_name,
      visitor_email: session.visitor_email,
      is_escalated: session.is_escalated,
      channel: channel === 'voice' ? 'voice' : 'text',
      messages: messagesForDiagnosis,
      metadata: session.metadata,
    }

    // Prepare evaluation data
    const evaluationData: EvaluationData = {
      id: evaluation.id,
      rating: 'bad',
      notes: evaluation.notes,
      tags: evaluation.tags,
      category_id: evaluation.category_id,
      open_code: evaluation.open_code,
      category: evaluation.evaluation_categories ? {
        name: evaluation.evaluation_categories.name,
        description: evaluation.evaluation_categories.description,} : undefined,
    }

    // Get system prompt for context
    let systemPrompt: string | undefined
    try {
      if (channel === 'voice') {
        systemPrompt = await getVoiceAgentPrompt()
      } else {
        systemPrompt = await getChatbotPrompt() }
    } catch (error) {
      console.error('Error fetching system prompt for diagnosis:', error)
      // Continue without system prompt
    }

    // Run diagnosis
    const config = {
      provider: selectedProvider,
      model: selectedModel,
      promptVersion: 'v1',
      temperature: 0.3,
    }

    const diagnosis = await diagnoseError(sessionData, evaluationData, systemPrompt, config)

    // Store diagnosis in database
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
      console.error('Error storing diagnosis:', storeError)
      return NextResponse.json(
        { error: 'Failed to store diagnosis' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      diagnosis_id: storedDiagnosis.id,
      diagnosis: {
        root_cause: diagnosis.root_cause,
        error_type: diagnosis.error_type,
        confidence: diagnosis.confidence,
        diagnosis_details: diagnosis.diagnosis_details,
        recommendations: diagnosis.recommendations,
      },
    })
  } catch (error) {
    console.error('Error diagnosis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
