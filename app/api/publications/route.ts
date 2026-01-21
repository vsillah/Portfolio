import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

// Type definitions
type PublicationRow = {
  id: number
  title: string
  description: string | null
  publication_url: string | null
  author: string | null
  publication_date: string | null
  publisher: string | null
  display_order: number
  is_published: boolean
  file_path: string | null
  file_type: string | null
  file_size: number | null
  created_at: string
  created_by: string | null
}

type ProductRow = {
  id: number
  price: number | null
  publication_id: number | null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const publishedOnly = searchParams.get('published') !== 'false'

    let query = supabaseAdmin
      .from('publications')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (publishedOnly) {
      query = query.eq('is_published', true)
    }

    const { data: publications, error } = await query

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json([])
      }
      throw error
    }

    // Fetch linked products for publication entries
    const publicationIds = (publications || []).map((p: PublicationRow) => p.id)
    let linkedProducts: Record<number, { id: number; price: number | null }> = {}
    
    if (publicationIds.length > 0) {
      const { data: products } = await supabaseAdmin
        .from('products')
        .select('id, price, publication_id')
        .in('publication_id', publicationIds)
        .eq('is_active', true)
      
      if (products) {
        products.forEach((p: ProductRow) => {
          if (p.publication_id) {
            linkedProducts[p.publication_id] = { id: p.id, price: p.price }
          }
        })
      }
    }

    // Attach linked_product to each publication entry
    const publicationsWithProducts = (publications || []).map((p: PublicationRow) => ({
      ...p,
      linked_product: linkedProducts[p.id] || null
    }))

    return NextResponse.json(publicationsWithProducts)
  } catch (error: any) {
    console.error('Error fetching publications:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch publications' },
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
    const { title, description, publication_url, author, publication_date, publisher, display_order, is_published, file_path, file_type, file_size } = body

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('publications')
      .insert([{
        title,
        description: description || null,
        publication_url: publication_url || null,
        author: author || null,
        publication_date: publication_date || null,
        publisher: publisher || null,
        display_order: display_order || 0,
        is_published: is_published !== undefined ? is_published : true,
        file_path: file_path || null,
        file_type: file_type || null,
        file_size: file_size || null,
        created_by: user.id,
      }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating publication:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create publication' },
      { status: 500 }
    )
  }
}
