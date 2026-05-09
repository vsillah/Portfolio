'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Database, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react'
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
  nextAction: string
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
  bySource: Record<string, number>
  byRisk: Record<string, number>
  byRuntimeSink: Record<string, number>
  blockers: string[]
  rows: CredentialReportRow[]
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
  const [env, setEnv] = useState<CredentialEnv>('staging')
  const [report, setReport] = useState<CredentialReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

function StatusPill({ status }: { status: CredentialReportRow['status'] }) {
  const classes = status === 'ok'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
    : status === 'due'
      ? 'border-red-500/30 bg-red-500/10 text-red-200'
      : 'border-amber-500/30 bg-amber-500/10 text-amber-200'

  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${classes}`}>{status}</span>
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
