import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { generateAxialCodes, DEFAULT_JUDGE_CONFIG, AVAILABLE_MODELS, LLMProvider, AxialCodeResult } from '@/lib/llm-judge'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/chat-eval/axial-codes/generate
 * Generate axial codes from selected sessions with open codes
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
    const { session_ids, provider, model } = body

    if (!session_ids || !Array.isArray(session_ids) || session_ids.length === 0) {
      return NextResponse.json(
        { error: 'session_ids array is required' },
        { status: 400 }
      )
    }

    // Validate provider and model
    const selectedProvider: LLMProvider = provider === 'openai' ? 'openai' : 'anthropic'
    const availableModels = AVAILABLE_MODELS[selectedProvider]
    const selectedModel = model && availableModels.some(m => m.id === model) 
      ? model 
      : DEFAULT_JUDGE_CONFIG.model

    // Fetch evaluations with open codes for the selected sessions
    const { data: evaluations, error: evalError } = await supabaseAdmin
      .from('chat_evaluations')
      .select('session_id, open_code, rating, notes')
      .in('session_id', session_ids)
      .not('open_code', 'is', null)

    if (evalError) {
      console.error('Error fetching evaluations:', evalError)
      return NextResponse.json(
        { error: 'Failed to fetch evaluations' },
        { status: 500 }
      )
    }

    if (!evaluations || evaluations.length === 0) {
      return NextResponse.json(
        { error: 'No sessions with open codes found in the selection' },
        { status: 400 }
      )
    }

    // Transform evaluations to open codes with context
    const openCodesWithContext = evaluations.map((e: { open_code: string | null; session_id: string; rating: string | null; notes: string | null }) => ({
      code: e.open_code!,
      sessionId: e.session_id,
      rating: e.rating as 'good' | 'bad' | undefined,
      notes: e.notes || undefined,
    }))

    // Get unique open codes for storage
    const uniqueOpenCodes = [...new Set(openCodesWithContext.map((oc: { code: string; sessionId: string; rating: 'good' | 'bad' | undefined; notes: string | undefined }) => oc.code))]
    const uniqueSessionIds = [...new Set(openCodesWithContext.map((oc: { code: string; sessionId: string; rating: 'good' | 'bad' | undefined; notes: string | undefined }) => oc.sessionId))]

    // Generate axial codes using LLM
    const config = {
      provider: selectedProvider,
      model: selectedModel,
      promptVersion: 'v1',
      temperature: 0.3,
    }

    const result = await generateAxialCodes(openCodesWithContext, config)

    // Store the generation in the database
    const { data: generation, error: insertError } = await supabaseAdmin
      .from('axial_code_generations')
      .insert({
        generated_axial_codes: result.axial_codes,
        source_session_ids: uniqueSessionIds,
        source_open_codes: uniqueOpenCodes,
        model_used: selectedModel,
        prompt_version: 'v1',
        status: 'pending',
        created_by: authResult.user.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error storing generation:', insertError)
      return NextResponse.json(
        { error: 'Failed to store generation result' },
        { status: 500 }
      )
    }

    // Create review entries for each generated axial code
    const reviewEntries = result.axial_codes.map((ac: AxialCodeResult) => ({
      generation_id: generation.id,
      original_code: ac.code,
      original_description: ac.description,
      mapped_open_codes: ac.source_open_codes,
      mapped_session_ids: ac.source_sessions,
      status: 'pending',
    }))

    const { error: reviewError } = await supabaseAdmin
      .from('axial_code_reviews')
      .insert(reviewEntries)

    if (reviewError) {
      console.error('Error creating review entries:', reviewError)
      // Don't fail the whole request, the generation is already stored
    }

    return NextResponse.json({
      generation_id: generation.id,
      axial_codes: result.axial_codes,
      source_sessions_count: uniqueSessionIds.length,
      source_open_codes_count: uniqueOpenCodes.length,
      model_used: selectedModel,
    })
  } catch (error) {
    console.error('Axial code generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
