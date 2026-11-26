import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Navigation from '@/components/Navigation'
import EquityInsightFrame from '@/components/insights/EquityInsightFrame'
import CommonsEconomyMap from '@/components/insights/commons-economy/CommonsEconomyMap'
import { acceptedTransport } from '@/components/insights/commons-economy/transport'

/* Same-origin authored HTML dashboards, embedded through the shared frame. */
const framedDashboards = {
  'compounding-graph': 'The Compounding Graph',
  'home-front-ledger': 'Home Front Ledger',
  'owning-the-block': 'Owning the Block',
} as const

/*
 * Model-backed dashboards render in the app so the fail-closed adapter runs in
 * the same bundle as the skin. The envelope arrives through the generated,
 * commit-bound Phase 6 transport and is passed on only after its provenance and
 * the Phase 5 adapter accept it; otherwise the map stays closed.
 */
const modelDashboards = {
  'commons-economy-map': 'Commons Economy Map',
} as const

const dashboards = { ...framedDashboards, ...modelDashboards } as const

type DashboardSlug = keyof typeof dashboards
type FramedSlug = keyof typeof framedDashboards

function isDashboardSlug(value: string): value is DashboardSlug {
  return Object.prototype.hasOwnProperty.call(dashboards, value)
}

function isFramedSlug(value: string): value is FramedSlug {
  return Object.prototype.hasOwnProperty.call(framedDashboards, value)
}

export function generateStaticParams() {
  return Object.keys(dashboards).map((equityInsight) => ({ equityInsight }))
}

export function generateMetadata({ params }: { params: { equityInsight: string } }): Metadata {
  if (!isDashboardSlug(params.equityInsight)) return {}
  return { title: `${dashboards[params.equityInsight]} | AmaduTown Insights` }
}

export default async function EquityInsightPage({ params }: { params: { equityInsight: string } }) {
  if (!isDashboardSlug(params.equityInsight)) notFound()

  if (!isFramedSlug(params.equityInsight)) {
    const { envelope } = await acceptedTransport()
    return (
      <main className="min-h-screen bg-background text-foreground">
        <Navigation />
        <CommonsEconomyMap envelope={envelope} />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation />
      <div className="pt-24">
        <EquityInsightFrame key={params.equityInsight} slug={params.equityInsight} title={dashboards[params.equityInsight]} />
      </div>
    </main>
  )
}
