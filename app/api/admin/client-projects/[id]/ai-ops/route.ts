import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  ensureRoadmapForProject,
  getRoadmapBundleForProject,
  projectRoadmapTasks,
} from '@/lib/client-ai-ops-roadmap-db'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const bundle = await getRoadmapBundleForProject(id)
  return NextResponse.json({ roadmap: bundle })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as { project_tasks?: boolean }
  const roadmap = await ensureRoadmapForProject(id, { generatedFrom: 'manual', userId: auth.user.id })
  const projection = body.project_tasks ? await projectRoadmapTasks(id) : { dashboardCreated: 0, meetingCreated: 0 }

  return NextResponse.json({ roadmap, projection })
}
