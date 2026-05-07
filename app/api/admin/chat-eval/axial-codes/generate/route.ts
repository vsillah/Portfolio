import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { generateAxialCodes, DEFAULT_JUDGE_CONFIG, AVAILABLE_MODELS, LlmJudgeBudgetError, LLMProvider, AxialCodeResult } from '@/lib/llm-judge'
import { endAgentRun, markAgentRunFailed, recordAgentStep, startAgentRun } from '@/lib/agent-run'

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

  let agentRunId: string | null = null

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

    const agentRun = await startAgentRun({
      agentKey: 'manual-admin',
      runtime: 'manual',
      kind: 'chat_eval_axial_codes',
      title: 'Generate Chat Eval axial codes',
      subject: {
        type: 'chat_eval_sessions',
        id: uniqueSessionIds.slice(0, 5).join(','),
        label: `${uniqueSessionIds.length} session(s), ${uniqueOpenCodes.length} open code(s)`,
      },
      triggerSource: 'admin:chat_eval_axial_codes',
      triggeredByUserId: authResult.user.id,
      currentStep: 'Preparing axial code generation',
      metadata: {
        provider: selectedProvider,
        model: selectedModel,
        session_count: uniqueSessionIds.length,
        open_code_count: uniqueOpenCodes.length,
      },
    })
    agentRunId = agentRun.id

    await recordAgentStep({
      runId: agentRunId,
      stepKey: 'axial_code_request_validated',
      name: 'Validated axial code generation request',
      status: 'completed',
      outputSummary: `Generating axial codes from ${uniqueOpenCodes.length} open code(s).`,
      metadata: {
        provider: selectedProvider,
        model: selectedModel,
        session_count: uniqueSessionIds.length,
        open_code_count: uniqueOpenCodes.length,
      },
      idempotencyKey: `${agentRunId}:axial_code_request_validated`,
    })

    // Generate axial codes using LLM
    const config = {
      provider: selectedProvider,
      model: selectedModel,
      promptVersion: 'v1',
      temperature: 0.3,
    }

    const result = await generateAxialCodes(openCodesWithContext, config, {
      agentRunId,
      runtime: 'manual',
      reference: { type: 'chat_eval_axial_codes', id: agentRunId },
      operation: 'axial_codes',
    })

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
      if (agentRunId) {
        await markAgentRunFailed(agentRunId, 'Failed to store axial code generation', {
          operation: 'axial_codes',
          session_count: uniqueSessionIds.length,
        }).catch(() => {})
      }
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

    await endAgentRun({
      runId: agentRunId,
      status: 'completed',
      currentStep: 'Axial code generation complete',
      outcome: {
        generation_id: generation.id,
        axial_code_count: result.axial_codes.length,
        source_session_count: uniqueSessionIds.length,
        source_open_code_count: uniqueOpenCodes.length,
        review_error: reviewError?.message ?? null,
        provider: selectedProvider,
        model: selectedModel,
      },
    })

    return NextResponse.json({
      generation_id: generation.id,
      agentRunId,
      axial_codes: result.axial_codes,
      source_sessions_count: uniqueSessionIds.length,
      source_open_codes_count: uniqueOpenCodes.length,
      model_used: selectedModel,
    })
  } catch (error) {
    console.error('Axial code generation error:', error)
    if (agentRunId) {
      const message = error instanceof Error ? error.message : 'Axial code generation failed'
      await recordAgentStep({
        runId: agentRunId,
        stepKey: 'axial_code_generation_failed',
        name: 'Axial code generation failed',
        status: 'failed',
        outputSummary: message,
        idempotencyKey: `${agentRunId}:axial_code_generation_failed`,
      }).catch(() => {})
      await markAgentRunFailed(agentRunId, message, { operation: 'axial_codes' }).catch(() => {})
    }
    if (error instanceof LlmJudgeBudgetError) {
      return NextResponse.json(
        {
          error:
            'This axial code generation request is over the current Agent Ops budget limit. Select fewer sessions or use a lower-cost model before retrying.',
          agentRunId,
        },
        { status: 400 },
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
