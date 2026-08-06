import type { Metadata } from 'next'
import Link from 'next/link'
import Navigation from '@/components/Navigation'

export const metadata: Metadata = {
  title: 'Terms of Service | AmaduTown',
  description: 'Terms for using AmaduTown Portfolio social publishing workflows.',
}

const terms = [
  {
    title: 'Use of Portfolio',
    body: 'Portfolio is used to plan, review, approve, schedule, publish, and audit AmaduTown content. Users are responsible for ensuring that content, media, permissions, and connected accounts are approved before external publishing.',
  },
  {
    title: 'Connected accounts',
    body: 'When a social provider is connected, Portfolio may use approved provider permissions to publish or schedule content only through the connected AmaduTown workflow and its approval gates.',
  },
  {
    title: 'Content and rights',
    body: 'Content should not be submitted for publication unless copy, visual assets, source provenance, privacy, rights, and channel readiness have been reviewed under the applicable AmaduTown process.',
  },
  {
    title: 'Operational records',
    body: 'Portfolio may retain status, approval, provider response, and audit records so publishing decisions remain traceable and recoverable.',
  },
  {
    title: 'Changes',
    body: 'AmaduTown may update these terms as its publishing workflows, channels, or provider integrations change.',
  },
]

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation />
      <section className="px-6 pt-28 pb-20 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <Link href="/" className="text-sm font-semibold uppercase tracking-[0.2em] text-radiant-gold">
            AmaduTown
          </Link>
          <h1 className="mt-6 text-4xl font-bold tracking-normal text-white">Terms of Service</h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            These terms apply to AmaduTown Portfolio social publishing and content operations.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: August 6, 2026</p>

          <div className="mt-10 space-y-8 rounded-2xl border border-radiant-gold/15 bg-silicon-slate/25 p-6 sm:p-8">
            {terms.map((term) => (
              <section key={term.title}>
                <h2 className="text-xl font-semibold text-white">{term.title}</h2>
                <p className="mt-3 leading-7 text-muted-foreground">{term.body}</p>
              </section>
            ))}
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            Questions can be sent to{' '}
            <a className="text-radiant-gold underline-offset-4 hover:underline" href="mailto:vambah@amadutown.com">
              vambah@amadutown.com
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  )
}
