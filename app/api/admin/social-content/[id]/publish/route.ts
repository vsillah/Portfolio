import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { publishSocialContentItem } from '@/lib/social-content-publisher'
import type { SocialPlatform } from '@/lib/social-content'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/social-content/[id]/publish
 * Publish approved content to target platforms.
 * Dispatches to platform-specific modules in lib/publishing/.
 * Includes duplicate publish prevention (skips already-published or in-flight platforms).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const admin = supabaseAdmin
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { id } = params

    // Optional: allow targeting specific platforms from the request body
    let targetPlatforms: SocialPlatform[] | undefined
    try {
      const body = await request.json()
      if (body.platforms && Array.isArray(body.platforms)) {
        targetPlatforms = body.platforms
      }
    } catch {
      // No body or invalid JSON — publish all pending
    }

    const result = await publishSocialContentItem({ admin, id, targetPlatforms })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error('Error in POST /api/admin/social-content/[id]/publish:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
