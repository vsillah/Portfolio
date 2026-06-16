import Link from 'next/link'
import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  Eye,
  FileText,
  Gauge,
  GitBranch,
  Layers3,
  ShieldCheck,
  Target,
} from 'lucide-react'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { CAMPAIGN_TYPE_LABELS, CRITERIA_TYPE_LABELS, TRACKING_SOURCE_LABELS } from '@/lib/campaigns'
import { PAYOUT_AMOUNT_TYPE_LABELS, PAYOUT_TYPE_LABELS } from '@/lib/guarantees'
import {
  PRODUCT_ASSET_OFFER_ARCHITECTURES,
  getOfferStageLabel,
  type OfferArchitectureStage,
} from '@/lib/product-asset-offer-architecture'

const stageStyles: Record<OfferArchitectureStage, string> = {
  attraction: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
  core: 'border-radiant-gold/35 bg-radiant-gold/10 text-radiant-gold',
  upsell: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
  downsell: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  continuity: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-100',
  risk_reversal: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
}

function formatScore(value: number) {
  return value.toFixed(2)
}

function getValueIndex(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function getValueIndexLabel(value: number) {
  if (value >= 75) return 'Very strong'
  if (value >= 50) return 'Strong'
  if (value >= 25) return 'Developing'
  return 'Evidence-backed, but still needs risk reduction'
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function buildContextHref(
  href: string,
  architectureId: string,
  params: Record<string, string | number>
) {
  const searchParams = new URLSearchParams({
    source: 'offer-architecture',
    architectureId,
  })
  Object.entries(params).forEach(([key, value]) => searchParams.set(key, String(value)))
  return `${href}?${searchParams.toString()}`
}

export default function OfferArchitecturePage() {
  const architecture = PRODUCT_ASSET_OFFER_ARCHITECTURES[0]
  const campaignTemplate = architecture.campaignTemplate
  const valueIndex = getValueIndex(architecture.valueEquation.valueScore)
  const campaignContextHref = buildContextHref(campaignTemplate.surfaceHref, architecture.id, {
    campaignName: campaignTemplate.suggestedName,
    campaignSlug: campaignTemplate.suggestedSlug,
    campaignType: campaignTemplate.campaignType,
    payoutType: campaignTemplate.payoutType,
    payoutAmountType: campaignTemplate.payoutAmountType,
    payoutAmountValue: campaignTemplate.payoutAmountValue,
    completionWindowDays: campaignTemplate.completionWindowDays,
    minPurchaseAmount: campaignTemplate.minPurchaseAmount,
  })
  const bundleContextHref = buildContextHref('/admin/sales/bundles', architecture.id, {
    stage: 'core',
    offerName: 'Product Asset License And Commercialization Sprint',
  })
  const upsellContextHref = buildContextHref('/admin/sales/upsell-paths', architecture.id, {
    stage: 'upsell',
    offerName: 'Managed Commercialization Buildout',
  })
  const continuityContextHref = buildContextHref('/admin/continuity-plans', architecture.id, {
    stage: 'continuity',
    offerName: 'Commercial Stewardship Plan',
  })

  return (
    <div className="admin-console-page min-h-screen p-6 text-foreground lg:p-8">
      <div className="mx-auto max-w-7xl">
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Sales', href: '/admin/sales' },
            { label: 'Offer Architecture' },
          ]}
        />

        <header className="admin-console-surface-header mb-6 mt-5 flex flex-wrap items-start justify-between gap-4 rounded-xl border p-5">
          <div>
            <div className="admin-console-eyebrow mb-2">
              <Layers3 className="h-4 w-4" />
              Sales Operations
            </div>
            <h1 className="text-3xl font-bold">Offer Architecture</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Product-asset pricing logic for attraction, core offers, upsells, downsells,
              continuity, and risk reversal.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/sales/offer-architecture/client-brief" className="admin-console-button-muted">
              Client Brief Preview
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={campaignContextHref} className="admin-console-button-muted">
              Seed Campaign
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <section className="admin-console-card mb-6 rounded-xl border p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="admin-console-eyebrow mb-2">
                <Target className="h-4 w-4" />
                {architecture.title}
              </div>
              <h2 className="text-2xl font-semibold">Asset-first pricing frame</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{architecture.thesis}</p>
              <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-100">
                {architecture.privacyBoundary}
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-[420px]">
              <MetricCard label="Replacement cost" value={architecture.anchors.replacementCost} />
              <MetricCard label="Core anchor" value={architecture.anchors.primaryFee} />
              <MetricCard label="Annual license" value={architecture.anchors.annualLicense} />
              <MetricCard label="Revenue share" value={architecture.anchors.revenueShare} />
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          {architecture.scoreComponents.map((component) => (
            <EquationCard
              key={component.key}
              label={component.label}
              value={component.score}
              denominator={component.denominator}
              direction={component.direction}
            />
          ))}
        </section>

        <section className="admin-console-card mb-6 rounded-xl border p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="admin-console-eyebrow mb-2">
                <Gauge className="h-4 w-4" />
                Value Equation
              </div>
              <h2 className="text-xl font-semibold">Offer strength index</h2>
            </div>
            <div className="rounded-lg border border-radiant-gold/30 bg-radiant-gold/10 px-4 py-2 text-right">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {getValueIndexLabel(valueIndex)}
              </div>
              <div className="text-2xl font-bold text-radiant-gold">
                {valueIndex}/100
              </div>
            </div>
          </div>
          <div className="mb-4 h-3 overflow-hidden rounded-full bg-silicon-slate/70">
            <div
              className="h-full rounded-full bg-radiant-gold"
              style={{ width: `${valueIndex}%` }}
              aria-label={`Offer strength index ${valueIndex} out of 100`}
            />
          </div>
          <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
            This page uses the same Portfolio value-equation convention already used in pricing:
            dream outcome times perceived likelihood, divided by the remaining time delay and effort
            burden. The index is internal: higher means the offer is easier to believe, faster to
            realize, and less burdensome for the buyer. The current score is intentionally not maxed
            out because one external release gate still remains.
          </p>
        </section>

        <section className="mb-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="admin-console-card rounded-xl border p-5">
            <div className="admin-console-eyebrow mb-2">
              <Eye className="h-4 w-4" />
              Client Version
            </div>
            <h2 className="text-xl font-semibold">{architecture.clientBrief.title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{architecture.clientBrief.summary}</p>
            <div className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-100">
              {architecture.clientBrief.pricingFrame}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/admin/sales/offer-architecture/client-brief" className="admin-console-button-primary">
                Open client-safe brief
                <ArrowRight className="h-4 w-4" />
              </Link>
              <span className="rounded-lg border border-white/10 px-3 py-2 text-sm text-muted-foreground">
                Final destination: {architecture.clientBrief.routeHint}
              </span>
            </div>
          </div>

          <div className="admin-console-card rounded-xl border p-5">
            <div className="admin-console-eyebrow mb-2">
              <BadgeDollarSign className="h-4 w-4" />
              Cost Observability
            </div>
            <h2 className="text-xl font-semibold">Replacement-cost basis</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              These ranges make the $30,000 anchor legible as a partial product-asset
              commercialization contribution, not an hourly invoice.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {architecture.replacementCostLines.map((line) => (
                <div key={line.label} className="rounded-lg border border-silicon-slate/60 bg-imperial-navy/45 p-4">
                  <div className="text-sm font-semibold text-foreground">{line.label}</div>
                  <div className="mt-1 text-lg font-bold text-radiant-gold">{line.estimatedRange}</div>
                  <p className="mt-2 text-sm leading-5 text-muted-foreground">{line.rationale}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="admin-console-card mb-6 rounded-xl border p-5">
          <div className="admin-console-eyebrow mb-2">
            <FileText className="h-4 w-4" />
            Evidence Trail
          </div>
          <h2 className="mb-4 text-xl font-semibold">What justifies the pricing frame</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {architecture.evidence.map((evidence) => (
              <div key={evidence.label} className="rounded-lg border border-silicon-slate/60 bg-imperial-navy/45 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold text-foreground">{evidence.label}</div>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-xs uppercase text-muted-foreground">
                    {evidence.confidence}
                  </span>
                </div>
                <div className="mt-2 text-sm font-semibold text-radiant-gold">{evidence.value}</div>
                <div className="mt-2 text-xs text-muted-foreground">Source: {evidence.source}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-console-card mb-6 rounded-xl border p-5">
          <div className="admin-console-eyebrow mb-2">
            <Target className="h-4 w-4" />
            Score Rationale
          </div>
          <h2 className="mb-4 text-xl font-semibold">Why each value-equation input has this score</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {architecture.scoreComponents.map((component) => (
              <div key={component.key} className="rounded-lg border border-silicon-slate/60 bg-imperial-navy/45 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-foreground">{component.label}</div>
                    <div className="text-xs text-muted-foreground">{component.direction}</div>
                  </div>
                  <div className="text-xl font-bold text-radiant-gold">
                    {component.score}/{component.denominator}
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{component.rationale}</p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {component.evidence.map((item) => (
                    <li key={item} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-muted-foreground">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-console-card mb-6 rounded-xl border p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="admin-console-eyebrow mb-2">
                <Target className="h-4 w-4" />
                Campaign Reuse
              </div>
              <h2 className="text-xl font-semibold">{campaignTemplate.suggestedName}</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
                {campaignTemplate.reuseRationale}
              </p>
            </div>
            <Link href={campaignContextHref} className="admin-console-button-primary">
              Open {campaignTemplate.surfaceLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <CampaignSetting label="Slug" value={campaignTemplate.suggestedSlug} />
            <CampaignSetting label="Type" value={CAMPAIGN_TYPE_LABELS[campaignTemplate.campaignType]} />
            <CampaignSetting label="Payout" value={PAYOUT_TYPE_LABELS[campaignTemplate.payoutType]} />
            <CampaignSetting label="Amount" value={`${PAYOUT_AMOUNT_TYPE_LABELS[campaignTemplate.payoutAmountType]} ${formatCurrency(campaignTemplate.payoutAmountValue)}`} />
            <CampaignSetting label="Window" value={`${campaignTemplate.completionWindowDays} days`} />
            <CampaignSetting label="Minimum" value={formatCurrency(campaignTemplate.minPurchaseAmount)} />
          </div>

          <div className="mt-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Criteria templates
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {campaignTemplate.criteriaTemplates.map((criterion) => (
                <div key={criterion.labelTemplate} className="rounded-lg border border-silicon-slate/60 bg-imperial-navy/45 p-4">
                  <div className="font-semibold text-foreground">{criterion.labelTemplate}</div>
                  <p className="mt-2 text-sm leading-5 text-muted-foreground">{criterion.descriptionTemplate}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border border-white/10 px-2 py-1">
                      {CRITERIA_TYPE_LABELS[criterion.criteriaType]}
                    </span>
                    <span className="rounded-full border border-white/10 px-2 py-1">
                      {TRACKING_SOURCE_LABELS[criterion.trackingSource]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          {architecture.items.map((item) => (
            <article key={item.id} className="admin-console-card rounded-xl border p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${stageStyles[item.stage]}`}
                  >
                    {getOfferStageLabel(item.stage)}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
                </div>
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-4 text-sm">
                <Field label="Buyer question" value={item.buyerQuestion} />
                <Field label="Offer" value={item.offer} />
                <Field label="Price frame" value={item.priceFrame} />
                <Field label="Value frame" value={item.valueFrame} />
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Proof required
                  </div>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {item.proofRequired.map((proof) => (
                      <li key={proof} className="rounded-lg border border-silicon-slate/60 bg-imperial-navy/45 px-3 py-2 text-muted-foreground">
                        {proof}
                      </li>
                    ))}
                  </ul>
                </div>
                <Field label="Next action" value={item.nextAction} />
              </div>
            </article>
          ))}
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="admin-console-card rounded-xl border p-5">
            <div className="admin-console-eyebrow mb-2">
              <ShieldCheck className="h-4 w-4" />
              Rules
            </div>
            <h2 className="mb-4 text-xl font-semibold">How to use this frame</h2>
            <div className="space-y-3">
              {architecture.principles.map((principle) => (
                <div key={principle} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span>{principle}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-console-card rounded-xl border p-5">
            <div className="admin-console-eyebrow mb-2">
              <GitBranch className="h-4 w-4" />
              Connected Surfaces
            </div>
            <h2 className="mb-4 text-xl font-semibold">Send this context into the next step</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <SurfaceLink
                href={campaignContextHref}
                title="Attraction Campaigns"
                body="Prefills the Rebuild Readiness Credit campaign from this brief."
                context="campaign name, slug, type, payout, credit amount, window"
              />
              <SurfaceLink
                href={bundleContextHref}
                title="Offer Bundles"
                body="Carries the core asset offer context for packaging."
                context="architecture id, core stage, offer name"
              />
              <SurfaceLink
                href={upsellContextHref}
                title="Upsell Paths"
                body="Carries the managed commercialization next-problem context."
                context="architecture id, upsell stage, offer name"
              />
              <SurfaceLink
                href={continuityContextHref}
                title="Continuity Plans"
                body="Carries the stewardship and license-support context."
                context="architecture id, continuity stage, offer name"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function CampaignSetting({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-console-metric rounded-lg border p-4">
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 break-words text-sm font-semibold text-foreground">{value}</div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-console-metric rounded-lg border p-4">
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm font-semibold text-foreground">{value}</div>
    </div>
  )
}

function EquationCard({
  label,
  value,
  denominator,
  direction,
}: {
  label: string
  value: number
  denominator: number
  direction: string
}) {
  return (
    <div className="admin-console-metric rounded-lg border p-4">
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-bold text-radiant-gold">{value}/{denominator}</div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{direction}</p>
    </div>
  )
}

function SurfaceLink({
  href,
  title,
  body,
  context,
}: {
  href: string
  title: string
  body: string
  context: string
}) {
  return (
    <Link href={href} className="rounded-lg border border-silicon-slate/60 bg-imperial-navy/45 p-4 transition-colors hover:border-radiant-gold/30 hover:bg-radiant-gold/10">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-foreground">{title}</div>
        <ArrowRight className="h-4 w-4 text-radiant-gold" />
      </div>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">{body}</p>
      <p className="mt-3 rounded-md border border-white/10 px-2 py-1 text-xs text-muted-foreground">
        Context sent: {context}
      </p>
    </Link>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <p className="leading-6 text-foreground/90">{value}</p>
    </div>
  )
}
