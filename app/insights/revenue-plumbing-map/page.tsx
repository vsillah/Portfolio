import type { Metadata } from 'next'
import Link from 'next/link'
import Navigation from '@/components/Navigation'
import RevenuePlumbingMap from '@/components/insights/RevenuePlumbingMap'

export const metadata: Metadata = {
  title: 'The Revenue Plumbing Map | AmaduTown Advisory Solutions',
  description:
    'An interactive map of the fifty joints between raw market value and money in the bank, with where each one leaks and how to seal it.',
  openGraph: {
    title: 'The Revenue Plumbing Map',
    description:
      'Fifty joints sit between a stranger’s first click and money in your account. See where each one leaks and how to seal it.',
    type: 'article',
  },
}

export default function RevenuePlumbingMapPage() {
  return (
    <main className="min-h-screen relative">
      <Navigation />

      <article className="mx-auto max-w-7xl px-6 pb-24 pt-28 sm:px-10 lg:px-12">
        <header className="max-w-3xl">
          <p className="font-heading text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Insights · Revenue operations
          </p>
          <h1 className="mt-4 font-premium text-5xl leading-[1.1] tracking-tight text-foreground sm:text-6xl">
            Your revenue has a plumbing problem
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            By Vambah Sillah · AmaduTown Advisory Solutions
          </p>
        </header>

        <div className="mt-10 max-w-3xl space-y-5 text-lg leading-8 text-foreground/90">
          <p>
            Most business owners try to fix revenue at the faucet. More ads, more content, more
            outreach. The market has plenty of value in it. The trouble starts after you open the
            tap.
          </p>
          <p>
            Between a stranger&rsquo;s first click and money in your account, value passes through
            about fifty joints: the offer, the booking form, the reminder email, the sales call,
            the contract, the onboarding, the delivery, the follow-up. Each one can leak. A small
            drip at ten joints will drain a pipeline faster than one dramatic break, and it is much
            harder to see.
          </p>
          <p>
            I built this map to make the drips visible. Let it walk the pipe on its own, or pick
            the step that worries you. Each one shows where value escapes and one move that seals
            it.
          </p>
        </div>

        <section aria-label="Interactive revenue plumbing map" className="mt-12">
          <RevenuePlumbingMap />
        </section>

        <div className="mt-16 grid max-w-5xl gap-10 md:grid-cols-2">
          <section>
            <h2 className="font-heading text-xl font-bold tracking-wide text-foreground">
              Start at the end of the pipe
            </h2>
            <p className="mt-4 text-lg leading-8 text-foreground/90">
              The leaks closest to the bank are the cheapest to fix, because the client has already
              said yes. The one I watch most closely is the stretch right after release. You&rsquo;ve
              delivered, and you can&rsquo;t yet tell whether it is meeting the mark. If you
              don&rsquo;t follow up, you never get the feedback, and the client finds a competitor
              to fill the gaps you left open.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold tracking-wide text-foreground">
              Technology is the great equalizer
            </h2>
            <p className="mt-4 text-lg leading-8 text-foreground/90">
              A large company has a department watching every joint. A small business has an owner
              and a long day. Automation closes that distance: reminders that send themselves,
              onboarding that runs while you sleep, a follow-up that is already on the calendar
              before the work ships.
            </p>
          </section>
        </div>

        <section className="glass-card mt-16 max-w-3xl !p-8">
          <h2 className="font-heading text-xl font-bold tracking-wide text-foreground">
            Find your own leaks
          </h2>
          <p className="mt-3 text-lg leading-8 text-foreground/90">
            The AI &amp; Automation Audit is a short assessment across six areas of your business.
            Use the results to decide which joint to seal first.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link href="/tools/audit" className="btn-gold inline-block">
              Take the audit
            </Link>
            <Link href="/#contact" className="btn-ghost inline-block">
              Talk with us
            </Link>
          </div>
        </section>

        <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
          Inspired by a pipeline diagram I first saw in a Jack Roberts video.
        </p>
      </article>
    </main>
  )
}
