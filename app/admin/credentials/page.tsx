'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Database, ExternalLink, KeyRound, Loader2, Mail, RefreshCw, ShieldCheck, Unplug } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'

type CredentialEnv = 'dev' | 'staging' | 'prod'

type CredentialReportRow = {
  id: string
  envVar: string
  displayName: string
  risk: string
  sourceOfTruth: 'infisical' | '1password'
  cadenceDays: number
  approvalRequired: boolean
  baselineStatus: string
  lastRotatedAt: string | null
  dueAt: string | null
  status: 'needs-baseline' | 'due' | 'ok'
  sinkPresence: Array<{
    sink: string
    status: 'present' | 'missing' | 'unknown' | 'unavailable'
    evidence: string
    checkedAt: string
  }>
  sinkPresenceSummary: CredentialSinkPresenceSummary
  nextAction: string
}

type CredentialSinkPresenceSummary = {
  present: number
  missing: number
  unknown: number
  unavailable: number
}

type CredentialReport = {
  generatedAt: string
  env: CredentialEnv
  asOf: string
  sourceBoundary: string
  providerContext: {
    infisicalProject: string
    infisicalPath: string
    onePasswordVault: string
  }
  summary: {
    total: number
    ok: number
    due: number
    needsBaseline: number
    approvalRequired: number
    providerConfirmed: number
    providerPending: number
  }
  sinkPresenceSummary: CredentialSinkPresenceSummary
  bySource: Record<string, number>
  byRisk: Record<string, number>
  byRuntimeSink: Record<string, number>
  packetSummary: {
    total: number
    drafted: number
    synced: number
    verified: number
    revocationPending: number
    blocked: number
    latestCreatedAt: string | null
  }
  packets: Array<{
    createdAt: string
    type: 'rotation' | 'runtime-sync'
    envVar: string
    status: 'drafted' | 'synced' | 'verified' | 'revocation-pending' | 'blocked'
    approvalRequired: boolean
    localEnvUpdated: boolean
  }>
  sinkGapActions: Array<{
    secretId: string
    envVar: string
    sink: string
    status: 'missing' | 'unknown' | 'unavailable'
    action: string
    evidence: string
  }>
  blockers: string[]
  rows: CredentialReportRow[]
}

type GmailConnectionStatus = {
  connected: boolean
  googleEmail: string | null
  configured: boolean
  requiredSender: string
}

const ENVS: CredentialEnv[] = ['dev', 'staging', 'prod']

export default function CredentialAdminPage() {
  return (
    <ProtectedRoute requireAdmin>
      <CredentialAdminContent />
    </ProtectedRoute>
  )
}

function CredentialAdminContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [env, setEnv] = useState<CredentialEnv>('staging')
  const [report, setReport] = useState<CredentialReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gmailStatus, setGmailStatus] = useState<GmailConnectionStatus | null>(null)
  const [gmailLoading, setGmailLoading] = useState(true)
  const [gmailActionLoading, setGmailActionLoading] = useState(false)
  const [gmailError, setGmailError] = useState<string | null>(null)
  const [gmailNotice, setGmailNotice] = useState<string | null>(null)

  const loadReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const response = await fetch(`/api/admin/credentials/report?env=${env}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setReport(body)
    } catch (err) {
      setReport(null)
      setError(err instanceof Error ? err.message : 'Failed to load credential report')
    } finally {
      setLoading(false)
    }
  }, [env])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const loadGmailStatus = useCallback(async () => {
    setGmailLoading(true)
    setGmailError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const response = await fetch('/api/admin/oauth/google-gmail/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setGmailStatus({
        connected: Boolean(body.connected),
        googleEmail: typeof body.googleEmail === 'string' ? body.googleEmail : null,
        configured: Boolean(body.configured),
        requiredSender: typeof body.requiredSender === 'string' ? body.requiredSender : 'vambah@amadutown.com',
      })
    } catch (err) {
      setGmailStatus(null)
      setGmailError(err instanceof Error ? err.message : 'Failed to load Gmail connection status')
    } finally {
      setGmailLoading(false)
    }
  }, [])

  useEffect(() => {
    loadGmailStatus()
  }, [loadGmailStatus])

  useEffect(() => {
    const connected = searchParams?.get('gmail_connected')
    const oauthError = searchParams?.get('gmail_oauth_error')
    if (connected !== '1' && oauthError == null) return

    if (connected === '1') {
      setGmailNotice('Gmail connected. Portfolio can now create approval-held Gmail drafts for outreach replies.')
      void loadGmailStatus()
    } else if (oauthError) {
      const messages: Record<string, string> = {
        '1': 'Gmail connection did not finish. Try Connect Gmail again.',
        state: 'That sign-in link expired. Start the Gmail connection again.',
        config: 'Gmail connection is not set up on the server.',
        refresh:
          'Google did not return a refresh token. Remove this app from Google Account third-party access, then connect again.',
        email: 'Could not read the Google account email. Try reconnecting.',
        save: 'Could not save the Gmail connection. Try again.',
      }
      setGmailError(messages[oauthError] ?? messages['1'])
    }

    router.replace('/admin/credentials#gmail-profile')
  }, [loadGmailStatus, router, searchParams])

  const connectGmail = useCallback(async () => {
    setGmailActionLoading(true)
    setGmailError(null)
    setGmailNotice(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const response = await fetch('/api/admin/oauth/google-gmail/start', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      if (typeof body.url !== 'string' || body.url.length === 0) {
        throw new Error('Gmail connection did not return a Google sign-in URL')
      }
      window.location.assign(body.url)
    } catch (err) {
      setGmailError(err instanceof Error ? err.message : 'Failed to start Gmail connection')
      setGmailActionLoading(false)
    }
  }, [])

  const disconnectGmail = useCallback(async () => {
    const ok = window.confirm('Disconnect this Gmail profile from Portfolio draft creation?')
    if (!ok) return

    setGmailActionLoading(true)
    setGmailError(null)
    setGmailNotice(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const response = await fetch('/api/admin/oauth/google-gmail/disconnect', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setGmailNotice('Gmail disconnected from Portfolio draft creation.')
      await loadGmailStatus()
    } catch (err) {
      setGmailError(err instanceof Error ? err.message : 'Failed to disconnect Gmail')
    } finally {
      setGmailActionLoading(false)
    }
  }, [loadGmailStatus])

  const posture = useMemo(() => {
    if (!report) return { label: 'Unknown', tone: 'slate' }
    if (report.summary.due > 0) return { label: 'Rotation due', tone: 'red' }
    if (report.summary.needsBaseline > 0) return { label: 'Baseline needed', tone: 'amber' }
    return { label: 'Current', tone: 'green' }
  }, [report])

  return (
    <div className="min-h-screen bg-background text-foreground p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Credential Reporting' },
        ]} />

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1">Credential Reporting</h1>
            <p className="text-muted-foreground text-sm max-w-3xl">
              Rotation visibility for the Portfolio credential inventory. Values are never loaded or displayed here.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-silicon-slate bg-silicon-slate/30 p-1">
              {ENVS.map((item) => (
                <button
                  key={item}
                  onClick={() => setEnv(item)}
                  className={`rounded-md px-3 py-1.5 text-sm ${env === item ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {item}
                </button>
              ))}
            </div>
            <button
              onClick={loadReport}
              className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate bg-silicon-slate/30 px-3 py-2 text-sm hover:bg-silicon-slate"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        <GmailConnectionPanel
          status={gmailStatus}
          loading={gmailLoading}
          actionLoading={gmailActionLoading}
          error={gmailError}
          notice={gmailNotice}
          onConnect={connectGmail}
          onDisconnect={disconnectGmail}
          onRefresh={loadGmailStatus}
        />

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">Loading...</div>
        ) : error ? (
          <Notice title="Credential report unavailable" body={error} tone="red" />
        ) : report ? (
          <>
            <section className="mb-6 rounded-lg border border-silicon-slate bg-silicon-slate/30 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <ShieldCheck size={16} />
                    <span>{report.providerContext.infisicalProject}:{report.providerContext.infisicalPath}</span>
                    <span>/</span>
                    <span>{report.providerContext.onePasswordVault}</span>
                  </div>
                  <h2 className="text-2xl font-semibold">{posture.label}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Generated {new Date(report.generatedAt).toLocaleString()}</p>
                </div>
                <div className={`rounded-lg border px-4 py-3 text-sm ${posture.tone === 'red' ? 'border-red-500/40 bg-red-500/10 text-red-200' : posture.tone === 'amber' ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'}`}>
                  {report.summary.needsBaseline} need baseline / {report.summary.due} due / {report.summary.ok} ok
                </div>
              </div>
            </section>

            <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
              <Metric icon={<KeyRound size={18} />} label="Tracked" value={report.summary.total} />
              <Metric icon={<CheckCircle2 size={18} />} label="OK" value={report.summary.ok} />
              <Metric icon={<Clock3 size={18} />} label="Due" value={report.summary.due} />
              <Metric icon={<AlertTriangle size={18} />} label="Need baseline" value={report.summary.needsBaseline} />
            </section>

            <section className="mb-6 rounded-lg border border-silicon-slate bg-silicon-slate/30 p-4">
              <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <h2 className="font-semibold">Runtime sink presence</h2>
                <p className="text-xs text-muted-foreground">Name-only checks; values are not read or displayed.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <MiniMetric label="Present" value={report.sinkPresenceSummary.present} />
                <MiniMetric label="Missing" value={report.sinkPresenceSummary.missing} />
                <MiniMetric label="Unknown" value={report.sinkPresenceSummary.unknown} />
                <MiniMetric label="Unavailable" value={report.sinkPresenceSummary.unavailable} />
              </div>
            </section>

            {report.blockers.length > 0 && (
              <section className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-100">
                  <AlertTriangle size={16} />
                  Visibility blockers
                </h2>
                <ul className="space-y-1 text-sm text-amber-50/90">
                  {report.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                </ul>
              </section>
            )}

            <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Breakdown title="Sources" rows={report.bySource} />
              <Breakdown title="Risk" rows={report.byRisk} />
              <Breakdown title="Runtime Sinks" rows={report.byRuntimeSink} />
            </section>

            <section className="mb-6 rounded-lg border border-silicon-slate bg-silicon-slate/30 p-4">
              <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <h2 className="font-semibold">Runtime sink gap actions</h2>
                <p className="text-xs text-muted-foreground">Actionable visibility gaps without secret values.</p>
              </div>
              {report.sinkGapActions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-silicon-slate text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2">Secret</th>
                        <th className="px-2 py-2">Sink</th>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-silicon-slate">
                      {report.sinkGapActions.slice(0, 10).map((gap) => (
                        <tr key={`${gap.envVar}-${gap.sink}-${gap.status}`}>
                          <td className="px-2 py-2 font-mono text-xs">{gap.envVar}</td>
                          <td className="px-2 py-2">{gap.sink}</td>
                          <td className="px-2 py-2">{gap.status}</td>
                          <td className="px-2 py-2 text-muted-foreground">{gap.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No runtime sink gaps found.</p>
              )}
            </section>

            <section className="mb-6 rounded-lg border border-silicon-slate bg-silicon-slate/30 p-4">
              <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <h2 className="font-semibold">Rotation packets</h2>
                <div className="text-xs text-muted-foreground">
                  Latest: {report.packetSummary.latestCreatedAt ? new Date(report.packetSummary.latestCreatedAt).toLocaleString() : 'none'}
                </div>
              </div>
              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                <MiniMetric label="Drafted" value={report.packetSummary.drafted} />
                <MiniMetric label="Synced" value={report.packetSummary.synced} />
                <MiniMetric label="Verified" value={report.packetSummary.verified} />
                <MiniMetric label="Revocation" value={report.packetSummary.revocationPending} />
                <MiniMetric label="Blocked" value={report.packetSummary.blocked} />
              </div>
              {report.packets.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-silicon-slate text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2">Created</th>
                        <th className="px-2 py-2">Type</th>
                        <th className="px-2 py-2">Secret</th>
                        <th className="px-2 py-2">Approval</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-silicon-slate">
                      {report.packets.slice(0, 8).map((packet) => (
                        <tr key={`${packet.createdAt}-${packet.envVar}-${packet.type}`}>
                          <td className="px-2 py-2">{packet.status}</td>
                          <td className="px-2 py-2">{new Date(packet.createdAt).toLocaleString()}</td>
                          <td className="px-2 py-2">{packet.type}</td>
                          <td className="px-2 py-2 font-mono text-xs">{packet.envVar}</td>
                          <td className="px-2 py-2">{packet.approvalRequired ? 'required' : 'not required'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No local rotation packets found.</p>
              )}
            </section>

            <section className="overflow-hidden rounded-lg border border-silicon-slate">
              <div className="border-b border-silicon-slate bg-silicon-slate/40 px-4 py-3">
                <h2 className="font-semibold">Rotation inventory</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-silicon-slate text-sm">
                  <thead className="bg-silicon-slate/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Secret</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Runtime sinks</th>
                      <th className="px-4 py-3">Cadence</th>
                      <th className="px-4 py-3">Due</th>
                      <th className="px-4 py-3">Next action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-silicon-slate">
                    {report.rows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3"><StatusPill status={row.status} /></td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs">{row.envVar}</div>
                          <div className="text-xs text-muted-foreground">{row.displayName}</div>
                        </td>
                        <td className="px-4 py-3">{row.sourceOfTruth}</td>
                        <td className="px-4 py-3"><SinkPresenceBadges observations={row.sinkPresence} /></td>
                        <td className="px-4 py-3">{row.cadenceDays}d</td>
                        <td className="px-4 py-3">{row.dueAt ?? 'unknown'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.nextAction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}

function GmailConnectionPanel({
  status,
  loading,
  actionLoading,
  error,
  notice,
  onConnect,
  onDisconnect,
  onRefresh,
}: {
  status: GmailConnectionStatus | null
  loading: boolean
  actionLoading: boolean
  error: string | null
  notice: string | null
  onConnect: () => void
  onDisconnect: () => void
  onRefresh: () => void
}) {
  const connectedEmail = status?.googleEmail?.trim() ?? null
  const expectedSender = status?.requiredSender ?? 'vambah@amadutown.com'
  const senderMatches = Boolean(connectedEmail && connectedEmail.toLowerCase() === expectedSender.toLowerCase())

  return (
    <section id="gmail-profile" className="mb-6 scroll-mt-24 rounded-lg border border-silicon-slate bg-silicon-slate/30 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Mail size={16} />
            Customer-facing Gmail profile
          </div>
          <h2 className="text-xl font-semibold">Portfolio Gmail drafts</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Connect the Google account Portfolio should use when creating approval-held outreach reply drafts.
            Customer-facing drafts are allowed only from {expectedSender}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading || actionLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate bg-background/40 px-3 py-2 text-sm hover:bg-silicon-slate disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={onConnect}
            disabled={loading || actionLoading || status?.configured === false}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
            {connectedEmail ? 'Reconnect Gmail' : 'Connect Gmail'}
          </button>
          {connectedEmail && (
            <button
              type="button"
              onClick={onDisconnect}
              disabled={loading || actionLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Unplug size={16} />
              Disconnect
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <StatusTile
          label="Server OAuth setup"
          value={loading ? 'Checking...' : status?.configured ? 'Configured' : 'Not configured'}
        />
        <div className="rounded-lg border border-silicon-slate bg-background/40 px-3 py-2">
          <div className="text-xs text-muted-foreground">Connected account</div>
          <div className="mt-1 break-all text-sm font-semibold">{loading ? 'Checking...' : connectedEmail ?? 'Not connected'}</div>
        </div>
        <div className={`rounded-lg border px-3 py-2 ${senderMatches ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : connectedEmail ? 'border-red-500/30 bg-red-500/10 text-red-100' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}>
          <div className="text-xs opacity-80">Draft sender gate</div>
          <div className="mt-1 text-sm font-semibold">
            {senderMatches ? 'Ready for customer-facing drafts' : connectedEmail ? `Reconnect as ${expectedSender}` : `Needs ${expectedSender}`}
          </div>
        </div>
      </div>

      {status?.configured === false && (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Gmail OAuth is not configured for this site yet. Add the Google Gmail OAuth client env vars and encryption secret before connecting.
        </p>
      )}
      {notice && (
        <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{notice}</p>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p>
      )}
    </section>
  )
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-silicon-slate bg-background/40 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  )
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-silicon-slate bg-silicon-slate/30 p-4">
      <div className="mb-3 flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-3xl font-semibold">{value}</div>
    </div>
  )
}

function Breakdown({ title, rows }: { title: string; rows: Record<string, number> }) {
  return (
    <div className="rounded-lg border border-silicon-slate bg-silicon-slate/30 p-4">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <Database size={16} />
        {title}
      </h2>
      <div className="space-y-2">
        {Object.entries(rows).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{key}</span>
            <span className="font-mono">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-silicon-slate bg-background/40 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  )
}

function StatusPill({ status }: { status: CredentialReportRow['status'] }) {
  const classes = status === 'ok'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
    : status === 'due'
      ? 'border-red-500/30 bg-red-500/10 text-red-200'
      : 'border-amber-500/30 bg-amber-500/10 text-amber-200'

  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${classes}`}>{status}</span>
}

function SinkPresenceBadges({ observations }: { observations: CredentialReportRow['sinkPresence'] }) {
  if (observations.length === 0) return <span className="text-xs text-muted-foreground">not checked</span>

  return (
    <div className="flex min-w-44 flex-wrap gap-1">
      {observations.map((observation) => (
        <span
          key={`${observation.sink}-${observation.status}`}
          title={observation.evidence}
          className={`inline-flex rounded-full border px-2 py-1 text-xs ${sinkPresenceClass(observation.status)}`}
        >
          {observation.sink}: {observation.status}
        </span>
      ))}
    </div>
  )
}

function sinkPresenceClass(status: CredentialReportRow['sinkPresence'][number]['status']) {
  if (status === 'present') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  if (status === 'missing') return 'border-red-500/30 bg-red-500/10 text-red-200'
  if (status === 'unavailable') return 'border-slate-500/30 bg-slate-500/10 text-slate-200'
  return 'border-amber-500/30 bg-amber-500/10 text-amber-200'
}

function Notice({ title, body, tone }: { title: string; body: string; tone: 'red' | 'amber' }) {
  const classes = tone === 'red' ? 'border-red-500/40 bg-red-500/10 text-red-100' : 'border-amber-500/40 bg-amber-500/10 text-amber-100'
  return (
    <div className={`rounded-lg border p-4 ${classes}`}>
      <h2 className="mb-1 font-semibold">{title}</h2>
      <p className="text-sm opacity-90">{body}</p>
    </div>
  )
}
