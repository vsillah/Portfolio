import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { generateJsonCompletion } from '@/lib/llm-dispatch'
import { supabaseAdmin } from '@/lib/supabase'
import { getSocialCopywritingPrompt } from '@/lib/system-prompts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type SocialContentRow = {
  id: string
  status: string
  post_text: string | null
  cta_text: string | null
  hashtags: string[] | null
  image_prompt: string | null
  topic_extracted: unknown
  hormozi_framework: unknown
  rag_context: Record<string, unknown> | null
  admin_notes: string | null
}

type CalibrationRevision = {
  post_text?: unknown
  cta_text?: unknown
  hashtags?: unknown
  image_prompt?: unknown
  revision_notes?: unknown
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)))
    : []
}

function normalizeSuccessExamples(value: unknown) {
  return asRecordArray(value)
    .map((item) => ({
      source_label: asString(item.source_label).trim(),
      post_excerpt: asString(item.post_excerpt).trim(),
      engagement_signal: asString(item.engagement_signal).trim(),
      why_it_worked: asString(item.why_it_worked).trim(),
    }))
    .filter((item) => (
      item.source_label
      || item.post_excerpt
      || item.engagement_signal
      || item.why_it_worked
    ))
}

function hasOperatorFeedback(feedback: Record<string, unknown> | null): boolean {
  if (!feedback) return false
  if (normalizeSuccessExamples(feedback.success_examples).length > 0) return true
  return [
    'triggering_event',
    'prior_post_excerpt',
    'engagement_signal',
    'audience_context',
    'revision_request',
    'claim_boundaries',
  ].some((key) => Boolean(asString(feedback[key]).trim()))
}

function includesAny(value: string, words: string[]) {
  const lower = value.toLowerCase()
  return words.some((word) => lower.includes(word))
}

function buildRevisionUnderstanding(feedback: Record<string, unknown> | null) {
  const revisionRequest = asString(feedback?.revision_request).trim()
  const triggeringEvent = asString(feedback?.triggering_event).trim()
  const claimBoundaries = asString(feedback?.claim_boundaries).trim()
  const audienceContext = asString(feedback?.audience_context).trim()
  const engagementSignal = asString(feedback?.engagement_signal).trim()
  const priorPostExcerpt = asString(feedback?.prior_post_excerpt).trim()
  const successExamples = normalizeSuccessExamples(feedback?.success_examples)
  const combined = [
    revisionRequest,
    triggeringEvent,
    claimBoundaries,
    audienceContext,
    engagementSignal,
    priorPostExcerpt,
    successExamples.map((example) => [
      example.source_label,
      example.post_excerpt,
      example.engagement_signal,
      example.why_it_worked,
    ].filter(Boolean).join(' ')).join(' '),
  ].join(' ')

  const plannedChanges: string[] = []
  if (revisionRequest) plannedChanges.push(`Address revision request: ${revisionRequest}`)
  if (triggeringEvent) plannedChanges.push(`Anchor the post in the triggering event: ${triggeringEvent}`)
  if (audienceContext) plannedChanges.push(`Tune audience and desired reaction: ${audienceContext}`)
  if (engagementSignal || successExamples.length > 0 || priorPostExcerpt) {
    plannedChanges.push('Compare the draft against the saved successful-post references and engagement signals.')
  }
  if (includesAny(combined, ['anecdote', 'story', 'scene', 'example'])) {
    plannedChanges.push('Add or strengthen a concrete anecdote before the broader point.')
  }
  if (includesAny(combined, ['ai-ism', 'ai ism', 'not just', 'not only', "it's not", 'generic'])) {
    plannedChanges.push('Remove formulaic AI phrasing and negative antithesis constructions.')
  }

  const separateActions: string[] = []
  if (includesAny(combined, ['illustration', 'image', 'visual', 'framework'])) {
    separateActions.push('Framework illustration or visual generation is a separate asset action after copy revision.')
  }
  if (includesAny(combined, ['carousel', 'slides', 'slide'])) {
    separateActions.push('Carousel creation is a separate asset action after copy revision.')
  }
  if (includesAny(combined, ['reference', 'source', 'citation'])) {
    separateActions.push('Reference/source attachment should become an Agent Ops follow-up after draft approval.')
  }

  return {
    what_i_heard: revisionRequest || (triggeringEvent ? `Use the triggering event as the reason this post exists now: ${triggeringEvent}` : 'Use the saved calibration feedback to improve this draft.'),
    planned_changes: plannedChanges.length ? plannedChanges : ['Revise the draft against the saved calibration feedback and voice guidance.'],
    not_changing: [
      'Draft-only status remains in place.',
      'Publishing, scheduling, provider generation, DMs, sends, deploys, and production mutations remain outside this revision.',
      ...(claimBoundaries ? [`Respect claim boundary: ${claimBoundaries}`] : []),
    ],
    separate_actions: separateActions,
    questions_or_ambiguity: separateActions.length
      ? ['Some feedback asks for non-copy assets. Those are tracked separately so Shaka does not hide them inside a text revision.']
      : [],
  }
}

function buildRevisionPrompt(row: SocialContentRow) {
  const ragContext = asRecord(row.rag_context) ?? {}
  const calibration = asRecord(ragContext.content_calibration) ?? {}
  const feedback = asRecord(calibration.operator_feedback) ?? {}
  const successExamples = normalizeSuccessExamples(feedback.success_examples)
  const priorPatterns = Array.isArray(calibration.prior_success_patterns)
    ? calibration.prior_success_patterns
    : []
  const voicePrinciples = asStringArray(calibration.voice_principles)
  const missingContextPrompts = asStringArray(calibration.missing_context_prompts)

  return `Revise this LinkedIn draft as Shaka, Vambah's Chief of Staff.

Keep the output draft-only. Do not publish, schedule, DM, or create external outreach.

Return JSON only:
{
  "post_text": "revised LinkedIn post text",
  "cta_text": "specific closing question",
  "hashtags": ["#AIProduct", "#ProductManagement"],
  "image_prompt": "optional revised visual brief",
  "revision_notes": ["what changed and why"]
}

Current draft:
${row.post_text ?? ''}

Current CTA:
${row.cta_text ?? ''}

Current hashtags:
${(row.hashtags ?? []).join(', ')}

Topic metadata:
${JSON.stringify(row.topic_extracted ?? {}, null, 2)}

Framework metadata:
${JSON.stringify(row.hormozi_framework ?? {}, null, 2)}

Content packet context:
${JSON.stringify({
    goal_id: ragContext.goal_id,
    goal_type: ragContext.goal_type,
    content_packet_id: ragContext.content_packet_id,
    publish_gate: ragContext.publish_gate,
    open_brain_references: ragContext.open_brain_references,
    chronicle_packet_status: ragContext.chronicle_packet_status,
    chronicle_evidence_notes: ragContext.chronicle_evidence_notes,
    source_provenance_checklist: ragContext.source_provenance_checklist,
    visual_brief: ragContext.visual_brief,
  }, null, 2)}

Prior success patterns to compare against:
${JSON.stringify(priorPatterns, null, 2)}

Operator-provided successful post references:
${JSON.stringify(successExamples, null, 2)}

Voice principles:
${voicePrinciples.map((item) => `- ${item}`).join('\n')}

Operator feedback:
Triggering event / authority to speak:
${asString(feedback.triggering_event)}

Prior post/sample excerpt:
${asString(feedback.prior_post_excerpt)}

Engagement signal:
${asString(feedback.engagement_signal)}

Audience and desired reaction:
${asString(feedback.audience_context)}

Revision request:
${asString(feedback.revision_request)}

Claim boundaries:
${asString(feedback.claim_boundaries)}

If context is still missing, make the best draft from the available packet and mention the missing input in revision_notes, not in the post.

Context prompts Shaka wanted answered:
${missingContextPrompts.map((item) => `- ${item}`).join('\n')}`
}

function normalizeRevision(parsed: CalibrationRevision) {
  const postText = asString(parsed.post_text).trim()
  if (!postText) {
    throw new Error('Revision response did not include post_text')
  }

  const ctaText = asString(parsed.cta_text).trim()
  const imagePrompt = asString(parsed.image_prompt).trim()
  const revisionNotes = asStringArray(parsed.revision_notes).map((item) => item.trim()).filter(Boolean)
  const hashtags = asStringArray(parsed.hashtags)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.startsWith('#') ? item : `#${item}`)

  return {
    post_text: postText,
    cta_text: ctaText || null,
    image_prompt: imagePrompt || null,
    hashtags,
    revision_notes: revisionNotes,
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json().catch(() => ({})) as {
      operator_feedback?: Record<string, unknown>
    }

    const { data: row, error: fetchError } = await supabaseAdmin
      .from('social_content_queue')
      .select('id, status, post_text, cta_text, hashtags, image_prompt, topic_extracted, hormozi_framework, rag_context, admin_notes')
      .eq('id', params.id)
      .single()

    if (fetchError || !row) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    const content = row as SocialContentRow
    if (content.status !== 'draft' && content.status !== 'rejected') {
      return NextResponse.json({ error: 'Calibration revision is only available for draft or rejected content' }, { status: 409 })
    }

    const ragContext = asRecord(content.rag_context) ?? {}
    if (ragContext.source !== 'agent_ops_social_outreach_goal') {
      return NextResponse.json({ error: 'Calibration revision is only available for Agent Ops social pilot drafts' }, { status: 400 })
    }

    const calibration = asRecord(ragContext.content_calibration) ?? {}
    const requestedFeedback = asRecord(body.operator_feedback)
    const requestedSuccessExamples = normalizeSuccessExamples(requestedFeedback?.success_examples)
    const operatorFeedback = hasOperatorFeedback(requestedFeedback)
      ? {
        triggering_event: asString(requestedFeedback?.triggering_event).trim(),
        prior_post_excerpt: asString(requestedFeedback?.prior_post_excerpt).trim(),
        success_examples: requestedSuccessExamples,
        engagement_signal: asString(requestedFeedback?.engagement_signal).trim(),
        audience_context: asString(requestedFeedback?.audience_context).trim(),
        revision_request: asString(requestedFeedback?.revision_request).trim(),
        claim_boundaries: asString(requestedFeedback?.claim_boundaries).trim(),
        updated_at: new Date().toISOString(),
      }
      : asRecord(calibration.operator_feedback)
    if (!hasOperatorFeedback(operatorFeedback)) {
      return NextResponse.json({ error: 'Save operator feedback before generating a calibrated revision' }, { status: 400 })
    }
    const revisionUnderstanding = buildRevisionUnderstanding(operatorFeedback)

    const promptRagContext: Record<string, unknown> = {
      ...ragContext,
      content_calibration: {
        ...calibration,
        operator_feedback: operatorFeedback,
      },
    }

    const basePrompt = await getSocialCopywritingPrompt()
    const model = process.env.SOCIAL_CALIBRATION_REVISION_MODEL || 'gpt-4o-mini'
    const promptContent = { ...content, rag_context: promptRagContext }
    const aiResponse = await generateJsonCompletion({
      model,
      systemPrompt: `${basePrompt}

Additional role: You are Shaka, the Agent Ops Chief of Staff. Use the operator feedback and calibration packet to revise the draft in Vambah's voice. Stay source-backed, concrete, and draft-only.`,
      userPrompt: buildRevisionPrompt(promptContent),
      temperature: 0.55,
      maxTokens: 1400,
      costContext: {
        reference: { type: 'social_content_queue', id: params.id },
        metadata: {
          operation: 'social_content_calibration_revision',
          goal_id: asString(promptRagContext.goal_id) || null,
          content_packet_id: asString(promptRagContext.content_packet_id) || null,
        },
      },
    })

    let parsed: CalibrationRevision
    try {
      parsed = JSON.parse(aiResponse.content) as CalibrationRevision
    } catch {
      return NextResponse.json({ error: 'Calibration revision returned invalid JSON' }, { status: 502 })
    }

    const revision = normalizeRevision(parsed)
    const createdAt = new Date().toISOString()
    const revisionEntry = {
      created_at: createdAt,
      created_by: authResult.user.id,
      model: aiResponse.model,
      provider: aiResponse.provider,
      revision_notes: revision.revision_notes,
      operator_request: asString(operatorFeedback?.revision_request) || null,
      operator_triggering_event: asString(operatorFeedback?.triggering_event) || null,
      shaka_understanding: revisionUnderstanding,
      operator_feedback_updated_at: asString(operatorFeedback?.updated_at) || null,
    }
    const revisionHistory = Array.isArray(calibration.revision_history)
      ? calibration.revision_history
      : []
    const nextRagContext = {
      ...promptRagContext,
      content_calibration: {
        ...calibration,
        status: 'revision_generated',
        operator_feedback: operatorFeedback,
        latest_revision: revisionEntry,
        revision_history: [...revisionHistory, revisionEntry].slice(-10),
      },
    }

    const notesBlock = [
      `Calibration revision generated by Shaka on ${createdAt}.`,
      ...revision.revision_notes.map((note) => `- ${note}`),
    ].join('\n')

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('social_content_queue')
      .update({
        post_text: revision.post_text,
        cta_text: revision.cta_text,
        hashtags: revision.hashtags.length ? revision.hashtags : content.hashtags ?? [],
        image_prompt: revision.image_prompt ?? content.image_prompt,
        status: 'draft',
        rag_context: nextRagContext,
        admin_notes: [content.admin_notes, notesBlock].filter(Boolean).join('\n\n'),
      })
      .eq('id', params.id)
      .select('*')
      .single()

    if (updateError || !updated) {
      console.error('[calibration-revision] update failed:', updateError)
      return NextResponse.json({ error: 'Failed to save calibrated revision' }, { status: 500 })
    }

    return NextResponse.json({
      item: updated,
      revision: revisionEntry,
      shaka_understanding: revisionUnderstanding,
    })
  } catch (error) {
    console.error('[calibration-revision] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
