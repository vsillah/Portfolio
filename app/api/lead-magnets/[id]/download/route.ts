import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { getSignedUrl } from '@/lib/storage'

export const dynamic = 'force-dynamic'

function anonymizeIP(ip: string | null): string | null {
  if (!ip) return null
  const parts = ip.split('.')
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`
  }
  return ip
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leadMagnetId = parseInt(params.id)
    
    if (isNaN(leadMagnetId)) {
      return NextResponse.json({ error: 'Invalid lead magnet ID' }, { status: 400 })
    }

    // Check authentication
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch lead magnet
    const { data: leadMagnet, error: fetchError } = await supabaseAdmin
      .from('lead_magnets')
      .select('*')
      .eq('id', leadMagnetId)
      .eq('is_active', true)
      .single()

    if (fetchError || !leadMagnet) {
      return NextResponse.json({ error: 'Lead magnet not found' }, { status: 404 })
    }

    const storagePath = leadMagnet.file_path || leadMagnet.file_url
    if (!storagePath) {
      return NextResponse.json(
        { error: 'Lead magnet file path is missing' },
        { status: 500 }
      )
    }

    // Get signed URL for download (valid for 1 hour)
    const signedUrl = await getSignedUrl('lead-magnets', storagePath, 3600)

    // Track download
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               null
    const anonymizedIP = anonymizeIP(ip)

    await supabaseAdmin
      .from('lead_magnet_downloads')
      .insert([
        {
          user_id: user.id,
          lead_magnet_id: leadMagnetId,
          ip_address: anonymizedIP,
        },
      ])

    // Increment download count
    await supabaseAdmin
      .from('lead_magnets')
      .update({ download_count: (leadMagnet.download_count || 0) + 1 })
      .eq('id', leadMagnetId)

    return NextResponse.json({ downloadUrl: signedUrl })
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
