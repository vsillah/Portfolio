import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * POST: Create or update a lead magnet linked to a service's video.
 * When service_id is set and the service has video_url, the lead magnet
 * appears on Resources with "Watch video"; video URL is resolved from the service.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json()
    const serviceId = body?.service_id

    if (!serviceId || typeof serviceId !== 'string') {
      return NextResponse.json(
        { error: 'service_id is required' },
        { status: 400 }
      )
    }

    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('id, title, description, video_url')
      .eq('id', serviceId)
      .single()

    if (serviceError || !service) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      )
    }

    if (!service.video_url || !String(service.video_url).trim()) {
      return NextResponse.json(
        { error: 'Service must have a video URL to offer as lead magnet' },
        { status: 400 }
      )
    }

    const title = body.title && String(body.title).trim()
      ? String(body.title).trim()
      : `Watch: ${service.title}`
    const description = body.description !== undefined
      ? (body.description === '' || body.description == null ? null : String(body.description))
      : service.description

    const { data: existing } = await supabaseAdmin
      .from('lead_magnets')
      .select('id, title, description')
      .eq('service_id', serviceId)
      .maybeSingle()

    if (existing) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('lead_magnets')
        .update({
          title,
          description,
          category: 'gate_keeper',
          access_type: 'public_gated',
          funnel_stage: 'attention_capture',
          type: 'link',
          is_active: true,
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating lead magnet from service:', updateError)
        return NextResponse.json(
          { error: (updateError as Error).message || 'Failed to update lead magnet' },
          { status: 500 }
        )
      }
      return NextResponse.json({ leadMagnet: updated }, { status: 200 })
    }

    const { data: maxRow } = await supabaseAdmin
      .from('lead_magnets')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const displayOrder = ((maxRow as { display_order?: number } | null)?.display_order ?? -1) + 1

    const { data: created, error: insertError } = await supabaseAdmin
      .from('lead_magnets')
      .insert([{
        title,
        description,
        service_id: serviceId,
        category: 'gate_keeper',
        access_type: 'public_gated',
        funnel_stage: 'attention_capture',
        type: 'link',
        file_path: null,
        file_type: null,
        is_active: true,
        display_order: displayOrder,
      }])
      .select()
      .single()

    if (insertError) {
      console.error('Error creating lead magnet from service:', insertError)
      return NextResponse.json(
        { error: (insertError as Error).message || 'Failed to create lead magnet' },
        { status: 500 }
      )
    }

    return NextResponse.json({ leadMagnet: created }, { status: 201 })
  } catch (error) {
    console.error('from-service POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
