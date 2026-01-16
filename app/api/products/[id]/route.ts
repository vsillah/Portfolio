import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: product, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        )
      }
      throw error
    }

    // If merchandise, fetch variants
    let variants = []
    if (product.is_print_on_demand) {
      const { data: variantData } = await supabaseAdmin
        .from('product_variants')
        .select('*')
        .eq('product_id', product.id)
        .order('size', { ascending: true })
        .order('color', { ascending: true })

      variants = variantData || []
    }

    return NextResponse.json({
      product,
      variants,
    })
  } catch (error: any) {
    console.error('Error fetching product:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch product' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
      type,
      price,
      file_path,
      image_url,
      is_active,
      is_featured,
      display_order,
      // Merchandise fields
      category,
      base_cost,
      markup_percentage,
      printful_product_id,
      printful_variant_id,
    } = body

    const updateData: any = {}

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description || null
    if (type !== undefined) {
      const validTypes = ['ebook', 'training', 'calculator', 'music', 'app', 'merchandise']
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { error: 'Invalid product type' },
          { status: 400 }
        )
      }
      updateData.type = type
    }
    if (price !== undefined) updateData.price = price ? parseFloat(price) : null
    if (file_path !== undefined) updateData.file_path = file_path || null
    if (image_url !== undefined) updateData.image_url = image_url || null
    if (is_active !== undefined) updateData.is_active = is_active
    if (is_featured !== undefined) updateData.is_featured = is_featured
    if (display_order !== undefined) updateData.display_order = display_order
    // Merchandise fields
    if (category !== undefined) updateData.category = category || null
    if (base_cost !== undefined) updateData.base_cost = base_cost ? parseFloat(base_cost) : null
    if (markup_percentage !== undefined)
      updateData.markup_percentage = markup_percentage ? parseFloat(markup_percentage) : null
    if (printful_product_id !== undefined)
      updateData.printful_product_id = printful_product_id ? parseInt(printful_product_id) : null
    if (printful_variant_id !== undefined)
      updateData.printful_variant_id = printful_variant_id ? parseInt(printful_variant_id) : null

    const { data, error } = await supabaseAdmin
      .from('products')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error updating product:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update product' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', params.id)

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete product' },
      { status: 500 }
    )
  }
}
