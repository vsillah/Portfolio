import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'
import { getSignedUrl } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = parseInt(params.id)
    
    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })
    }

    // Fetch project (public access for published projects)
    const { data: project, error: fetchError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('is_published', true)
      .single()

    if (fetchError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!project.file_path) {
      return NextResponse.json({ error: 'No file available for this project' }, { status: 404 })
    }

    // Get signed URL for download (valid for 1 hour)
    // Note: This requires the user to be authenticated (signed URLs work for authenticated users)
    // For public access, you'd need to make the bucket public or use a different approach
    const signedUrl = await getSignedUrl('projects', project.file_path, 3600)

    return NextResponse.json({ downloadUrl: signedUrl })
  } catch (error: any) {
    console.error('Download error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate download URL' },
      { status: 500 }
    )
  }
}
