import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { PRODUCT_TYPES } from '@/lib/constants/products'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') !== 'false'
    const type = searchParams.get('type')
    
    // Filter by linked content entity
    const musicId = searchParams.get('music_id')
    const publicationId = searchParams.get('publication_id')
    const prototypeId = searchParams.get('prototype_id')

    let query = supabaseAdmin
      .from('products')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    if (type) {
      query = query.eq('type', type)
    }
    
    // Filter by linked entity ID (useful for checking if a product exists for a content item)
    if (musicId) {
      query = query.eq('music_id', parseInt(musicId))
    }
    
    if (publicationId) {
      query = query.eq('publication_id', parseInt(publicationId))
    }
    
    if (prototypeId) {
      query = query.eq('prototype_id', prototypeId)
    }

    const { data: products, error } = await query

    // #region agent log
    if (Array.isArray(products)) {
      const auditProduct = products.find((p: { title?: string }) => (p?.title || '').includes('AI Audit Calculator'))
      if (auditProduct) {
        fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'app/api/products/route.ts:GET',
            message: 'AI Audit Calculator product image_url from API',
            data: { productId: (auditProduct as { id?: number }).id, title: (auditProduct as { title?: string }).title, image_url: (auditProduct as { image_url?: string | null }).image_url },
            hypothesisId: 'H1-H5',
            timestamp: Date.now(),
          }),
        }).catch(() => {})
      }
    }
    // #endregion

    if (error) {
      // If table doesn't exist yet, return empty array
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json([])
      }
      throw error
    }

    return NextResponse.json(products || [])
  } catch (error: any) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch products' },
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
      type,
      price,
      file_path,
      image_url,
      is_active,
      is_featured,
      display_order,
      // Linked content entity IDs
      music_id,
      publication_id,
      prototype_id,
    } = body

    if (!title || !type) {
      return NextResponse.json(
        { error: 'Title and type are required' },
        { status: 400 }
      )
    }

    if (!(PRODUCT_TYPES as readonly string[]).includes(type)) {
      return NextResponse.json(
        { error: 'Invalid product type' },
        { status: 400 }
      )
    }

    const {
      asset_url: assetUrl,
      instructions_file_path: instructionsFilePath,
    } = body

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert([{
        title,
        description: description || null,
        type,
        price: price ? parseFloat(price) : null,
        file_path: file_path || null,
        image_url: image_url || null,
        is_active: is_active !== undefined ? is_active : true,
        is_featured: is_featured !== undefined ? is_featured : false,
        display_order: display_order || 0,
        created_by: user.id,
        asset_url: assetUrl || null,
        instructions_file_path: instructionsFilePath || null,
        // Linked content entity IDs
        music_id: music_id || null,
        publication_id: publication_id || null,
        prototype_id: prototype_id || null,
      }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create product' },
      { status: 500 }
    )
  }
}
