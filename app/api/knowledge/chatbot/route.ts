import { NextRequest, NextResponse } from 'next/server'
import { getChatbotKnowledgeBody, getChatbotKnowledgeBundle } from '@/lib/chatbot-knowledge'

export const dynamic = 'force-dynamic'

/**
 * GET /api/knowledge/chatbot
 * Same as GET /api/knowledge (concatenated repo docs for chatbot).
 * Kept for backwards compatibility; n8n and docs can use either URL.
 */
export async function GET(request: NextRequest) {
  try {
    const format = request.nextUrl.searchParams.get('format')
    const includeOpenBrain = request.nextUrl.searchParams.get('include_open_brain') === 'true'
    if (format === 'json') {
      const bundle = await getChatbotKnowledgeBundle({ includeOpenBrainRagProjection: includeOpenBrain })
      if ('error' in bundle) {
        return NextResponse.json({ error: bundle.error }, { status: bundle.status })
      }
      return NextResponse.json(bundle)
    }

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
