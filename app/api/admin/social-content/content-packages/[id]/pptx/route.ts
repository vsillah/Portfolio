import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { CONTENT_PACKAGE_APPROVAL_TYPES } from '@/lib/content-packages'
import {
  buildContentPackagePptxBuffer,
  contentPackagePptxFileName,
  type ContentPackagePptxOutput,
} from '@/lib/content-package-pptx'

export const dynamic = 'force-dynamic'

interface PackageOutputRow {
  id: string
  output_type: string
  title: string | null
  body: string | null
  payload: unknown
  status: string | null
  metadata: unknown
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data: contentPackage, error: packageError } = await supabaseAdmin
      .from('content_packages')
      .select('id, title, agent_run_id, source_packet, research_packet, presentation_plan, metadata')
      .eq('id', params.id)
      .single()

    if (packageError || !contentPackage?.id) {
      return NextResponse.json({ error: 'Content package not found' }, { status: 404 })
    }

    const { data: approval, error: approvalError } = await supabaseAdmin
      .from('agent_approvals')
      .select('id, status, approval_type')
      .eq('run_id', contentPackage.agent_run_id)
      .eq('approval_type', CONTENT_PACKAGE_APPROVAL_TYPES.media)
      .maybeSingle()

    if (approvalError) {
      console.error('[content-packages:pptx] approval lookup failed:', approvalError)
      return NextResponse.json({ error: 'Failed to verify media-generation approval' }, { status: 500 })
    }

    if (approval?.status !== 'approved') {
      return NextResponse.json({
        error: 'Media generation approval is required before creating the PPTX artifact.',
        approvalRequired: CONTENT_PACKAGE_APPROVAL_TYPES.media,
        agentRunId: contentPackage.agent_run_id,
      }, { status: 403 })
    }

    const { data: outputs, error: outputsError } = await supabaseAdmin
      .from('content_package_outputs')
      .select('id, output_type, title, body, payload, status, metadata')
      .eq('package_id', contentPackage.id)
      .order('created_at', { ascending: true })

    if (outputsError) {
      console.error('[content-packages:pptx] outputs lookup failed:', outputsError)
      return NextResponse.json({ error: 'Failed to load content package outputs' }, { status: 500 })
    }

    const outputRows = (outputs ?? []) as PackageOutputRow[]
    const deckOutput = outputRows.find((output) => output.output_type === 'pptx_deck')
    if (!deckOutput) {
      return NextResponse.json({ error: 'This package did not request a PowerPoint output.' }, { status: 400 })
    }

    const fileName = contentPackagePptxFileName(contentPackage.title)
    const buffer = await buildContentPackagePptxBuffer({
      title: contentPackage.title,
      sourcePacket: asRecord(contentPackage.source_packet),
      researchPacket: asRecord(contentPackage.research_packet),
      presentationPlan: asRecord(contentPackage.presentation_plan),
      outputs: outputRows.map((output) => ({
        output_type: String(output.output_type),
        title: String(output.title ?? output.output_type),
        body: typeof output.body === 'string' ? output.body : null,
        payload: asRecord(output.payload),
      })) satisfies ContentPackagePptxOutput[],
    })

    const storagePath = `content-packages/${contentPackage.id}/${Date.now()}-${fileName}`
    const { data: upload, error: uploadError } = await supabaseAdmin.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError || !upload?.path) {
      console.error('[content-packages:pptx] upload failed:', uploadError)
      return NextResponse.json({ error: 'Failed to upload generated PPTX' }, { status: 500 })
    }

    const payload = asRecord(deckOutput.payload)
    const metadata = asRecord(deckOutput.metadata)
    const { error: updateError } = await supabaseAdmin
      .from('content_package_outputs')
      .update({
        status: 'generated',
        approval_id: approval.id,
        downstream_type: 'documents',
        downstream_id: upload.path,
        payload: {
          ...payload,
          pptx_storage_path: upload.path,
          pptx_file_name: fileName,
          generated_at: new Date().toISOString(),
          generated_by_user_id: auth.user.id,
        },
        metadata: {
          ...metadata,
          generated_artifact_type: 'pptx',
          approval_id: approval.id,
        },
      })
      .eq('id', deckOutput.id)

    if (updateError) {
      console.error('[content-packages:pptx] output update failed:', updateError)
      return NextResponse.json({ error: 'PPTX created but package output update failed' }, { status: 500 })
    }

    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from('documents')
      .createSignedUrl(upload.path, 3600)

    if (signedError || !signed?.signedUrl) {
      console.error('[content-packages:pptx] signed URL failed:', signedError)
      return NextResponse.json({
        packageId: contentPackage.id,
        storagePath: upload.path,
        fileName,
      })
    }

    return NextResponse.json({
      packageId: contentPackage.id,
      storagePath: upload.path,
      fileName,
      signedUrl: signed.signedUrl,
    })
  } catch (error) {
    console.error('[content-packages:pptx] generate error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}
