import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/chat-eval
 * List chat sessions with filtering for evaluation
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
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit
    
    // Filters
    const channel = searchParams.get('channel') // 'text', 'voice', 'email', 'chatbot'
    const rating = searchParams.get('rating') // 'good', 'bad', 'unrated'
    const annotated = searchParams.get('annotated') // 'true', 'false'
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const search = searchParams.get('search')

    // Build the query using the view
    // IMPORTANT: Use explicit FK-qualified embeds to prevent PostgREST ambiguity.
    // chat_evaluations has FKs to BOTH chat_sessions (session_id) AND chat_messages (message_id),
    // so PostgREST can't auto-resolve which path to use when chat_messages is also embedded.
    let query = supabaseAdmin
      .from('chat_sessions')
      .select(`
        *,
        chat_evaluations!chat_evaluations_session_id_fkey(
          id,
          rating,
          notes,
          category_id,
          open_code,
          evaluated_at,
          evaluation_categories(name, color)
        ),
        chat_messages!chat_messages_session_id_fkey(
          id,
          role,
          content,
          metadata,
          created_at
        )
      `, { count: 'exact' })

    // Apply date filters
    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo)
    }

    // Apply search filter
    if (search) {
      query = query.or(`session_id.ilike.%${search}%,visitor_email.ilike.%${search}%,visitor_name.ilike.%${search}%`)
    }

    // Order by most recent first
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: sessions, error, count } = await query

    if (error) {
      console.error('Error fetching sessions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      )
    }

    // Post-process to apply channel and rating filters (can't filter on metadata in query)
    let filteredSessions = sessions || []

    // Filter by channel (derived from message metadata)
    if (channel) {
      filteredSessions = filteredSessions.filter((session: any) => {
        const messages = session.chat_messages || []
        const hasChannelMessages = messages.some((msg: any) => {
          const source = msg.metadata?.source || msg.metadata?.channel
          if (channel === 'voice') return source === 'voice'
          if (channel === 'text') return source === 'text' || !source
          if (channel === 'email') return source === 'email'
          if (channel === 'chatbot') return source === 'chatbot'
          return true
        })
        return hasChannelMessages
      })
    }

    // Filter by rating/annotation status
    if (rating === 'good') {
      filteredSessions = filteredSessions.filter((s: any) => 
        s.chat_evaluations?.[0]?.rating === 'good'
      )
    } else if (rating === 'bad') {
      filteredSessions = filteredSessions.filter((s: any) => 
        s.chat_evaluations?.[0]?.rating === 'bad'
      )
    } else if (rating === 'unrated' || annotated === 'false') {
      filteredSessions = filteredSessions.filter((s: any) => 
        !s.chat_evaluations?.[0]?.rating
      )
    } else if (annotated === 'true') {
      filteredSessions = filteredSessions.filter((s: any) => 
        s.chat_evaluations?.[0]?.rating
      )
    }

    // Transform sessions for response
    const transformedSessions = filteredSessions.map((session: any) => {
      const messages = session.chat_messages || []
      const evaluation = session.chat_evaluations?.[0]
      
      // Determine channel from messages
      const hasVoice = messages.some((m: any) => m.metadata?.source === 'voice' || m.metadata?.channel === 'voice')
      const derivedChannel = hasVoice ? 'voice' : 'text'
      
      // Get message count by role
      const userMessages = messages.filter((m: any) => m.role === 'user').length
      const assistantMessages = messages.filter((m: any) => m.role === 'assistant').length
      
      // Get session metadata
      const sessionMeta = session.metadata || {}
      
      return {
        id: session.id,
        session_id: session.session_id,
        visitor_name: session.visitor_name,
        visitor_email: session.visitor_email,
        is_escalated: session.is_escalated,
        created_at: session.created_at,
        updated_at: session.updated_at,
        channel: derivedChannel,
        message_count: messages.length,
        user_message_count: userMessages,
        assistant_message_count: assistantMessages,
        // Voice-specific metadata
        recording_url: sessionMeta.recordingUrl,
        call_duration_seconds: sessionMeta.durationSeconds,
        call_summary: sessionMeta.summary,
        ended_reason: sessionMeta.endedReason,
        // Evaluation data
        evaluation: evaluation ? {
          id: evaluation.id,
          rating: evaluation.rating,
          notes: evaluation.notes,
          category_id: evaluation.category_id,
          category_name: evaluation.evaluation_categories?.name,
          category_color: evaluation.evaluation_categories?.color,
          open_code: evaluation.open_code,
          evaluated_at: evaluation.evaluated_at,
        } : null,
      }
    })

    return NextResponse.json({
      sessions: transformedSessions,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Chat eval API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
