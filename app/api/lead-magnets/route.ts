import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Check authentication - try header first, then cookie
    const authHeader = request.headers.get('authorization')
    let token = authHeader?.replace('Bearer ', '')
    
    // If no token in header, try to get from cookie
    if (!token) {
      const cookies = request.cookies
      // Supabase stores session in cookies - we'll need to extract it
      // For now, we'll require the token in the header
      return NextResponse.json({ error: 'Unauthorized - token required' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch active lead magnets
    const { data: leadMagnets, error } = await supabaseAdmin
      .from('lead_magnets')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching lead magnets:', error)
      return NextResponse.json({ error: 'Failed to fetch lead magnets' }, { status: 500 })
    }

    const normalized = (leadMagnets || []).map((m: any) => ({
      ...m,
      file_path: m.file_path ?? m.file_url ?? null,
    }))

    return NextResponse.json({ leadMagnets: normalized })
  } catch (error) {
    console.error('Lead magnets API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
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

    // Check if user is admin
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, file_path, file_type, file_size } = body

    if (!title || !file_path || !file_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const basePayload = {
      title,
      description,
      file_type,
      file_size,
      is_active: true,
    }

    // Support legacy/new schema variants:
    // - file_path vs file_url
    // - required type column vs no type column
    const insertCandidates = [
      { ...basePayload, file_path, type: 'ebook' },
      { ...basePayload, file_path, type: 'pdf' },
      { ...basePayload, file_path, type: 'lead_magnet' },
      { ...basePayload, file_path },
      { ...basePayload, file_url: file_path, type: 'ebook' },
      { ...basePayload, file_url: file_path, type: 'pdf' },
      { ...basePayload, file_url: file_path, type: 'lead_magnet' },
      { ...basePayload, file_url: file_path },
    ]

    let data: any = null
    let lastError: any = null

    for (const candidate of insertCandidates) {
      const result = await supabaseAdmin
        .from('lead_magnets')
        .insert([candidate])
        .select()
        .single()

      if (!result.error) {
        data = result.data
        lastError = null
        break
      }

      lastError = result.error
      const msg = String((result.error as any)?.message || '')
      // If the error is not a missing-column mismatch, fail fast.
      if (!msg.includes('Could not find the') && !msg.includes('column') && !msg.includes('schema cache')) {
        break
      }
    }

    if (lastError) {
      console.error('Error creating lead magnet:', lastError)
      return NextResponse.json(
        {
          error: 'Failed to create lead magnet',
          details: (lastError as any).message || null,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ leadMagnet: data }, { status: 201 })
  } catch (error) {
    console.error('Lead magnets POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
