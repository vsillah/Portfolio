import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { collectLiveSocialTopicCoverage } from '@/lib/social-topic-source-coverage'
import {
  buildSocialCandidateProjectionQaFixture,
  SOCIAL_CANDIDATE_PROJECTION_QA_FIXTURE,
  socialCandidateProjectionQaFixtureEnabled,
} from '@/lib/social-candidate-projection-qa-fixture'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const qaFixture = request.nextUrl.searchParams.get('qa_fixture')
  if (qaFixture) {
    if (qaFixture !== SOCIAL_CANDIDATE_PROJECTION_QA_FIXTURE || !socialCandidateProjectionQaFixtureEnabled()) {
      return NextResponse.json({ error: 'Synthetic candidate QA fixture is unavailable.' }, { status: 404 })
    }
    return NextResponse.json({
      coverage: buildSocialCandidateProjectionQaFixture(),
      qa_fixture: {
        id: SOCIAL_CANDIDATE_PROJECTION_QA_FIXTURE,
        synthetic: true,
        preview_only: true,
        read_only: true,
        external_execution_enabled: false,
      },
    })
  }

  try {
    const coverage = await collectLiveSocialTopicCoverage({ persist: false })
    return NextResponse.json({ coverage })
  } catch (error) {
    console.error('[social-topic-source-coverage] read failed:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to read source coverage',
    }, { status: 500 })
  }
}
