import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { calculateAlignment } from '@/lib/llm-judge'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/llm-judge/alignment
 * Get human-LLM alignment statistics
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
    const model = searchParams.get('model')
    
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - days)

    // Fetch human evaluations first to see what we have
    const { data: humanEvals, error: humanError } = await supabaseAdmin
      .from('chat_evaluations')
      .select('id, session_id, rating, evaluated_at')
      .not('rating', 'is', null)
      .gte('evaluated_at', dateFrom.toISOString())

    // Fetch LLM evaluations (all, not just linked ones)
    let llmQuery = supabaseAdmin
      .from('llm_judge_evaluations')
      .select(`
        id,
        session_id,
        rating,
        confidence_score,
        model_used,
        prompt_version,
        human_evaluation_id,
        human_alignment,
        evaluated_at
      `)
      .gte('evaluated_at', dateFrom.toISOString())

    if (model) {
      llmQuery = llmQuery.eq('model_used', model)
    }

    const { data: llmEvals, error: llmError } = await llmQuery

    if (humanError || llmError) {
      console.error('Error fetching alignment data:', humanError || llmError)
      return NextResponse.json(
        { error: 'Failed to fetch alignment data' },
        { status: 500 }
      )
    }

    // Match human and LLM evaluations by session_id
    const humanEvalMap = new Map((humanEvals || []).map((h: any) => [h.session_id, h]))
    const evaluations: any[] = []

    // For each LLM evaluation, find matching human evaluation
    for (const llmEval of llmEvals || []) {
      const humanEval = humanEvalMap.get(llmEval.session_id) as { id: string; session_id: string; rating: 'good' | 'bad'; evaluated_at: string } | undefined
      if (humanEval) {
        // Link them if not already linked
        if (!llmEval.human_evaluation_id) {
          const alignment = llmEval.rating === humanEval.rating
          await supabaseAdmin
            .from('llm_judge_evaluations')
            .update({
              human_evaluation_id: humanEval.id,
              human_alignment: alignment,
            })
            .eq('id', llmEval.id)
        }
        
        evaluations.push({
          ...llmEval,
          chat_evaluations: { rating: humanEval.rating },
          human_alignment: llmEval.human_alignment ?? (llmEval.rating === humanEval.rating),
        })
      }
    }

    // Prepare data for alignment calculation
    const alignmentData = evaluations?.map((eval_: any) => ({
      humanRating: eval_.chat_evaluations?.rating as 'good' | 'bad',
      llmRating: eval_.rating as 'good' | 'bad',
    })).filter((e: any) => e.humanRating && e.llmRating) || []

    // Calculate alignment
    const alignment = calculateAlignment(alignmentData)

    // Get alignment by model
    const modelStats: Record<string, { total: number; aligned: number; rate: number }> = {}
    evaluations?.forEach((eval_: any) => {
      const model = eval_.model_used
      if (!modelStats[model]) {
        modelStats[model] = { total: 0, aligned: 0, rate: 0 }
      }
      modelStats[model].total++
      if (eval_.human_alignment === true) {
        modelStats[model].aligned++
      }
    })
    
    // Calculate rates
    Object.keys(modelStats).forEach((model: string) => {
      const stats = modelStats[model]
      stats.rate = stats.total > 0 ? Math.round((stats.aligned / stats.total) * 100) : 0
    })

    // Get disagreement cases
    const disagreements = evaluations?.filter((eval_: any) => 
      eval_.human_alignment === false
    ).map((eval_: any) => ({
      session_id: eval_.session_id,
      llm_rating: eval_.rating,
      human_rating: eval_.chat_evaluations?.rating,
      confidence: eval_.confidence_score,
      model: eval_.model_used,
      evaluated_at: eval_.evaluated_at,
    })) || []

    // Get confidence distribution for aligned vs misaligned
    const alignedConfidences = evaluations?.filter((e: any) => e.human_alignment === true)
      .map((e: any) => e.confidence_score).filter((c: any) => c !== null) || []
    const misalignedConfidences = evaluations?.filter((e: any) => e.human_alignment === false)
      .map((e: any) => e.confidence_score).filter((c: any) => c !== null) || []

    const avgAlignedConfidence = alignedConfidences.length > 0
      ? alignedConfidences.reduce((a: number, b: number) => a + b, 0) / alignedConfidences.length
      : null
    const avgMisalignedConfidence = misalignedConfidences.length > 0
      ? misalignedConfidences.reduce((a: number, b: number) => a + b, 0) / misalignedConfidences.length
      : null

    const result = {
      overall: alignment,
      by_model: modelStats,
      disagreements: disagreements.slice(0, 20), // Limit to 20 most recent
      confidence_analysis: {
        avg_aligned_confidence: avgAlignedConfidence,
        avg_misaligned_confidence: avgMisalignedConfidence,
      },
      period_days: days,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error calculating alignment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/llm-judge/alignment
 * Manually update alignment for an LLM evaluation
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
    const { llm_evaluation_id, human_evaluation_id, aligned } = body

    if (!llm_evaluation_id) {
      return NextResponse.json(
        { error: 'llm_evaluation_id is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('llm_judge_evaluations')
      .update({
        human_evaluation_id: human_evaluation_id || null,
        human_alignment: typeof aligned === 'boolean' ? aligned : null,
      })
      .eq('id', llm_evaluation_id)

    if (error) {
      console.error('Error updating alignment:', error)
      return NextResponse.json(
        { error: 'Failed to update alignment' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating alignment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
