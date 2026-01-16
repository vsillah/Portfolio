import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Allowed image types
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]

// Allowed video types for demos
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
]

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export async function POST(request: NextRequest) {
  try {
    // Get the session token from the Authorization header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify the user with the token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user is admin by fetching their profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const prototypeId = formData.get('prototypeId') as string | null
    const mediaType = formData.get('mediaType') as string || 'thumbnail' // thumbnail, demo_video, demo_image

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 50MB limit' },
        { status: 400 }
      )
    }

    // Validate file type based on media type
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type)
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type)

    if (mediaType === 'thumbnail' && !isImage) {
      return NextResponse.json(
        { error: 'Thumbnail must be an image (JPEG, PNG, GIF, WebP, or SVG)' },
        { status: 400 }
      )
    }

    if (mediaType === 'demo_video' && !isVideo) {
      return NextResponse.json(
        { error: 'Demo video must be a video file (MP4, WebM, or MOV)' },
        { status: 400 }
      )
    }

    if (mediaType === 'demo_image' && !isImage) {
      return NextResponse.json(
        { error: 'Demo image must be an image (JPEG, PNG, GIF, WebP, or SVG)' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const fileName = `${timestamp}-${randomStr}.${fileExt}`
    
    // Determine storage path based on media type
    let storagePath: string
    if (mediaType === 'thumbnail') {
      storagePath = prototypeId 
        ? `prototypes/${prototypeId}/thumbnails/${fileName}`
        : `prototypes/temp/thumbnails/${fileName}`
    } else if (mediaType === 'demo_video') {
      storagePath = prototypeId 
        ? `prototypes/${prototypeId}/demos/${fileName}`
        : `prototypes/temp/demos/${fileName}`
    } else {
      storagePath = prototypeId 
        ? `prototypes/${prototypeId}/images/${fileName}`
        : `prototypes/temp/images/${fileName}`
    }

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from('prototypes')
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      
      // If bucket doesn't exist, try to create it
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
        // Try creating the bucket
        const { error: bucketError } = await supabaseAdmin
          .storage
          .createBucket('prototypes', {
            public: true,
            fileSizeLimit: MAX_FILE_SIZE,
          })
        
        if (bucketError && !bucketError.message?.includes('already exists')) {
          console.error('Bucket creation error:', bucketError)
          return NextResponse.json(
            { error: 'Failed to create storage bucket. Please set up the "prototypes" bucket in Supabase Storage.' },
            { status: 500 }
          )
        }

        // Retry upload
        const { data: retryData, error: retryError } = await supabaseAdmin
          .storage
          .from('prototypes')
          .upload(storagePath, buffer, {
            contentType: file.type,
            cacheControl: '3600',
            upsert: false,
          })

        if (retryError) {
          console.error('Retry upload error:', retryError)
          return NextResponse.json(
            { error: retryError.message || 'Failed to upload file after creating bucket' },
            { status: 500 }
          )
        }
      } else {
        return NextResponse.json(
          { error: uploadError.message || 'Failed to upload file' },
          { status: 500 }
        )
      }
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin
      .storage
      .from('prototypes')
      .getPublicUrl(storagePath)

    return NextResponse.json({
      success: true,
      file_path: storagePath,
      public_url: urlData.publicUrl,
      file_type: file.type,
      file_size: file.size,
      file_name: file.name,
      media_type: mediaType,
    })
  } catch (error: any) {
    console.error('Error uploading prototype media:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload file' },
      { status: 500 }
    )
  }
}

// Delete uploaded file
export async function DELETE(request: NextRequest) {
  try {
    // Get the session token from the Authorization header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify the user with the token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path')

    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      )
    }

    // Delete from storage
    const { error } = await supabaseAdmin
      .storage
      .from('prototypes')
      .remove([filePath])

    if (error) {
      console.error('Delete error:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to delete file' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting prototype media:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete file' },
      { status: 500 }
    )
  }
}
