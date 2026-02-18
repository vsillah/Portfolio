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
    const purpose = purposeRaw === 'instructions' ? 'instructions' : 'product'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Generate unique file path; instructions go in instructions/ subfolder
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = purpose === 'instructions'
      ? (productId ? `product-${productId}/instructions/${fileName}` : `uploads/instructions/${fileName}`)
      : (productId ? `product-${productId}/${fileName}` : `uploads/${fileName}`)

    // Upload file to Supabase Storage (products bucket)
    const { data, error } = await supabaseAdmin.storage
      .from('products')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) throw error

    return NextResponse.json({
      success: true,
      file_path: filePath,
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
