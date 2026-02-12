import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

// Valid service types and delivery methods
const VALID_SERVICE_TYPES = ['training', 'speaking', 'consulting', 'coaching', 'workshop', 'warranty']
const VALID_DELIVERY_METHODS = ['in_person', 'virtual', 'hybrid']

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await Promise.resolve(params)
    const { data: service, error } = await supabaseAdmin
      .from('services')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Service not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json(service)
  } catch (error: any) {
    console.error('Error fetching service:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch service' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await Promise.resolve(params)
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json()
    const {
      title,
      description,
      service_type,
      delivery_method,
      duration_hours,
      duration_description,
      price,
      is_quote_based,
      min_participants,
      max_participants,
      prerequisites,
      deliverables,
      topics,
      image_url,
      is_active,
      is_featured,
      display_order,
    } = body

    const updateData: any = {}

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description || null
    
    if (service_type !== undefined) {
      if (!VALID_SERVICE_TYPES.includes(service_type)) {
        return NextResponse.json(
          { error: `Invalid service type. Must be one of: ${VALID_SERVICE_TYPES.join(', ')}` },
          { status: 400 }
        )
      }
      updateData.service_type = service_type
    }
    
    if (delivery_method !== undefined) {
      if (!VALID_DELIVERY_METHODS.includes(delivery_method)) {
        return NextResponse.json(
          { error: `Invalid delivery method. Must be one of: ${VALID_DELIVERY_METHODS.join(', ')}` },
          { status: 400 }
        )
      }
      updateData.delivery_method = delivery_method
    }
    
    if (duration_hours !== undefined) updateData.duration_hours = duration_hours ? parseFloat(duration_hours) : null
    if (duration_description !== undefined) updateData.duration_description = duration_description || null
    if (price !== undefined) updateData.price = price ? parseFloat(price) : null
    if (is_quote_based !== undefined) updateData.is_quote_based = is_quote_based
    if (min_participants !== undefined) updateData.min_participants = min_participants ? parseInt(min_participants) : 1
    if (max_participants !== undefined) updateData.max_participants = max_participants ? parseInt(max_participants) : null
    if (prerequisites !== undefined) updateData.prerequisites = prerequisites || null
    if (deliverables !== undefined) updateData.deliverables = deliverables
    if (topics !== undefined) updateData.topics = topics
    if (image_url !== undefined) updateData.image_url = image_url || null
    if (is_active !== undefined) updateData.is_active = is_active
    if (is_featured !== undefined) updateData.is_featured = is_featured
    if (display_order !== undefined) updateData.display_order = display_order

    const { data, error } = await supabaseAdmin
      .from('services')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Service not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error updating service:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update service' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await Promise.resolve(params)
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { error } = await supabaseAdmin
      .from('services')
      .delete()
      .eq('id', id)

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Service not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting service:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete service' },
      { status: 500 }
    )
  }
}
