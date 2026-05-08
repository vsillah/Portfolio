import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { renderCarousel } from '@/lib/carousel'
import type { CarouselSlide } from '@/lib/social-content'
import { recordOpenAICost, type Usage } from '@/lib/cost-calculator'
import {
  endAgentRun,
  markAgentRunFailed,
  recordAgentStep,
  startAgentRun,
} from '@/lib/agent-run'
import {
  evaluateSocialCarouselGenerationBudget,
  recordSocialCarouselGenerationBudgetDecision,
  SOCIAL_CAROUSEL_GENERATION_MAX_TOKENS,
  SOCIAL_CAROUSEL_GENERATION_MODEL,
  SOCIAL_CAROUSEL_GENERATION_OPERATION,
  SocialCarouselGenerationError,
} from '@/lib/social-carousel-generation'
import { fetchProviderWithRetry } from '@/lib/llm/provider-fetch'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/admin/social-content/[id]/convert-to-carousel
 * Convert a single-image post to a carousel.
 * Generates carousel_slides JSON via OpenAI from existing post content,
 * then renders PNGs + PDF and uploads to Supabase Storage.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let agentRunId: string | null = null
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = params

    const { data: row, error: fetchErr } = await supabaseAdmin
      .from('social_content_queue')
      .select('post_text, topic_extracted, hormozi_framework, hashtags')
      .eq('id', id)
      .single()

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    const agentRun = await startAgentRun({
      agentKey: 'manual-admin',
      runtime: 'manual',
      kind: 'social_carousel_generation',
      title: 'Convert social post to carousel',
      subject: {
        type: 'social_content_queue',
        id,
        label: `Social content ${id}`,
      },
      triggerSource: 'admin:social_convert_to_carousel',
      triggeredByUserId: authResult.user.id,
      currentStep: 'Social carousel request validated',
      metadata: {
        has_topic: !!row.topic_extracted,
        has_framework: !!row.hormozi_framework,
        hashtag_count: Array.isArray(row.hashtags) ? row.hashtags.length : 0,
      },
    })
    agentRunId = agentRun.id

    await recordAgentStep({
      runId: agentRunId,
      stepKey: 'social_carousel_request_validated',
      name: 'Social carousel request validated',
      status: 'completed',
      inputSummary: typeof row.post_text === 'string' ? row.post_text.slice(0, 240) : null,
      metadata: {
        social_content_id: id,
        post_text_chars: typeof row.post_text === 'string' ? row.post_text.length : 0,
      },
      idempotencyKey: `${agentRunId}:social_carousel_request_validated`,
    }).catch((err) => console.warn('[convert-to-carousel] agent validation step failed:', err))

    const { getSocialCarouselSlidesPrompt } = await import('@/lib/system-prompts')
    const systemPrompt = await getSocialCarouselSlidesPrompt()

    const topicData = row.topic_extracted as Record<string, unknown> | null
    const userMessage = `Topic: ${topicData?.topic || 'N/A'}
Key Insight: ${topicData?.key_insight || 'N/A'}
Personal Tie-In: ${topicData?.personal_tie_in || 'N/A'}
Hormozi Framework: ${JSON.stringify(row.hormozi_framework || {})}
Post Text: ${row.post_text}
Hashtags: ${(row.hashtags || []).join(', ')}`

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      throw new SocialCarouselGenerationError('OPENAI_API_KEY is not configured', 'openai_not_configured')
    }

    const budgetDecision = evaluateSocialCarouselGenerationBudget({
      systemPrompt,
      userMessage,
      model: SOCIAL_CAROUSEL_GENERATION_MODEL,
      maxTokens: SOCIAL_CAROUSEL_GENERATION_MAX_TOKENS,
    })
    await recordSocialCarouselGenerationBudgetDecision({
      agentRunId,
      socialContentId: id,
      decision: budgetDecision,
    })
    if (budgetDecision.status === 'blocked') {
      throw new SocialCarouselGenerationError(budgetDecision.reason, 'budget_blocked')
    }

    const aiResponse = await fetchProviderWithRetry('openai', 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: SOCIAL_CAROUSEL_GENERATION_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: SOCIAL_CAROUSEL_GENERATION_MAX_TOKENS,
        response_format: { type: 'json_object' },
      }),
    })

    if (!aiResponse.ok) {
      console.error('OpenAI API error:', await aiResponse.text())
      throw new SocialCarouselGenerationError('Failed to generate carousel content', 'openai_upstream')
    }

    const aiData = await aiResponse.json()
    const rawContent = aiData.choices?.[0]?.message?.content
    const usage = aiData.usage as Usage | undefined
    if (usage) {
      recordOpenAICost(
        usage,
        SOCIAL_CAROUSEL_GENERATION_MODEL,
        { type: 'social_content_queue', id },
        {
          operation: SOCIAL_CAROUSEL_GENERATION_OPERATION,
          budget_status: budgetDecision.status,
          budget_rule_key: budgetDecision.rule.key,
          budget_estimated_cost_usd: budgetDecision.estimatedCostUsd,
        },
        agentRunId,
      ).catch(() => {})
    }
    let slides: CarouselSlide[]

    try {
      const parsed = JSON.parse(rawContent)
      slides = Array.isArray(parsed) ? parsed : parsed.slides || []
    } catch {
      throw new SocialCarouselGenerationError('Failed to parse AI-generated slides', 'invalid_response')
    }

    if (slides.length < 3) {
      throw new SocialCarouselGenerationError('AI generated too few slides', 'invalid_response')
    }

    await supabaseAdmin
      .from('social_content_queue')
      .update({ carousel_slides: slides })
      .eq('id', id)

    const { pngBuffers, pdfBuffer } = await renderCarousel(slides)

    const slideUrls: string[] = []
    const storageBase = `carousels/${id}`

    for (let i = 0; i < pngBuffers.length; i++) {
      const fileName = `${storageBase}/slide_${String(i + 1).padStart(2, '0')}.png`
      const { error: uploadErr } = await supabaseAdmin.storage
        .from('social-content')
        .upload(fileName, pngBuffers[i], {
          contentType: 'image/png',
          upsert: true,
        })

      if (uploadErr) {
        console.error(`Failed to upload slide ${i + 1}:`, uploadErr)
        continue
      }

      const { data: publicUrl } = supabaseAdmin.storage
        .from('social-content')
        .getPublicUrl(fileName)
      slideUrls.push(publicUrl.publicUrl)
    }

    const pdfFileName = `${storageBase}/carousel.pdf`
    let pdfUrl: string | null = null
    const { error: pdfUploadErr } = await supabaseAdmin.storage
      .from('social-content')
      .upload(pdfFileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (!pdfUploadErr) {
      const { data: publicUrl } = supabaseAdmin.storage
        .from('social-content')
        .getPublicUrl(pdfFileName)
      pdfUrl = publicUrl.publicUrl
    }

    await supabaseAdmin
      .from('social_content_queue')
      .update({
        content_format: 'carousel',
        carousel_slide_urls: slideUrls,
        carousel_pdf_url: pdfUrl,
      })
      .eq('id', id)

    await endAgentRun({
      runId: agentRunId,
      status: 'completed',
      currentStep: 'Social carousel ready',
      outcome: {
        social_content_id: id,
        slide_count: slides.length,
        slide_url_count: slideUrls.length,
        has_pdf: !!pdfUrl,
      },
    }).catch((err) => console.warn('[convert-to-carousel] end agent run failed:', err))

    return NextResponse.json({
      success: true,
      content_format: 'carousel',
      carousel_slides: slides,
      carousel_slide_urls: slideUrls,
      carousel_pdf_url: pdfUrl,
      slide_count: slides.length,
      agentRunId,
    })
  } catch (error) {
    console.error('Error in convert-to-carousel:', error)
    const message = error instanceof Error ? error.message : String(error)
    if (agentRunId) {
      await recordAgentStep({
        runId: agentRunId,
        stepKey: 'social_carousel_generation_failed',
        name: 'Social carousel generation failed',
        status: 'failed',
        outputSummary: message,
        idempotencyKey: `${agentRunId}:social_carousel_generation_failed`,
      }).catch((stepErr) => console.warn('[convert-to-carousel] agent failure step failed:', stepErr))
      await markAgentRunFailed(agentRunId, message, {
        operation: SOCIAL_CAROUSEL_GENERATION_OPERATION,
        social_content_id: params.id,
      }).catch((runErr) => console.warn('[convert-to-carousel] mark agent run failed:', runErr))
    }

    if (error instanceof SocialCarouselGenerationError) {
      return NextResponse.json(
        { error: safeSocialCarouselErrorMessage(error), agentRunId },
        { status: socialCarouselErrorStatus(error) },
      )
    }

    return NextResponse.json(
      { error: 'Failed to convert to carousel. Please try again.' },
      { status: 500 }
    )
  }
}

function safeSocialCarouselErrorMessage(error: SocialCarouselGenerationError): string {
  if (error.code === 'budget_blocked') {
    return 'This carousel conversion is over the current Agent Ops budget limit. Shorten the post or reduce the carousel prompt size before retrying.'
  }
  if (error.code === 'openai_not_configured') {
    return 'OpenAI API key not configured'
  }
  if (error.code === 'openai_upstream') {
    return 'Failed to generate carousel content'
  }
  if (error.code === 'invalid_response') {
    return 'The AI returned an invalid carousel response. Try converting again or adjust the carousel system prompt.'
  }
  return 'Failed to convert to carousel. Please try again.'
}

function socialCarouselErrorStatus(error: SocialCarouselGenerationError): number {
  if (error.code === 'budget_blocked') return 400
  if (error.code === 'openai_not_configured') return 503
  if (error.code === 'openai_upstream' || error.code === 'invalid_response') return 502
  return 500
}
