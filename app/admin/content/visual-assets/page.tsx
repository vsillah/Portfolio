'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Check, ImageIcon, Loader2, RefreshCw, Search, Sparkles, X } from 'lucide-react'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getCurrentSession } from '@/lib/auth'
import type { VisualAssetCandidate, VisualAssetStatus, VisualAssetTheme } from '@/lib/visual-assets'

const STATUSES: Array<VisualAssetStatus | 'all'> = ['all', 'proposed', 'approved', 'rejected', 'applied', 'failed']
const THEMES: Array<VisualAssetTheme | 'all'> = ['all', 'dark', 'light']
const ENTITY_TYPES = ['all', 'product', 'service', 'prototype'] as const

function pillClass(active: boolean) {
  return `rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
    active
      ? 'border-radiant-gold/50 bg-radiant-gold/15 text-radiant-gold'
      : 'border-radiant-gold/10 text-muted-foreground hover:border-radiant-gold/30 hover:text-foreground'
  }`
}

function ScoreBadge({ score }: { score: number | null }) {
  const tone = score == null ? 'text-muted-foreground border-muted-foreground/20' : score >= 76 ? 'text-emerald-300 border-emerald-400/30' : score >= 50 ? 'text-amber-300 border-amber-400/30' : 'text-rose-300 border-rose-400/30'
  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {score == null ? 'No score' : `${score}/100`}
    </span>
  )
}

function CandidateImage({ url, label }: { url: string | null; label: string }) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-lg border border-radiant-gold/10 bg-background/70">
      {url ? (
        <Image src={url} alt={label} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 420px" />
      ) : (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <ImageIcon size={36} />
        </div>
      )}
    </div>
  )
}

export default function VisualAssetsReviewPage() {
  const [candidates, setCandidates] = useState<VisualAssetCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState<VisualAssetStatus | 'all'>('proposed')
  const [theme, setTheme] = useState<VisualAssetTheme | 'all'>('all')
  const [entityType, setEntityType] = useState<(typeof ENTITY_TYPES)[number]>('all')
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const fetchCandidates = async () => {
    setLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const params = new URLSearchParams()
      if (status !== 'all') params.set('status', status)
      if (theme !== 'all') params.set('theme', theme)
      if (entityType !== 'all') params.set('entity_type', entityType)
      const response = await fetch(`/api/admin/visual-assets/candidates?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await response.json()
      setCandidates(Array.isArray(data.candidates) ? data.candidates : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCandidates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, theme, entityType])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter((candidate) => (
      candidate.title.toLowerCase().includes(q) ||
      candidate.entity_type.includes(q) ||
      candidate.reason_codes.some((reason) => reason.includes(q))
    ))
  }, [candidates, query])

  const postAction = async (path: string, body: Record<string, unknown> = {}) => {
    const session = await getCurrentSession()
    if (!session) return
    setBusy(path)
    setMessage(null)
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Request failed')
      setMessage(data.applied != null ? `Applied ${data.applied}; failed ${data.failed}.` : 'Updated.')
      await fetchCandidates()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <ProtectedRoute requireAdmin>
      <main id="admin-main" className="min-h-screen bg-background px-6 py-8 text-foreground">
        <Breadcrumbs items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Content', href: '/admin/content' },
          { label: 'Visual Assets' },
        ]} />

        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-radiant-gold">Idia</p>
            <h1 className="mt-2 text-3xl font-premium text-foreground">Homepage Visual Assets</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Review theme-specific screenshot candidates for homepage products and services before public images change.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="agent-ops-button-secondary"
              disabled={Boolean(busy)}
              onClick={() => postAction('/api/admin/visual-assets/audit', {})}
            >
              {busy?.includes('/audit') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Audit
            </button>
            <button
              className="agent-ops-button-secondary"
              disabled={Boolean(busy)}
              onClick={() => postAction('/api/admin/visual-assets/capture', {})}
            >
              {busy?.includes('/capture') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Capture
            </button>
            <button
              className="agent-ops-button-primary"
              disabled={Boolean(busy)}
              onClick={() => postAction('/api/admin/visual-assets/apply-approved', {})}
            >
              {busy?.includes('/apply-approved') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Apply Approved
            </button>
          </div>
        </div>

        <section className="mb-6 rounded-xl border border-radiant-gold/10 bg-silicon-slate/25 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((item) => (
                <button key={item} className={pillClass(status === item)} onClick={() => setStatus(item)}>
                  {item}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {THEMES.map((item) => (
                <button key={item} className={pillClass(theme === item)} onClick={() => setTheme(item)}>
                  {item}
                </button>
              ))}
              {ENTITY_TYPES.map((item) => (
                <button key={item} className={pillClass(entityType === item)} onClick={() => setEntityType(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-radiant-gold/10 bg-background/60 px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, type, or reason"
              className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button className="text-muted-foreground hover:text-foreground" onClick={fetchCandidates} aria-label="Refresh candidates">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
        </section>

        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading candidates
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-radiant-gold/10 bg-silicon-slate/20 p-10 text-center text-muted-foreground">
            No candidates match the current filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {filtered.map((candidate) => (
              <article key={candidate.id} className="rounded-xl border border-radiant-gold/10 bg-silicon-slate/25 p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span className="rounded-full border border-radiant-gold/20 px-2.5 py-1 text-xs uppercase text-radiant-gold">{candidate.entity_type}</span>
                      <span className="rounded-full border border-cyan-400/20 px-2.5 py-1 text-xs uppercase text-cyan-200">{candidate.theme}</span>
                      <span className="rounded-full border border-muted-foreground/20 px-2.5 py-1 text-xs uppercase text-muted-foreground">{candidate.status}</span>
                    </div>
                    <h2 className="text-lg font-semibold text-foreground">{candidate.title}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{candidate.capture_route}</p>
                  </div>
                  <ScoreBadge score={candidate.score} />
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current</p>
                    <CandidateImage url={candidate.current_url} label={`${candidate.title} current`} />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Candidate</p>
                    <CandidateImage url={candidate.candidate_url} label={`${candidate.title} candidate`} />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {candidate.reason_codes.map((reason) => (
                    <span key={reason} className="rounded-full bg-background/70 px-2.5 py-1 text-xs text-muted-foreground">
                      {reason.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    className="agent-ops-button-secondary"
                    disabled={Boolean(busy) || candidate.status === 'rejected'}
                    onClick={() => postAction(`/api/admin/visual-assets/${candidate.id}/reject`)}
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </button>
                  <button
                    className="agent-ops-button-primary"
                    disabled={Boolean(busy) || !candidate.candidate_url || candidate.status === 'approved'}
                    onClick={() => postAction(`/api/admin/visual-assets/${candidate.id}/approve`)}
                  >
                    <Check className="h-4 w-4" />
                    Approve
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </ProtectedRoute>
  )
}
