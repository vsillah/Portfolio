'use client'

import { useEffect, useState } from 'react'
import { Copy, ExternalLink, LayoutDashboard, Loader2 } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'

interface LeadDashboardRow {
  id: string
  diagnostic_audit_id: number
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
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Breadcrumbs
            items={[
              { label: 'Admin', href: '/admin' },
              { label: 'Lead dashboards', href: '/admin/lead-dashboards' },
            ]}
          />
          <div className="flex items-center gap-3 mt-4 mb-6">
            <LayoutDashboard className="w-8 h-8 text-radiant-gold" />
            <div>
              <h1 className="text-xl font-bold gradient-text">Lead dashboards</h1>
              <p className="text-sm text-platinum-white/80">
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
            <div className="rounded-xl border border-silicon-slate bg-silicon-slate/50 p-8 text-center text-platinum-white/80">
              No lead dashboards yet. Create one from a completed diagnostic (Sales → open audit → Share lead dashboard).
            </div>
          )}

          {!loading && !error && list.length > 0 && (
            <div className="rounded-xl border border-silicon-slate overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-silicon-slate border-b border-silicon-slate">
                  <tr>
                    <th className="px-4 py-3 text-xs font-medium text-platinum-white/80 uppercase tracking-wider">Client email</th>
                    <th className="px-4 py-3 text-xs font-medium text-platinum-white/80 uppercase tracking-wider">Diagnostic ID</th>
                    <th className="px-4 py-3 text-xs font-medium text-platinum-white/80 uppercase tracking-wider">Created</th>
                    <th className="px-4 py-3 text-xs font-medium text-platinum-white/80 uppercase tracking-wider">Last accessed</th>
                    <th className="px-4 py-3 text-xs font-medium text-platinum-white/80 uppercase tracking-wider w-48">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-silicon-slate">
                  {list.map((row) => (
                    <tr key={row.id} className="bg-silicon-slate/30 hover:bg-silicon-slate/50">
                      <td className="px-4 py-3 text-sm text-platinum-white">{row.client_email}</td>
                      <td className="px-4 py-3 text-sm text-platinum-white/60 font-mono">{row.diagnostic_audit_id}</td>
                      <td className="px-4 py-3 text-sm text-platinum-white/60">
                        {row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-platinum-white/60">
                        {row.last_accessed_at ? new Date(row.last_accessed_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy(row.url, row.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg btn-ghost text-xs"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            {copiedId === row.id ? 'Copied' : 'Copy link'}
                          </button>
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-radiant-gold/20 border border-radiant-gold/50 text-radiant-gold text-xs hover:bg-radiant-gold/30"
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
