import { NextRequest, NextResponse } from 'next/server'
import { ZodError, z } from 'zod'
import { fetchConversationContext } from '@/lib/chat-context'
import { sessionIdParamSchema, zodErrorResponse } from '@/lib/chat-validation'

export const dynamic = 'force-dynamic'

const contextParamsSchema = sessionIdParamSchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

/**
 * Chat Context API
 * 
 * Fetches conversation history from Supabase for context injection into N8N.
 * This enables cross-channel context sharing between text chat and voice chat.
 * 
 * GET /api/chat/context
 * 
 * Query params:
 * - sessionId (required): The chat session ID (UUID)
 * - limit (optional): Max messages to return (default: 20, max: 100)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const params = contextParamsSchema.parse({
      sessionId: searchParams.get('sessionId') || undefined,
      limit: searchParams.get('limit') || undefined,
    })

    const context = await fetchConversationContext(params.sessionId, params.limit)

    if (!context) {
      return NextResponse.json(
        { error: 'Failed to fetch conversation context' },
        { status: 500 }
      )
    }

    return NextResponse.json(context)
  } catch (error) {
    if (error instanceof ZodError) {
      const { error: msg, detail, status } = zodErrorResponse(error)
      return NextResponse.json({ error: msg, detail }, { status })
    }
    console.error('Context API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversation context' },
      { status: 500 }
    )
  }
}
