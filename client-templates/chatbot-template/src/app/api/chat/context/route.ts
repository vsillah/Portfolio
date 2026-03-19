import { NextRequest, NextResponse } from 'next/server'
import { fetchConversationContext } from '@/lib/chat-context'

export const dynamic = 'force-dynamic'

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
