import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { evalSourceBindingPackets } from '@/lib/eval-source-binding-review'

export default function EvalSourceBindingsPage() {
  return <ProtectedRoute requireAdmin>
    <main className="mx-auto max-w-6xl space-y-7 px-4 py-8 text-foreground sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', href: '/admin' }, { label: 'Model Ops', href: '/admin/model-ops' }, { label: 'Eval source bindings' }]} />
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-radiant-gold">Seshat · source review</p>
        <h1 className="text-3xl font-semibold tracking-tight">Hosted eval source bindings</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">Four historical eval families need source approval before a new hosted run can even be considered. These packets show the exact record under review, what is missing, and who should resolve it. This page cannot run an eval or change a source.</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1 text-amber-200">4 blocked</span>
          <span className="rounded-full border border-white/15 px-3 py-1 text-muted-foreground">Review only · no provider or database action</span>
        </div>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        {evalSourceBindingPackets.map(packet => <article key={packet.key} className="rounded-2xl border border-white/10 bg-silicon-slate/20 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs uppercase tracking-wider text-muted-foreground">{packet.owner}</p><h2 className="mt-1 text-xl font-semibold">{packet.title}</h2></div>
            <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">Blocked</span>
          </div>
          <p className="mt-4 text-sm font-medium">{packet.observation}</p>
          <p className="mt-2 text-sm text-muted-foreground">{packet.threshold}</p>
          <div className="mt-5 border-t border-white/10 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-200">What blocks review</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">{packet.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul>
          </div>
          <div className="mt-5 rounded-xl border border-white/10 bg-black/15 p-3 text-sm">
            <p className="font-semibold">Review action</p>
            <p className="mt-1 text-muted-foreground">{packet.next}</p>
          </div>
          <details className="mt-4 rounded-xl border border-white/10 p-3 text-sm">
            <summary className="cursor-pointer font-medium">Audit identity and evidence</summary>
            <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Subject</dt><dd className="break-all">{packet.subjectId}</dd></div>
              <div><dt className="text-muted-foreground">Version</dt><dd className="break-all">{packet.version}</dd></div>
              <div><dt className="text-muted-foreground">Evidence SHA-256</dt><dd className="break-all">{packet.evidenceSha256}</dd></div>
              <div><dt className="text-muted-foreground">Packet key</dt><dd className="break-all">{packet.key}</dd></div>
              {Object.entries(packet.audit).map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="break-all">{value}</dd></div>)}
              <div><dt className="text-muted-foreground">Manifest SHA-256</dt><dd className="break-all">{packet.manifestSha256}</dd></div>
              <div><dt className="text-muted-foreground">Redacted snapshot SHA-256</dt><dd className="break-all">{packet.snapshotSha256}</dd></div>
              <div><dt className="text-muted-foreground">Monthly report SHA-256</dt><dd className="break-all">{packet.reportSha256}</dd></div>
            </dl>
          </details>
        </article>)}
      </div>
    </main>
  </ProtectedRoute>
}
