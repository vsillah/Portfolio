import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildContentPackage,
  CONTENT_PACKAGE_APPROVAL_TYPES,
  type ContentPackageOutputDraft,
} from '@/lib/content-packages'
import {
  recordAgentStep,
  startAgentRun,
} from '@/lib/agent-run'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  let runId: string | null = null
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({})) as {
      chronicle_notes?: string[]
      create_downstream_drafts?: boolean
    }

    const { data: intake, error: intakeError } = await supabaseAdmin
      .from('social_idea_intakes')
      .select('*')
      .eq('id', params.id)
      .single()

    if (intakeError || !intake?.id) {
      return NextResponse.json({ error: 'Voice-note intake not found' }, { status: 404 })
    }

    const run = await startAgentRun({
      agentKey: 'voice-content-architect',
      runtime: 'manual',
      kind: 'voice_note_content_package',
      title: `Generate content package: ${intake.title}`,
      subject: { type: 'social_idea_intake', id: intake.id, label: intake.title },
      triggerSource: 'admin_social_content_voice_note_generate',
      triggeredByUserId: auth.user.id,
      currentStep: 'Building source-backed content package',
      metadata: {
        intake_id: intake.id,
        target_outputs: intake.target_outputs ?? [],
        framework_ids: intake.framework_ids ?? [],
      },
      idempotencyKey: `voice-note-content-package:${intake.id}`,
    })
    runId = run.id

    const generated = buildContentPackage({
      title: intake.title,
      transcriptText: intake.transcript_text,
      topicHint: intake.topic_hint,
      targetAudience: intake.target_audience,
      targetOutputs: intake.target_outputs,
      frameworkIds: intake.framework_ids,
      audioStoragePath: intake.audio_storage_path,
      audioFileName: intake.audio_file_name,
      chronicleNotes: Array.isArray(body.chronicle_notes) ? body.chronicle_notes : [],
    })

    await recordAgentStep({
      runId,
      stepKey: 'content_package_built',
      name: 'Content package built',
      status: 'completed',
      inputSummary: String(intake.transcript_text ?? '').slice(0, 240),
      outputSummary: `${generated.outputs.length} output draft(s): ${generated.targetOutputs.join(', ')}`,
      metadata: {
        title: generated.title,
        output_types: generated.outputs.map((output) => output.outputType),
        framework_ids: generated.frameworkIds,
      },
      idempotencyKey: `${runId}:content_package_built`,
    }).catch((error) => console.warn('[voice-notes] agent step failed:', error))

    const downstream = body.create_downstream_drafts === false
      ? {}
      : await createDownstreamDrafts(generated.outputs, generated.title, intake.id)

    const approvalIds = await createApprovalGates({
      runId,
      title: generated.title,
      intakeId: intake.id,
      outputTypes: generated.outputs.map((output) => output.outputType),
      createdByAgentKey: 'voice-content-architect',
    })

    const { data: contentPackage, error: packageError } = await supabaseAdmin
      .from('content_packages')
      .insert({
        intake_id: intake.id,
        agent_run_id: runId,
        title: generated.title,
        status: 'waiting_script_approval',
        source_packet: generated.sourcePacket,
        research_packet: generated.researchPacket,
        framework_ids: generated.frameworkIds,
        target_outputs: generated.targetOutputs,
        approval_ids: approvalIds,
        social_content_id: downstream.socialContentId ?? null,
        video_idea_id: downstream.videoIdeaId ?? null,
        presentation_plan: generated.presentationPlan,
        created_by: auth.user.id,
        metadata: {
          downstream_created: Boolean(body.create_downstream_drafts !== false),
          approval_types: CONTENT_PACKAGE_APPROVAL_TYPES,
        },
      })
      .select('id, title, status, social_content_id, video_idea_id, created_at')
      .single()

    if (packageError || !contentPackage?.id) {
      console.error('[voice-notes] package insert failed:', packageError)
      return NextResponse.json({ error: 'Failed to create content package' }, { status: 500 })
    }

    const outputs = generated.outputs.map((output) => ({
      package_id: contentPackage.id,
      output_type: output.outputType,
      status: 'waiting_approval',
      title: output.title,
      body: output.body,
      payload: output.payload,
      downstream_type: output.downstreamType ?? null,
      downstream_id: downstreamIdForOutput(output, downstream),
      metadata: {
        required_approval: output.requiredApproval,
        approval_type: CONTENT_PACKAGE_APPROVAL_TYPES[output.requiredApproval],
      },
    }))

    const { error: outputsError } = await supabaseAdmin
      .from('content_package_outputs')
      .insert(outputs)

    if (outputsError) {
      console.error('[voice-notes] output insert failed:', outputsError)
      return NextResponse.json({ error: 'Failed to create package outputs' }, { status: 500 })
    }

    await Promise.all([
      supabaseAdmin
        .from('social_idea_intakes')
        .update({ status: 'packet_generated', updated_at: new Date().toISOString() })
        .eq('id', intake.id),
      supabaseAdmin
        .from('agent_runs')
        .update({
          status: 'waiting_for_approval',
          current_step: 'Approval required: content package script packet',
          updated_at: new Date().toISOString(),
        })
        .eq('id', runId),
    ])

    return NextResponse.json({
      package: contentPackage,
      agentRunId: runId,
      approvals: approvalIds,
      downstream,
      outputs: generated.outputs.map((output) => ({
        outputType: output.outputType,
        title: output.title,
      })),
    })
  } catch (error) {
    console.error('[voice-notes] generate error:', error)
    const message = error instanceof Error ? error.message : String(error)
    if (runId) {
      await supabaseAdmin
        .from('agent_runs')
        .update({
          status: 'failed',
          current_step: 'Content package generation failed',
          error_message: message,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', runId)
        .catch(() => {})
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function createDownstreamDrafts(
  outputs: ContentPackageOutputDraft[],
  title: string,
  intakeId: string,
): Promise<{ socialContentId?: string; videoIdeaId?: string }> {
  const linkedin = outputs.find((output) => output.outputType === 'linkedin_post')
  const carousel = outputs.find((output) => output.outputType === 'linkedin_carousel')
  const video = outputs.find((output) => output.outputType === 'video_script')
  const downstream: { socialContentId?: string; videoIdeaId?: string } = {}

  if (linkedin || carousel) {
    const source = linkedin ?? carousel!
    const payload = source.payload
    const { data, error } = await supabaseAdmin
      .from('social_content_queue')
      .insert({
        platform: 'linkedin',
        status: 'draft',
        post_text: source.body,
        companion_post_text: carousel?.body ?? null,
        cta_text: typeof payload.cta_text === 'string' ? payload.cta_text : 'Where could this kind of system remove burden in your work right now?',
        cta_url: null,
        hashtags: Array.isArray(payload.hashtags) ? payload.hashtags : ['#AIProduct', '#ProductManagement', '#AmadutownAdvisory'],
        image_prompt: `Create an AmaduTown-branded framework visual for: ${title}`,
        framework_visual_type: 'cycle',
        voiceover_text: video?.body ?? source.body,
        topic_extracted: {
          topic: title,
          angle: 'Voice-note content package',
          key_insight: 'One source idea can become governed multi-format content.',
          personal_tie_in: 'Uses Vambah voice guidance, AmaduTown proof surfaces, and Agent Ops approvals.',
          framework_visual: 'cycle',
        },
        hormozi_framework: {
          framework_type: 'value_equation',
          hook_type: 'practical_tension',
          proof_pattern: 'source_packet_to_outputs',
          cta_pattern: 'operator_question',
        },
        rag_context: {
          source: 'voice_note_content_package',
          intake_id: intakeId,
          approval_required_for: ['script_packet', 'media_generation', 'publish'],
        },
        admin_notes: [
          'Generated from voice-note content package.',
          'Draft only. Publishing requires content_package_publish approval.',
          'Media generation requires content_package_media_generation approval.',
        ].join('\n'),
        target_platforms: ['linkedin'],
        video_generation_method: video ? 'heygen_avatar' : 'none',
        content_format: carousel ? 'carousel' : 'single_image',
        content_pillar: 'ai_product_management',
        carousel_slides: carousel?.payload?.slides ?? null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[voice-notes] social draft insert failed:', error)
    } else if (data?.id) {
      downstream.socialContentId = String(data.id)
    }
  }

  if (video) {
    const { data, error } = await supabaseAdmin
      .from('video_ideas_queue')
      .insert({
        title,
        script_text: video.body,
        storyboard_json: video.payload.storyboard ?? { scenes: [] },
        source: 'manual',
        status: 'pending',
        custom_prompt: `Voice-note content package ${intakeId}`,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[voice-notes] video idea insert failed:', error)
    } else if (data?.id) {
      downstream.videoIdeaId = String(data.id)
    }
  }

  return downstream
}

async function createApprovalGates(input: {
  runId: string
  title: string
  intakeId: string
  outputTypes: string[]
  createdByAgentKey: string
}): Promise<string[]> {
  const rows = [
    {
      approval_type: CONTENT_PACKAGE_APPROVAL_TYPES.script,
      label: 'Approve script and source packet',
      risk_level: 'medium',
      side_effect_boundary: 'Approves editorial source packet only. Does not call paid media providers or publish.',
      executes_action: false,
    },
    {
      approval_type: CONTENT_PACKAGE_APPROVAL_TYPES.media,
      label: 'Approve media and deck generation',
      risk_level: 'high',
      side_effect_boundary: 'Allows generation jobs such as PPTX/deck packaging, ElevenLabs audio, and HeyGen video. Does not publish.',
      executes_action: true,
    },
    {
      approval_type: CONTENT_PACKAGE_APPROVAL_TYPES.publish,
      label: 'Approve public publishing',
      risk_level: 'high',
      side_effect_boundary: 'Allows final outbound publishing or delivery after review.',
      executes_action: true,
    },
  ]

  const { data, error } = await supabaseAdmin
    .from('agent_approvals')
    .insert(rows.map((row) => ({
      run_id: input.runId,
      approval_type: row.approval_type,
      status: 'pending',
      requested_by_agent_key: input.createdByAgentKey,
      metadata: {
        label: row.label,
        risk_level: row.risk_level,
        executes_action: row.executes_action,
        side_effect_boundary: row.side_effect_boundary,
        action_payload: {
          content_package_title: input.title,
          intake_id: input.intakeId,
          output_types: input.outputTypes,
          approval_type: row.approval_type,
        },
      },
    })))
    .select('id')

  if (error) {
    console.error('[voice-notes] approval insert failed:', error)
    throw new Error('Failed to create content package approvals.')
  }
  return (data ?? []).map((row: { id: string }) => row.id)
}

function downstreamIdForOutput(
  output: ContentPackageOutputDraft,
  downstream: { socialContentId?: string; videoIdeaId?: string },
) {
  if (output.downstreamType === 'social_content_queue') return downstream.socialContentId ?? null
  if (output.downstreamType === 'video_ideas_queue') return downstream.videoIdeaId ?? null
  return null
}
