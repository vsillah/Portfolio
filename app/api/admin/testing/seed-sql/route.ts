import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { JOURNEY_SCRIPTS_BY_ID } from '@/lib/testing/journey-scripts'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/testing/seed-sql?scriptId=discovery_call_seed
 * Returns the SQL content so the UI can display / copy it.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const scriptId = request.nextUrl.searchParams.get('scriptId')
    if (!scriptId) {
      return NextResponse.json({ error: 'scriptId query param is required' }, { status: 400 })
    }

    const script = JOURNEY_SCRIPTS_BY_ID[scriptId]
    if (!script) {
      return NextResponse.json({ error: 'Unknown script ID' }, { status: 404 })
    }

    if (script.type !== 'seed_sql' || !script.seedSqlPath) {
      return NextResponse.json({ error: 'This script is not a seed SQL.' }, { status: 400 })
    }

    const fullPath = join(process.cwd(), script.seedSqlPath)
    const sql = await readFile(fullPath, 'utf-8')

    return NextResponse.json({
      scriptId: script.id,
      label: script.label,
      sql,
    })
  } catch (err) {
    console.error('Seed SQL read error:', err)
    return NextResponse.json(
      { error: 'Something went wrong reading the seed SQL.' },
      { status: 500 }
    )
  }
}
