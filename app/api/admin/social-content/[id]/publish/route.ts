import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { publishToLinkedIn } from '@/lib/publishing/linkedin'
import { publishToYouTube } from '@/lib/publishing/youtube'
import { publishToInstagram } from '@/lib/publishing/instagram'
import { publishToFacebook } from '@/lib/publishing/facebook'
import { publishToTikTok } from '@/lib/publishing/tiktok'
import type { SocialPlatform } from '@/lib/social-content'
import { getProductionAssets, getVideoRedactionGate } from '@/lib/social-production-assets'

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

    // Load the content item
    const { data: item, error: fetchError } = await admin
      .from('social_content_queue')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !item) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    if (item.status !== 'approved' && item.status !== 'scheduled') {
      return NextResponse.json(
        { error: 'Content must be approved before publishing' },
        { status: 400 }
      )
    }

    const redactionGate = getVideoRedactionGate(getProductionAssets(item.rag_context))
    if (!redactionGate.ready) {
      return NextResponse.json(
        {
          error: redactionGate.message || 'Video privacy review required before publishing',
          unresolved_redaction_items: redactionGate.unresolvedItems.length,
        },
        { status: 409 }
      )
    }

    // Load publish records for this content
    const { data: publishes } = await admin
      .from('social_content_publishes')
      .select('*')
      .eq('content_id', id)

    if (!publishes?.length) {
      return NextResponse.json(
        { error: 'No publish records found — approve the content first' },
        { status: 400 }
      )
    }

    // Filter to pending records only (duplicate guard: skip published/publishing)
    let pendingPublishes = publishes.filter(
      (p: { status: string }) => p.status === 'pending' || p.status === 'failed'
    )

    // If specific platforms requested, further filter
    if (targetPlatforms?.length) {
      pendingPublishes = pendingPublishes.filter(
        (p: { platform: string }) => targetPlatforms!.includes(p.platform as SocialPlatform)
      )
    }

    if (!pendingPublishes.length) {
      return NextResponse.json({
        message: 'No pending platforms to publish',
        results: publishes.map((p: { platform: string; status: string }) => ({
          platform: p.platform,
          status: p.status,
          skipped: true,
        })),
      })
    }

    // Dispatch to platform-specific modules
    const results = await Promise.allSettled(
      pendingPublishes.map(async (pub: { platform: string }) => {
        const platform = pub.platform as SocialPlatform
        const payload = {
          contentId: id,
          postText: item.post_text,
          ctaText: item.cta_text,
          ctaUrl: item.cta_url,
          hashtags: item.hashtags,
          imageUrl: item.image_url,
          videoUrl: item.video_url,
          carouselSlideUrls: item.carousel_slide_urls,
          youtubeTitle: item.youtube_title,
          youtubeDescription: item.youtube_description,
        }

        switch (platform) {
          case 'linkedin':
            return { platform, result: await publishToLinkedIn(payload) }

          case 'youtube':
            return { platform, result: await publishToYouTube(payload) }

          case 'instagram':
            return { platform, result: await publishToInstagram(payload) }

          case 'facebook':
            return { platform, result: await publishToFacebook(payload) }

          case 'tiktok':
            return { platform, result: await publishToTikTok(payload) }

          default:
            // Mark as skipped until these modules are implemented
            await admin
              .from('social_content_publishes')
              .update({ status: 'skipped', error_message: `${platform} publishing not yet implemented` })
              .eq('content_id', id)
              .eq('platform', platform)
            return {
              platform,
              result: { success: false, error: `${platform} publishing not yet implemented` },
            }
        }
      })
    )

    // Check if any platform succeeded → update queue status
    const platformResults = results.map((r) => {
      if (r.status === 'fulfilled') return r.value
      return { platform: 'unknown', result: { success: false, error: r.reason?.message || 'Unknown error' } }
    })

    const anyPublished = platformResults.some((r) => (
      r.result.success && r.result.status !== 'publishing'
    ))

    if (anyPublished) {
      await admin
        .from('social_content_queue')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
        })
        .eq('id', id)
    }

    // Reload publish records for the response
    const { data: updatedPublishes } = await admin
      .from('social_content_publishes')
      .select('*')
      .eq('content_id', id)

    return NextResponse.json({
      published: anyPublished,
      results: platformResults,
      publishes: updatedPublishes,
    })
  } catch (error) {
    console.error('Error in POST /api/admin/social-content/[id]/publish:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
