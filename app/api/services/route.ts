import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

// Valid service types and delivery methods
const VALID_SERVICE_TYPES = ['training', 'speaking', 'consulting', 'coaching', 'workshop', 'warranty']
const VALID_DELIVERY_METHODS = ['in_person', 'virtual', 'hybrid']

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') !== 'false'
    const serviceType = searchParams.get('type')
    const deliveryMethod = searchParams.get('delivery')
    const featured = searchParams.get('featured')

    let query = supabaseAdmin
      .from('services')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    if (serviceType) {
      query = query.eq('service_type', serviceType)
    }

    if (deliveryMethod) {
      query = query.eq('delivery_method', deliveryMethod)
    }

    if (featured === 'true') {
      query = query.eq('is_featured', true)
    }

    const { data: services, error } = await query

    if (error) {
      // If table doesn't exist yet, return empty array
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json([])
      }
      throw error
    }

    return NextResponse.json(services || [])
  } catch (error: any) {
    console.error('Error fetching services:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch services' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { user } = authResult

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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'app/api/services/route.ts:POST', message: 'POST body', data: { title, service_type, delivery_method }, hypothesisId: 'payload', timestamp: Date.now() }) }).catch(() => {});
    // #endregion

    // Validation
    if (!title || !service_type) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'app/api/services/route.ts:POST', message: 'validation: missing title or service_type', data: { title, service_type }, hypothesisId: 'A', timestamp: Date.now() }) }).catch(() => {});
      // #endregion
      return NextResponse.json(
        { error: 'Title and service type are required' },
        { status: 400 }
      )
    }

    if (!VALID_SERVICE_TYPES.includes(service_type)) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'app/api/services/route.ts:POST', message: 'validation: invalid service_type', data: { service_type, valid: VALID_SERVICE_TYPES }, hypothesisId: 'B', timestamp: Date.now() }) }).catch(() => {});
      // #endregion
      return NextResponse.json(
        { error: `Invalid service type. Must be one of: ${VALID_SERVICE_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    if (delivery_method && !VALID_DELIVERY_METHODS.includes(delivery_method)) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'app/api/services/route.ts:POST', message: 'validation: invalid delivery_method', data: { delivery_method, valid: VALID_DELIVERY_METHODS }, hypothesisId: 'C', timestamp: Date.now() }) }).catch(() => {});
      // #endregion
      return NextResponse.json(
        { error: `Invalid delivery method. Must be one of: ${VALID_DELIVERY_METHODS.join(', ')}` },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('services')
      .insert([{
        title,
        description: description || null,
        service_type,
        delivery_method: delivery_method || 'virtual',
        duration_hours: duration_hours ? parseFloat(duration_hours) : null,
        duration_description: duration_description || null,
        price: price ? parseFloat(price) : null,
        is_quote_based: is_quote_based || false,
        min_participants: min_participants ? parseInt(min_participants) : 1,
        max_participants: max_participants ? parseInt(max_participants) : null,
        prerequisites: prerequisites || null,
        deliverables: deliverables || [],
        topics: topics || [],
        image_url: image_url || null,
        is_active: is_active !== undefined ? is_active : true,
        is_featured: is_featured !== undefined ? is_featured : false,
        display_order: display_order || 0,
        created_by: user.id,
      }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating service:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create service' },
      { status: 500 }
    )
  }
}
