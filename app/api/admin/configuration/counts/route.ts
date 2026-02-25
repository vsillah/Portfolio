import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/configuration/counts
 * Lightweight counts for Configuration dashboard card (users, prompts, content).
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const [
      usersRes,
      promptsRes,
      productsRes,
      servicesRes,
    ] = await Promise.all([
      supabaseAdmin.from('user_profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('system_prompts').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('products').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('services').select('*', { count: 'exact', head: true }),
    ])

    const users = usersRes.count ?? 0
    const prompts = promptsRes.count ?? 0
    const products = productsRes.count ?? 0
    const services = servicesRes.count ?? 0
    const contentItems = products + services

    return NextResponse.json({
      users,
      prompts,
      contentItems,
      products,
      services,
    })
  } catch (error) {
    console.error('Error in GET /api/admin/configuration/counts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
