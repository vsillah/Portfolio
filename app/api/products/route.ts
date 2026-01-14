import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser, isAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') !== 'false'
    const type = searchParams.get('type')

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

    const { data: products, error } = await query

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
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const isUserAdmin = await isAdmin(user.id)
    if (!isUserAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

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
    } = body

    if (!title || !type) {
      return NextResponse.json(
        { error: 'Title and type are required' },
        { status: 400 }
      )
    }

    const validTypes = ['ebook', 'training', 'calculator', 'music', 'app', 'merchandise']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid product type' },
        { status: 400 }
      )
    }

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
