import { NextResponse } from 'next/server'
import { getChatbotKnowledgeBody } from '@/lib/chatbot-knowledge'

export const dynamic = 'force-dynamic'

/**
 * GET /api/knowledge
 * Public endpoint that returns concatenated markdown from curated repo docs.
 * Used by the n8n RAG Chatbot workflow so the AI Agent has latest website/process info.
 * Source of truth: repo files (docs/user-help-guide.md, admin-sales-lead-pipeline-sop, README).
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
    console.error('Error in GET /api/knowledge:', error)
    return NextResponse.json(
      { error: 'Failed to load chatbot knowledge' },
      { status: 500 }
    )
  }
}
