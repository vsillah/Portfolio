import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  listSocialContentCalibrationReferences,
  socialContentHistoryReferenceFromRow,
  type SocialContentCalibrationHistoryRow,
  type SocialContentCalibrationReference,
} from '@/lib/social-content-calibration-library'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform') || 'linkedin'
    const includeHistory = searchParams.get('include_history') !== 'false'
    const historyLimit = Math.min(Math.max(parseInt(searchParams.get('history_limit') || '8', 10), 0), 20)
    const staticReferences = listSocialContentCalibrationReferences({ platform })
    let historyReferences: SocialContentCalibrationReference[] = []

    if (includeHistory && platform.toLowerCase() === 'linkedin' && historyLimit > 0) {
      const { data, error } = await supabaseAdmin
        .from('social_content_queue')
        .select('id, platform, status, post_text, cta_text, hashtags, topic_extracted, rag_context, content_pillar, target_platforms, published_at, updated_at, created_at')
        .in('status', ['published', 'approved'])
        .order('updated_at', { ascending: false })
        .limit(historyLimit * 2)

      if (error) throw new Error(error.message)

      historyReferences = ((data ?? []) as SocialContentCalibrationHistoryRow[])
        .map(socialContentHistoryReferenceFromRow)
        .filter((reference): reference is NonNullable<typeof reference> => Boolean(reference))
        .slice(0, historyLimit)
    }
    const references = [...historyReferences, ...staticReferences]

    return NextResponse.json({
      references,
      source: 'approved_calibration_library',
      counts: {
        portfolio_history: historyReferences.length,
        static_references: staticReferences.length,
        total: references.length,
      },
      side_effects: {
        provider_generation: false,
        publish: false,
        schedule: false,
        external_post: false,
      },
    })
  } catch (error) {
    console.error('[social-content-calibration-library] list failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch calibration references' },
      { status: 500 },
    )
  }
}
