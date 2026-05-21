import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { buildAgentMissionControlSnapshot } from '@/lib/agent-mission-control'
import {
  buildAgentGovernanceClientExport,
  formatAgentGovernanceClientMarkdown,
} from '@/lib/agent-governance-export'
import { buildScopedAgentGovernanceSnapshot, parseAgentGovernanceExportScope } from '@/lib/agent-governance-scope'

export const dynamic = 'force-dynamic'

function exportFilename(extension: 'json' | 'md') {
  return `agent-governance-audit-${new Date().toISOString().slice(0, 10)}.${extension}`
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') === 'markdown' ? 'markdown' : 'json'
    const parsedScope = parseAgentGovernanceExportScope(searchParams)
    if (parsedScope.errors.length > 0) {
      return NextResponse.json({ error: parsedScope.errors.join('; ') }, { status: 400 })
    }

    const scoped = parsedScope.has_scope
      ? await buildScopedAgentGovernanceSnapshot(parsedScope.scope)
      : null
    const governance = scoped?.governance ?? (await buildAgentMissionControlSnapshot()).governance
    const clientExport = buildAgentGovernanceClientExport(governance, scoped?.scope ?? parsedScope.scope)

    if (format === 'markdown') {
      return new NextResponse(formatAgentGovernanceClientMarkdown(clientExport), {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${exportFilename('md')}"`,
        },
      })
    }

    return NextResponse.json(
      { ok: true, export: clientExport },
      {
        headers: {
          'Content-Disposition': `attachment; filename="${exportFilename('json')}"`,
        },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to export agent governance audit'
    console.error('[agent-governance-export] export failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
