'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  ShieldCheck,
  TerminalSquare,
  UploadCloud,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import { agentifiedLaunchSummary } from '@/lib/agentified-launch-campaign'
import { agentifiedPublication } from '@/lib/agentified-publication'

const draftLinks = [
  { label: 'Production draft', path: agentifiedPublication.productionDraftPath },
  { label: 'Workbook-enhanced draft', path: agentifiedPublication.workbookDraftPath },
  { label: 'Workbook source', path: agentifiedPublication.workbookPath },
  { label: 'Blueprint', path: agentifiedPublication.blueprintPath },
  { label: 'Fable 5 handoff', path: agentifiedPublication.fableHandoffPath },
]

const campaignSummary = agentifiedLaunchSummary()

type ImportResult = {
  ok: boolean
  campaign?: {
    id: string
    slug: string
    created: boolean
    updated: boolean
  }
  work_items?: {
    total: number
    ids: string[]
  }
  calendar_items?: {
    inserted_count: number
    updated_count: number
    total: number
  }
  review_links?: {
    content_intelligence: string
    campaign_calendar: string
    agentified_admin: string
  }
  error?: string
}

export default function AgentifiedAdminPage() {
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const importLaunchBacklog = async () => {
    setImporting(true)
    setImportError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Admin session is required')
      const response = await fetch('/api/admin/content/agentified/campaign/import', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${session.access_token}`,
          'content-type': 'application/json',
        },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Failed to import launch backlog')
      setImportResult(data)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Failed to import launch backlog')
    } finally {
      setImporting(false)
    }
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="admin-console-page min-h-screen px-4 py-6 text-foreground sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Breadcrumbs items={[
            { label: 'Admin Dashboard', href: '/admin' },
            { label: 'Content Management', href: '/admin/content' },
            { label: 'Agentified' },
          ]} />

          <header className="admin-console-surface-header mb-6 rounded-xl border p-5 sm:p-6">
            <div className="admin-console-eyebrow mb-2">Publication workspace</div>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">{agentifiedPublication.title}</h1>
                <p className="mt-2 max-w-3xl text-lg text-radiant-gold">{agentifiedPublication.longSubtitle}</p>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {agentifiedPublication.description}
                </p>
              </div>
              <Link
                href={agentifiedPublication.route}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-radiant-gold/30 px-4 py-2 text-sm text-radiant-gold transition hover:bg-radiant-gold/10"
              >
                <ExternalLink size={16} />
                Public page
              </Link>
            </div>
          </header>

          <section className="admin-console-card mb-6 rounded-lg border p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2 text-radiant-gold">
                  <CalendarDays size={18} />
                  <h2 className="text-lg font-semibold text-foreground">Launch campaign backlog</h2>
                </div>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  Import the prepared Agentified whisper-to-shout packet into the central Agent Ops backlog and campaign calendar.
                  This creates reviewable internal records only.
                </p>
              </div>
              <button
                type="button"
                onClick={importLaunchBacklog}
                disabled={importing}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-radiant-gold/50 px-4 py-2 text-sm font-semibold text-radiant-gold transition hover:bg-radiant-gold/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {importing ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                {importing ? 'Importing...' : 'Import launch backlog'}
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-silicon-slate/60 bg-silicon-slate/10 p-3">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Template</div>
                <div className="mt-1 text-sm font-semibold text-foreground">{campaignSummary.template_key}</div>
              </div>
              <div className="rounded-lg border border-silicon-slate/60 bg-silicon-slate/10 p-3">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Calendar items</div>
                <div className="mt-1 text-sm font-semibold text-foreground">{campaignSummary.calendar_item_count}</div>
              </div>
              <div className="rounded-lg border border-silicon-slate/60 bg-silicon-slate/10 p-3">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Channels</div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {campaignSummary.supported_channels.join(', ')}
                </div>
              </div>
              <div className="rounded-lg border border-silicon-slate/60 bg-silicon-slate/10 p-3">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">External execution</div>
                <div className="mt-1 text-sm font-semibold text-foreground">Locked</div>
              </div>
            </div>

            {importResult?.ok && (
              <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 size={16} />
                  Imported {importResult.calendar_items?.total ?? 0} calendar items and {importResult.work_items?.total ?? 0} backlog items.
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {importResult.review_links?.content_intelligence && (
                    <Link
                      href={importResult.review_links.content_intelligence}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/40 px-3 py-2 text-emerald-100 hover:bg-emerald-300/10"
                    >
                      <ExternalLink size={14} />
                      Content Intelligence
                    </Link>
                  )}
                  {importResult.review_links?.campaign_calendar && (
                    <Link
                      href={importResult.review_links.campaign_calendar}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/40 px-3 py-2 text-emerald-100 hover:bg-emerald-300/10"
                    >
                      <ExternalLink size={14} />
                      Campaign calendar
                    </Link>
                  )}
                </div>
              </div>
            )}

            {importError && (
              <div className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
                {importError}
              </div>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="admin-console-card rounded-lg border p-5">
              <div className="mb-4 flex items-center gap-2 text-radiant-gold">
                <BookOpen size={18} />
                <h2 className="text-lg font-semibold text-foreground">Manuscript sources</h2>
              </div>
              <div className="space-y-3">
                {draftLinks.map((item) => (
                  <div key={item.path} className="rounded-lg border border-silicon-slate/60 bg-silicon-slate/10 p-3">
                    <div className="text-sm font-medium text-foreground">{item.label}</div>
                    <code className="mt-1 block break-all text-xs text-muted-foreground">{item.path}</code>
                  </div>
                ))}
              </div>
            </section>

            <section className="admin-console-card rounded-lg border p-5">
              <div className="mb-4 flex items-center gap-2 text-radiant-gold">
                <ShieldCheck size={18} />
                <h2 className="text-lg font-semibold text-foreground">Review gates</h2>
              </div>
              <ul className="space-y-3">
                {agentifiedPublication.reviewGates.map((gate) => (
                  <li key={gate} className="flex gap-3 text-sm text-muted-foreground">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-radiant-gold" />
                    <span>{gate}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="admin-console-card rounded-lg border p-5">
              <div className="mb-4 flex items-center gap-2 text-radiant-gold">
                <TerminalSquare size={18} />
                <h2 className="text-lg font-semibold text-foreground">Build commands</h2>
              </div>
              <div className="space-y-2">
                {agentifiedPublication.buildCommands.map((command) => (
                  <code key={command} className="block rounded-lg bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                    {command}
                  </code>
                ))}
              </div>
            </section>

            <section className="admin-console-card rounded-lg border p-5">
              <div className="mb-4 flex items-center gap-2 text-radiant-gold">
                <Brain size={18} />
                <h2 className="text-lg font-semibold text-foreground">Open Brain path</h2>
              </div>
              <p className="mb-3 text-sm leading-6 text-muted-foreground">
                Record summaries through the existing manuscript producer. It creates private chapter-level memories and avoids copying raw manuscript text into Open Brain.
              </p>
              <code className="block rounded-lg bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                {agentifiedPublication.openBrainCommand}
              </code>
            </section>
          </div>

          <section className="admin-console-card mt-6 rounded-lg border p-5">
            <div className="mb-4 flex items-center gap-2 text-radiant-gold">
              <FileText size={18} />
              <h2 className="text-lg font-semibold text-foreground">Public-safe proof</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {agentifiedPublication.publicSafeProof.map((proof) => (
                <div key={proof} className="rounded-lg border border-silicon-slate/60 bg-silicon-slate/10 p-3 text-sm text-muted-foreground">
                  {proof}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </ProtectedRoute>
  )
}
