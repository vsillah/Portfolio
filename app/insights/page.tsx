import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import Navigation from '@/components/Navigation'

export const metadata: Metadata = {
  title: 'Insights | AmaduTown Advisory Solutions',
  description: 'Interactive maps and research dashboards from Vambah Sillah and AmaduTown Advisory Solutions.',
}

const insights = [
  {
    title: 'Revenue Plumbing Map',
    category: 'Revenue operations',
    description: 'Trace fifty handoffs between market attention and money in the bank, and see where value leaks.',
    href: '/insights/revenue-plumbing-map',
  },
  {
    title: 'The Compounding Graph',
    category: 'The Equity Code',
    description: 'Explore thirty-five laws and events through five gaps in Black American life, with lineage, impact, and reparative approaches.',
    href: '/insights/compounding-graph',
  },
  {
    title: 'Home Front Ledger',
    category: 'The Equity Code',
    description: 'Explore twenty American wars and campaigns across seven dimensions of their effects at home, with sourced death and cost totals.',
    href: '/insights/home-front-ledger',
  },
  {
    title: 'Owning the Block',
    category: 'The Equity Code',
    description: 'Walk through a community technology stack drawn as a city block and nine end-to-end builds.',
    href: '/insights/owning-the-block',
  },
] as const

export default function InsightsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation />
      <div className="mx-auto max-w-7xl px-6 pb-24 pt-28 sm:px-10 lg:px-12">
        <header className="max-w-3xl">
          <p className="font-heading text-xs uppercase tracking-[0.22em] text-muted-foreground">AmaduTown · Insights</p>
          <h1 className="mt-4 font-premium text-5xl leading-[1.1] tracking-tight sm:text-6xl">Explore the systems</h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            Interactive maps that make the relationships visible. Choose a question, then follow the evidence and the working model.
          </p>
        </header>
        <section aria-label="Interactive insights" className="mt-12 grid gap-5 md:grid-cols-2">
          {insights.map((insight) => (
            <Link
              key={insight.href}
              href={insight.href}
              className="group flex min-h-56 flex-col rounded-2xl border border-border bg-card p-6 transition-colors hover:border-[#A88A2D] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#A88A2D] sm:p-8"
            >
              <p className="font-heading text-xs uppercase tracking-[0.18em] text-muted-foreground">{insight.category}</p>
              <h2 className="mt-4 font-premium text-2xl leading-tight sm:text-3xl">{insight.title}</h2>
              <p className="mt-3 max-w-prose text-sm leading-6 text-muted-foreground sm:text-base">{insight.description}</p>
              <span className="mt-auto inline-flex items-center gap-2 pt-6 font-heading text-xs uppercase tracking-[0.15em] text-[#725A16] dark:text-radiant-gold">
                Open insight <ArrowUpRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  )
}
