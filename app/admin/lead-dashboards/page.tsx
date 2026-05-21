'use client'

import { useEffect, useState } from 'react'
import { Copy, ExternalLink, LayoutDashboard, Loader2 } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import { ViewDiagnosticLink } from '@/components/admin/ViewDiagnosticLink'

const LEAD_DASHBOARDS_RETURN_PATH = '/admin/lead-dashboards'

interface LeadDashboardRow {
  id: string
  diagnostic_audit_id: string | null
  client_email: string
  access_token: string
  created_at: string
  last_accessed_at: string | null
  url: string
}

export default function LeadDashboardsPage() {
  const [list, setList] = useState<LeadDashboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchList() {
      const session = await getCurrentSession()
      if (!session?.access_token) {
        setError('Not authenticated')
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/lead-dashboards', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to load lead dashboards')
        }
        const data = await res.json()
        if (!cancelled) setList(Array.isArray(data) ? data : [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchList()
    return () => { cancelled = true }
  }, [])

  const handleCopy = (url: string, id: string) => {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <ProtectedRoute>
      <div className="admin-console-page min-h-screen px-4 py-6 text-foreground sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <Breadcrumbs
            items={[
              { label: 'Admin', href: '/admin' },
              { label: 'Lead dashboards', href: '/admin/lead-dashboards' },
            ]}
          />
          <div className="admin-console-surface-header mt-4 mb-6 flex items-center gap-3 rounded-xl border p-5 sm:p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-radiant-gold/25 bg-radiant-gold/12 text-radiant-gold">
              <LayoutDashboard className="w-7 h-7" />
            </div>
            <div>
              <div className="admin-console-eyebrow mb-2">Sales Enablement</div>
              <h1 className="text-3xl font-bold text-foreground">Lead Dashboards</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Share these links with leads after they complete the diagnostic. Same link works after they convert to clients.
              </p>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-radiant-gold" />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && list.length === 0 && (
            <div className="admin-console-card rounded-lg border p-8 text-center text-muted-foreground">
              No lead dashboards yet. Create one from a completed diagnostic (Sales → open audit → Share lead dashboard).
            </div>
          )}

          {!loading && !error && list.length > 0 && (
            <div className="admin-console-card rounded-lg border overflow-hidden">
              <table className="w-full text-left">
                <thead className="border-b border-white/10 bg-background/50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Client email</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Diagnostic</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Last accessed</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-48">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {list.map((row) => (
                    <tr key={row.id} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-sm text-foreground">{row.client_email}</td>
                      <td className="px-4 py-3 text-sm">
                        {row.diagnostic_audit_id ? (
                          <div className="flex flex-col gap-1 items-start">
                            <ViewDiagnosticLink
                              auditId={row.diagnostic_audit_id}
                              returnPath={LEAD_DASHBOARDS_RETURN_PATH}
                            />
                            <span className="text-xs text-muted-foreground font-mono truncate max-w-[12rem]" title={row.diagnostic_audit_id}>
                              {row.diagnostic_audit_id}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {row.last_accessed_at ? new Date(row.last_accessed_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy(row.url, row.id)}
                            className="admin-console-button-muted px-2.5 py-1.5 text-xs"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            {copiedId === row.id ? 'Copied' : 'Copy link'}
                          </button>
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="admin-console-button-secondary px-2.5 py-1.5 text-xs"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open as lead
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
