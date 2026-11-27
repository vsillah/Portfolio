import Link from 'next/link'

export default function YouTubeServiceDisclosure() {
  return (
    <footer
      aria-labelledby="youtube-service-heading"
      className="border-t border-imperial-navy/10 bg-white px-6 py-8 text-imperial-navy dark:border-white/10 dark:bg-imperial-navy dark:text-white"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="max-w-3xl">
          <h2 id="youtube-service-heading" className="font-heading text-base font-semibold">
            YouTube API Services
          </h2>
          <p className="mt-2 text-sm leading-6 text-imperial-navy/80 dark:text-white/80">
            Portfolio uses YouTube API Services for connected AmaduTown channel workflows. A separate use of public video metadata and derived metrics is under review and inactive.
          </p>
        </div>
        <nav aria-label="YouTube and privacy information" className="flex shrink-0 flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
          <Link className="underline decoration-radiant-gold underline-offset-4 hover:text-bronze focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-radiant-gold" href="/legal/privacy">
            Privacy Policy
          </Link>
          <Link className="underline decoration-radiant-gold underline-offset-4 hover:text-bronze focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-radiant-gold" href="/legal/data-deletion">
            Data deletion
          </Link>
        </nav>
      </div>
    </footer>
  )
}
