import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateAccelerationRecs } from '@/lib/acceleration-engine'
import { extractCategoryScores } from '@/lib/assessment-scoring'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/n8n/generate-acceleration-recs
 *
 * Called by n8n to generate personalized acceleration recommendations
 * for a client project. Uses the value evidence pipeline data.
 * Authenticated via N8N_INGEST_SECRET bearer token.
 *
 * Body: { client_project_id: string }
 */
export async function POST(request: NextRequest) {
  // Auth: bearer token
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  const expectedSecret = process.env.N8N_INGEST_SECRET
  if (!expectedSecret || token !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { client_project_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.client_project_id) {
    return NextResponse.json(
      { error: 'client_project_id is required' },
      { status: 400 }
    )
  }

  // Get latest scores for the project
  const { data: snapshot } = await supabaseAdmin
    .from('score_snapshots')
    .select('category_scores')
    .eq('client_project_id', body.client_project_id)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single()

  let categoryScores
  if (snapshot?.category_scores) {
    categoryScores = snapshot.category_scores
  } else {
    // Fall back to deriving from diagnostic audit
    const { data: project } = await supabaseAdmin
      .from('client_projects')
      .select('contact_submission_id')
      .eq('id', body.client_project_id)
      .single()

    if (project?.contact_submission_id) {
      const { data: audit } = await supabaseAdmin
        .from('diagnostic_audits')
        .select('*')
        .eq('contact_submission_id', project.contact_submission_id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (audit) {
        categoryScores = extractCategoryScores(audit)
      }
    }
  }

  if (!categoryScores) {
    return NextResponse.json(
      { error: 'No score data available for this project' },
      { status: 400 }
    )
  }

  const { count, error } = await generateAccelerationRecs(
    body.client_project_id,
    categoryScores
  )

  if (error) {
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    recommendations_created: count,
  })
}
