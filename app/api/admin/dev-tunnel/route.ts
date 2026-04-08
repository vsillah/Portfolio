import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { exec, spawn, ChildProcess } from 'child_process'
import { promisify } from 'util'

export const dynamic = 'force-dynamic'

const execAsync = promisify(exec)

const TUNNEL_CONFIG = `${process.env.HOME}/.cloudflared/dev-portfolio-config.yml`
const TUNNEL_HOSTNAME = process.env.N8N_CALLBACK_BASE_URL || 'https://dev.amadutown.com'

let tunnelProcess: ChildProcess | null = null

async function isTunnelUp(): Promise<boolean> {
  try {
    const res = await fetch(TUNNEL_HOSTNAME, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    })
    return res.ok || res.status === 404
  } catch {
    return false
  }
}

async function isCloudflaredRunning(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('pgrep -f "cloudflared tunnel.*dev-portfolio"')
    return stdout.trim().length > 0
  } catch {
    return false
  }
}

async function startTunnel(): Promise<{ started: boolean; message: string }> {
  if (await isTunnelUp()) {
    return { started: true, message: 'Tunnel already running and reachable' }
  }

  if (await isCloudflaredRunning()) {
    const up = await isTunnelUp()
    return {
      started: up,
      message: up ? 'Tunnel process running and reachable' : 'Tunnel process running but not yet reachable — may still be connecting',
    }
  }

  try {
    await execAsync(`which cloudflared`)
  } catch {
    return { started: false, message: 'cloudflared not found in PATH' }
  }

  try {
    tunnelProcess = spawn('cloudflared', ['tunnel', '--config', TUNNEL_CONFIG, 'run', 'dev-portfolio'], {
      detached: true,
      stdio: 'ignore',
    })
    tunnelProcess.unref()

    // Wait up to 8 seconds for the tunnel to become reachable
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 1000))
      if (await isTunnelUp()) {
        return { started: true, message: 'Tunnel started successfully' }
      }
    }

    return { started: false, message: 'Tunnel process started but not reachable yet — check cloudflared logs' }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { started: false, message: `Failed to start tunnel: ${msg}` }
  }
}

async function stopTunnel(): Promise<{ stopped: boolean; message: string }> {
  try {
    await execAsync('pkill -f "cloudflared tunnel.*dev-portfolio"')
    tunnelProcess = null
    return { stopped: true, message: 'Tunnel stopped' }
  } catch {
    return { stopped: true, message: 'No tunnel process found to stop' }
  }
}

/**
 * GET  /api/admin/dev-tunnel — check tunnel status
 * POST /api/admin/dev-tunnel — { action: 'start' | 'stop' | 'ensure' }
 *
 * Only available in development. Returns 404 in production.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const [up, processRunning] = await Promise.all([isTunnelUp(), isCloudflaredRunning()])

  return NextResponse.json({
    status: up ? 'connected' : processRunning ? 'connecting' : 'disconnected',
    hostname: TUNNEL_HOSTNAME,
    processRunning,
    reachable: up,
  })
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  const { action } = body as { action?: string }

  switch (action) {
    case 'start':
    case 'ensure': {
      const result = await startTunnel()
      return NextResponse.json(result)
    }
    case 'stop': {
      const result = await stopTunnel()
      return NextResponse.json(result)
    }
    default:
      return NextResponse.json({ error: 'action must be "start", "stop", or "ensure"' }, { status: 400 })
  }
}
