'use client'

import Link from 'next/link'
import { BookOpen, Brain, CheckCircle2, ExternalLink, FileText, ShieldCheck, TerminalSquare } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { agentifiedPublication } from '@/lib/agentified-publication'

const draftLinks = [
  { label: 'Production draft', path: agentifiedPublication.productionDraftPath },
  { label: 'Workbook-enhanced draft', path: agentifiedPublication.workbookDraftPath },
  { label: 'Workbook source', path: agentifiedPublication.workbookPath },
  { label: 'Blueprint', path: agentifiedPublication.blueprintPath },
  { label: 'Fable 5 handoff', path: agentifiedPublication.fableHandoffPath },
]

export default function AgentifiedAdminPage() {
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
                <p className="mt-2 max-w-3xl text-lg text-radiant-gold">{agentifiedPublication.subtitle}</p>
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
