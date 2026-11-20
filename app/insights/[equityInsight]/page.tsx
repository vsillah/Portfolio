import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Navigation from '@/components/Navigation'
import EquityInsightFrame from '@/components/insights/EquityInsightFrame'

const dashboards = {
  'compounding-graph': 'The Compounding Graph',
  'home-front-ledger': 'Home Front Ledger',
  'owning-the-block': 'Owning the Block',
} as const

type DashboardSlug = keyof typeof dashboards

function isDashboardSlug(value: string): value is DashboardSlug {
  return Object.prototype.hasOwnProperty.call(dashboards, value)
}

export function generateStaticParams() {
  return Object.keys(dashboards).map((equityInsight) => ({ equityInsight }))
}

export function generateMetadata({ params }: { params: { equityInsight: string } }): Metadata {
  if (!isDashboardSlug(params.equityInsight)) return {}
  return { title: `${dashboards[params.equityInsight]} | AmaduTown Insights` }
}

export default function EquityInsightPage({ params }: { params: { equityInsight: string } }) {
  if (!isDashboardSlug(params.equityInsight)) notFound()

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation />
      <div className="pt-24">
        <EquityInsightFrame key={params.equityInsight} slug={params.equityInsight} title={dashboards[params.equityInsight]} />
      </div>
    </main>
  )
}
