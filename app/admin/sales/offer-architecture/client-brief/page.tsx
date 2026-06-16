import Link from 'next/link'
import { ArrowLeft, CheckCircle2, FileText, ShieldCheck } from 'lucide-react'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { REVERSR_PRODUCT_ASSET_OFFER_ARCHITECTURE } from '@/lib/product-asset-offer-architecture'

export default function OfferArchitectureClientBriefPage() {
  const architecture = REVERSR_PRODUCT_ASSET_OFFER_ARCHITECTURE
  const brief = architecture.clientBrief

  return (
    <div className="admin-console-page min-h-screen p-6 text-foreground lg:p-8">
      <div className="mx-auto max-w-5xl">
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Sales', href: '/admin/sales' },
            { label: 'Offer Architecture', href: '/admin/sales/offer-architecture' },
            { label: 'Client Brief' },
          ]}
        />

        <Link
          href="/admin/sales/offer-architecture"
          className="mb-5 mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to offer architecture
        </Link>

        <header className="admin-console-surface-header rounded-xl border p-6">
          <div className="admin-console-eyebrow mb-2">
            <FileText className="h-4 w-4" />
            Client-Safe Draft
          </div>
          <h1 className="text-3xl font-bold">{brief.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Audience: {brief.audienceLabel}. This is the shareable substance that should move into
            the real proposal route after review: {brief.routeHint}.
          </p>
        </header>

        <section className="admin-console-card mt-6 rounded-xl border p-6">
          <h2 className="text-xl font-semibold">Executive Summary</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{brief.summary}</p>
          <div className="mt-4 rounded-lg border border-radiant-gold/25 bg-radiant-gold/10 p-4 text-sm leading-6 text-radiant-gold">
            {brief.pricingFrame}
          </div>
        </section>

        <section className="admin-console-card mt-6 rounded-xl border p-6">
          <h2 className="text-xl font-semibold">Evidence Summary</h2>
          <div className="mt-4 space-y-3">
            {brief.evidenceSummary.map((item) => (
              <div key={item} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          {brief.recommendedOptions.map((option) => (
            <article key={option.label} className="admin-console-card rounded-xl border p-5">
              <div className="text-sm font-semibold text-muted-foreground">{option.label}</div>
              <div className="mt-2 text-2xl font-bold text-radiant-gold">{option.priceFrame}</div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {option.clientSafeDescription}
              </p>
            </article>
          ))}
        </section>

        <section className="admin-console-card mt-6 rounded-xl border p-6">
          <div className="admin-console-eyebrow mb-2">
            <ShieldCheck className="h-4 w-4" />
            Redaction Boundary
          </div>
          <h2 className="text-xl font-semibold">Keep out of the client version unless approved</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {brief.excludes.map((item) => (
              <div key={item} className="rounded-lg border border-silicon-slate/60 bg-imperial-navy/45 px-3 py-2 text-sm text-muted-foreground">
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
