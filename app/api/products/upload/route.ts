import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const productId = formData.get('productId') as string | null
    const purposeRaw = formData.get('purpose') as string | null
    const purpose: 'instructions' | 'product' | 'card_image' =
      purposeRaw === 'instructions'
        ? 'instructions'
        : purposeRaw === 'card_image'
          ? 'card_image'
          : 'product'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Generate unique file path; instructions go in instructions/ subfolder;
    // card_image = store listing / ProductCard image (separate from downloadable product file)
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    let filePath: string
    if (purpose === 'instructions') {
      filePath = productId
        ? `product-${productId}/instructions/${fileName}`
        : `uploads/instructions/${fileName}`
    } else if (purpose === 'card_image') {
      filePath = productId
        ? `product-${productId}/card-${fileName}`
        : `uploads/cards/${fileName}`
    } else {
      filePath = productId ? `product-${productId}/${fileName}` : `uploads/${fileName}`
    }

    // Upload file to Supabase Storage (products bucket)
    const { data, error } = await supabaseAdmin.storage
      .from('products')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) throw error

    const { data: pub } = supabaseAdmin.storage.from('products').getPublicUrl(filePath)

    return NextResponse.json({
      success: true,
      file_path: filePath,
      public_url: pub.publicUrl,
      file_type: file.type,
      file_size: file.size,
    })
  } catch (error: any) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload file' },
      { status: 500 }
    )
  }
}
