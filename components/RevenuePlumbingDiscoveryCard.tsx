import Link from 'next/link'
import { ArrowRight, Route } from 'lucide-react'

export default function RevenuePlumbingDiscoveryCard() {
  return (
    <aside
      aria-label="Featured insight"
      className="relative overflow-hidden bg-[#f4f6fa] px-5 pb-20 pt-10 text-[#121E31] dark:bg-[#121E31] dark:text-platinum-white sm:px-8 sm:pb-24 lg:px-12"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_78%_0%,rgba(212,175,55,0.14),transparent_62%)]"
        aria-hidden="true"
      />
      <Link
        href="/insights/revenue-plumbing-map"
        className="group relative mx-auto flex max-w-7xl flex-col gap-6 overflow-hidden rounded-2xl border border-[#121E31]/10 bg-white/[0.88] p-6 shadow-[0_18px_42px_rgba(18,30,49,0.10)] backdrop-blur-md transition-all duration-300 hover:border-radiant-gold/40 hover:shadow-[0_22px_54px_rgba(18,30,49,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-radiant-gold focus-visible:ring-offset-4 focus-visible:ring-offset-[#f4f6fa] dark:border-radiant-gold/10 dark:bg-silicon-slate/45 dark:shadow-none dark:hover:border-radiant-gold/30 dark:focus-visible:ring-offset-[#121E31] sm:p-8 md:flex-row md:items-center md:justify-between"
      >
        <div className="flex min-w-0 items-start gap-4 sm:gap-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-radiant-gold/25 bg-radiant-gold/10 text-radiant-gold sm:h-12 sm:w-12">
            <Route size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-[0.6rem] uppercase tracking-[0.22em] text-radiant-gold">
              Interactive insight
            </p>
            <h2 className="mt-2 font-premium text-2xl text-[#121E31] transition-colors group-hover:text-radiant-gold dark:text-platinum-white sm:text-3xl">
              Revenue Plumbing Map
            </h2>
            <p className="mt-3 max-w-3xl font-body text-sm leading-6 text-[#475569] dark:text-platinum-white/75 sm:text-base sm:leading-7">
              An interactive AmaduTown operating model for finding where revenue systems leak capacity.
            </p>
          </div>
        </div>

        <span className="inline-flex shrink-0 items-center justify-center gap-3 self-start rounded-full border border-[#121E31]/[0.14] px-5 py-3 font-heading text-[0.65rem] uppercase tracking-[0.18em] text-[#121E31]/80 transition-all group-hover:border-radiant-gold group-hover:bg-radiant-gold group-hover:text-imperial-navy dark:border-radiant-gold/25 dark:text-platinum-white md:self-center">
          Explore the map
          <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </span>
      </Link>
    </aside>
  )
}
