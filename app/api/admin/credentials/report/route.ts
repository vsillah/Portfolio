import { readFile } from 'node:fs/promises'
import * as path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  buildCredentialReport,
  isCredentialEnvironment,
  type CredentialInventory,
} from '@/lib/credential-report'

export const dynamic = 'force-dynamic'

const INVENTORY_PATH = path.join(process.cwd(), 'docs', 'credential-inventory.json')

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const env = searchParams.get('env') || 'staging'
  const asOf = searchParams.get('asOf') || new Date().toISOString()

  if (!isCredentialEnvironment(env)) {
    return NextResponse.json({ error: 'Invalid env. Expected dev, staging, or prod.' }, { status: 400 })
  }

  try {
    const inventory = JSON.parse(await readFile(INVENTORY_PATH, 'utf8')) as CredentialInventory
    return NextResponse.json(buildCredentialReport(inventory, env, asOf))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to build credential report' },
      { status: 500 }
    )
  }
}
