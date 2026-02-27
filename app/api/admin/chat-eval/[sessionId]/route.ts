import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/chat-eval/[sessionId]
 * Get detailed session data for evaluation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  // Verify admin access
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  const { sessionId } = params

  try {
    // Fetch session with all messages and evaluation
    // IMPORTANT: Use explicit FK-qualified embeds to prevent PostgREST ambiguity.
    // chat_evaluations has FKs to BOTH chat_sessions (session_id) AND chat_messages (message_id).
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('chat_sessions')
      .select(`
        *,
        chat_evaluations!chat_evaluations_session_id_fkey(
          id,
          rating,
          notes,
          tags,
          category_id,
          open_code,
          evaluated_by,
          evaluated_at,
          evaluation_categories(id, name, description, color)
        ),
        chat_messages!chat_messages_session_id_fkey(
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
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Fetch LLM judge evaluations for this session
    const { data: llmEvaluations } = await supabaseAdmin
      .from('llm_judge_evaluations')
      .select('*')
      .eq('session_id', sessionId)
      .order('evaluated_at', { ascending: false })

    // Sort messages by created_at
    const messages = (session.chat_messages || []).sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    // Determine primary channel: voice (website) > chatbot (website chat) > text (SMS) > email
    const hasVoice = messages.some((m: any) => m.metadata?.source === 'voice' || m.metadata?.channel === 'voice')
    const hasChatbot = messages.some((m: any) => {
      const s = m.metadata?.source || m.metadata?.channel
      return s === 'chatbot' || s === 'text' || !s
    })
    const hasText = messages.some((m: any) => (m.metadata?.source || m.metadata?.channel) === 'sms')
    const hasEmail = messages.some((m: any) => (m.metadata?.source || m.metadata?.channel) === 'email')
    const channel = hasVoice ? 'voice' : hasChatbot ? 'chatbot' : hasText ? 'text' : hasEmail ? 'email' : 'chatbot'

    // Extract tool calls from messages
    const toolCalls = messages
      .filter((m: any) => m.metadata?.isToolCall || m.metadata?.toolCall)
      .map((m: any) => ({
        message_id: m.id,
        timestamp: m.created_at,
        ...m.metadata?.toolCall,
      }))

    // Calculate session metrics
    const sessionMeta = session.metadata || {}
    const userMessages = messages.filter((m: any) => m.role === 'user')
    const assistantMessages = messages.filter((m: any) => m.role === 'assistant')
    
    // Calculate average latency from assistant messages
    const latencies = assistantMessages
      .map((m: any) => m.metadata?.latency_ms)
      .filter((l: any) => typeof l === 'number')
    const avgLatency = latencies.length > 0 
      ? Math.round(latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length)
      : null

    // Build response
    const response = {
      id: session.id,
      session_id: session.session_id,
      visitor_name: session.visitor_name,
      visitor_email: session.visitor_email,
      is_escalated: session.is_escalated,
      created_at: session.created_at,
      updated_at: session.updated_at,
      
      // Channel info
      channel,
      
      // Messages
      messages: messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.created_at,
        metadata: {
          source: m.metadata?.source || m.metadata?.channel,
          latency_ms: m.metadata?.latency_ms,
          isToolCall: m.metadata?.isToolCall,
          toolCall: m.metadata?.toolCall,
          escalated: m.metadata?.escalated,
          diagnosticMode: m.metadata?.diagnosticMode,
        },
      })),
      
      // Tool calls extracted
      tool_calls: toolCalls,
      
      // Session metrics
      metrics: {
        message_count: messages.length,
        user_message_count: userMessages.length,
        assistant_message_count: assistantMessages.length,
        tool_call_count: toolCalls.length,
        avg_latency_ms: avgLatency,
        has_escalation: session.is_escalated,
      },
      
      // Voice-specific metadata
      voice_data: channel === 'voice' ? {
        vapi_call_id: sessionMeta.vapiCallId,
        recording_url: sessionMeta.recordingUrl,
        duration_seconds: sessionMeta.durationSeconds,
        started_at: sessionMeta.startedAt,
        ended_at: sessionMeta.endedAt,
        ended_reason: sessionMeta.endedReason,
        summary: sessionMeta.summary,
        full_transcript: sessionMeta.transcript,
      } : null,
      
      // Human evaluation
      evaluation: session.chat_evaluations?.[0] || null,
      
      // LLM judge evaluations
      llm_evaluations: llmEvaluations || [],
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/chat-eval/[sessionId]
 * Update evaluation for a session
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  // Verify admin access
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  const { sessionId } = params

  try {
    const body = await request.json()
    const { rating, notes, tags, category_id, open_code, message_id } = body

    // Validate rating
    if (rating && !['good', 'bad'].includes(rating)) {
      return NextResponse.json(
        { error: 'Rating must be "good" or "bad"' },
        { status: 400 }
      )
    }

    // Check if session exists
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('chat_sessions')
      .select('id')
      .eq('session_id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Upsert evaluation
    const evaluationData = {
      session_id: sessionId,
      message_id: message_id || null,
      rating,
      notes,
      tags: tags || [],
      category_id: category_id || null,
      open_code: open_code || null,
      evaluated_by: authResult.user.id,
      evaluated_at: new Date().toISOString(),
    }

    const { data: evaluation, error: evalError } = await supabaseAdmin
      .from('chat_evaluations')
      .upsert(evaluationData, {
        onConflict: 'session_id,message_id',
      })
      .select(`
        *,
        evaluation_categories(id, name, color)
      `)
      .single()

    if (evalError) {
      console.error('Error saving evaluation:', evalError)
      return NextResponse.json(
        { error: 'Failed to save evaluation' },
        { status: 500 }
      )
    }

    // If open_code is new, add it to open_codes table
    if (open_code) {
      await supabaseAdmin
        .from('open_codes')
        .upsert({
          code: open_code,
          created_by: authResult.user.id,
        }, {
          onConflict: 'code',
        })
        .then(() => {
          // Increment usage count
          return supabaseAdmin.rpc('increment_open_code_usage', { code_text: open_code })
        })
        .catch((err: unknown) => console.error('Error tracking open code:', err))
    }

    return NextResponse.json({
      success: true,
      evaluation: {
        ...evaluation,
        category_name: evaluation.evaluation_categories?.name,
        category_color: evaluation.evaluation_categories?.color,
      },
    })
  } catch (error) {
    console.error('Error updating evaluation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/chat-eval/[sessionId]
 * Delete the chat session and all related data (messages, evaluations, etc.) via DB cascade.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  const { sessionId } = params
  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
  }

  try {
    const { error } = await supabaseAdmin
      .from('chat_sessions')
      .delete()
      .eq('session_id', sessionId)

    if (error) {
      console.error('Error deleting session:', error)
      return NextResponse.json(
        { error: 'Failed to delete session' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
