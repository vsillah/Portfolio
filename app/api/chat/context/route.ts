import { NextRequest, NextResponse } from 'next/server'
import { fetchConversationContext } from '@/lib/chat-context'

export const dynamic = 'force-dynamic'

/**
 * Chat Context API
 * 
 * Fetches conversation history from Supabase for context injection into N8N.
 * This enables cross-channel context sharing between text chat and voice chat.
 * 
 * GET /api/chat/context
 * 
 * Query params:
 * - sessionId (required): The chat session ID
 * - limit (optional): Max messages to return (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Fetch conversation context using the utility function
    const context = await fetchConversationContext(sessionId, limit)

    if (!context) {
      return NextResponse.json(
        { error: 'Failed to fetch conversation context' },
        { status: 500 }
      )
    }

    return NextResponse.json(context)
  } catch (error) {
    console.error('Context API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversation context' },
      { status: 500 }
    )
  }
}
