import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/chat-eval/stats
 * Get evaluation statistics
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
    const days = parseInt(searchParams.get('days') || '30')
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - days)

    // Get total sessions count
    const { count: totalSessions } = await supabaseAdmin
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', dateFrom.toISOString())

    // Get evaluated sessions count
    const { count: evaluatedSessions } = await supabaseAdmin
      .from('chat_evaluations')
      .select('*', { count: 'exact', head: true })
      .gte('evaluated_at', dateFrom.toISOString())

    // Get rating breakdown
    const { data: ratingBreakdown } = await supabaseAdmin
      .from('chat_evaluations')
      .select('rating')
      .gte('evaluated_at', dateFrom.toISOString())

    const goodCount = ratingBreakdown?.filter((e: any) => e.rating === 'good').length || 0
    const badCount = ratingBreakdown?.filter((e: any) => e.rating === 'bad').length || 0

    // Calculate success rate
    const totalRated = goodCount + badCount
    const successRate = totalRated > 0 ? Math.round((goodCount / totalRated) * 100) : 0

    // Get category breakdown
    const { data: categoryBreakdown } = await supabaseAdmin
      .from('chat_evaluations')
      .select(`
        category_id,
        evaluation_categories(name, color)
      `)
      .not('category_id', 'is', null)
      .gte('evaluated_at', dateFrom.toISOString())

    // Group by category
    const categoryCounts: Record<string, { name: string; color: string; count: number }> = {}
    categoryBreakdown?.forEach((evaluation: any) => {
      const catId = evaluation.category_id
      const catName = evaluation.evaluation_categories?.name || 'Unknown'
      const catColor = evaluation.evaluation_categories?.color || '#6B7280'
      
      if (!categoryCounts[catId]) {
        categoryCounts[catId] = { name: catName, color: catColor, count: 0 }
      }
      categoryCounts[catId].count++
    })

    // Get channel breakdown from messages metadata
    const { data: sessions } = await supabaseAdmin
      .from('chat_sessions')
      .select(`
        session_id,
        chat_messages(metadata)
      `)
      .gte('created_at', dateFrom.toISOString())

    const channelCounts = { voice: 0, text: 0, email: 0, chatbot: 0 }
    sessions?.forEach((session: any) => {
      const messages = session.chat_messages || []
      const sources = new Set<string>()
      for (const m of messages || []) {
        const source = m.metadata?.source || m.metadata?.channel
        if (source === 'voice') sources.add('voice')
        if (source === 'chatbot' || source === 'text' || !source) sources.add('chatbot')
        if (source === 'sms') sources.add('text')
        if (source === 'email') sources.add('email')
      }
      if (sources.has('voice')) channelCounts.voice++
      if (sources.has('chatbot')) channelCounts.chatbot++
      if (sources.has('text')) channelCounts.text++
      if (sources.has('email')) channelCounts.email++
    })

    // Get LLM judge alignment stats
    const { data: llmAlignmentData } = await supabaseAdmin
      .from('llm_judge_evaluations')
      .select('human_alignment')
      .not('human_alignment', 'is', null)

    const totalAligned = llmAlignmentData?.filter((e: any) => e.human_alignment === true).length || 0
    const totalCompared = llmAlignmentData?.length || 0
    const alignmentRate = totalCompared > 0 
      ? Math.round((totalAligned / totalCompared) * 100) 
      : null

    // Get recent evaluation activity
    const { data: recentEvaluations } = await supabaseAdmin
      .from('chat_evaluations')
      .select(`
        session_id,
        rating,
        evaluated_at,
        evaluation_categories(name)
      `)
      .order('evaluated_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      overview: {
        total_sessions: totalSessions || 0,
        evaluated_sessions: evaluatedSessions || 0,
        unevaluated_sessions: (totalSessions || 0) - (evaluatedSessions || 0),
        success_rate: successRate,
        good_count: goodCount,
        bad_count: badCount,
      },
      channels: channelCounts,
      categories: Object.values(categoryCounts).sort((a, b) => b.count - a.count),
      llm_alignment: {
        total_compared: totalCompared,
        aligned_count: totalAligned,
        alignment_rate: alignmentRate,
      },
      recent_evaluations: recentEvaluations?.map((e: any) => ({
        session_id: e.session_id,
        rating: e.rating,
        category: e.evaluation_categories?.name,
        evaluated_at: e.evaluated_at,
      })) || [],
      period_days: days,
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
