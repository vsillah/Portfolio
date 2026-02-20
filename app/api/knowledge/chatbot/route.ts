import { NextResponse } from 'next/server'
import { getChatbotKnowledgeBody } from '@/lib/chatbot-knowledge'

export const dynamic = 'force-dynamic'

/**
 * GET /api/knowledge/chatbot
 * Same as GET /api/knowledge (concatenated repo docs for chatbot).
 * Kept for backwards compatibility; n8n and docs can use either URL.
 */
export async function GET() {
  try {
    const result = await getChatbotKnowledgeBody()
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return new NextResponse(result.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Error in GET /api/knowledge/chatbot:', error)
    return NextResponse.json(
      { error: 'Failed to load chatbot knowledge' },
      { status: 500 }
    )
  }
}
