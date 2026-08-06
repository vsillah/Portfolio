import type { Metadata } from 'next'
import Link from 'next/link'
import Navigation from '@/components/Navigation'

export const metadata: Metadata = {
  title: 'Data Deletion | AmaduTown',
  description: 'How to request deletion of AmaduTown social publishing provider data.',
}

export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation />
      <section className="px-6 pt-28 pb-20 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <Link href="/" className="text-sm font-semibold uppercase tracking-[0.2em] text-radiant-gold">
            AmaduTown
          </Link>
          <h1 className="mt-6 text-4xl font-bold tracking-normal text-white">Data Deletion</h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            Use this process to request deletion of social-provider data connected to AmaduTown Portfolio workflows.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: August 6, 2026</p>

          <div className="mt-10 rounded-2xl border border-radiant-gold/15 bg-silicon-slate/25 p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-white">Request deletion</h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              Email{' '}
              <a className="text-radiant-gold underline-offset-4 hover:underline" href="mailto:vambah@amadutown.com">
                vambah@amadutown.com
              </a>{' '}
              with the subject line &quot;Data deletion request&quot; and include the connected channel, provider, and the
              account or page name that should be disconnected or removed from Portfolio records.
            </p>

            <h2 className="mt-8 text-xl font-semibold text-white">What we remove</h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              We will remove or revoke stored provider connection data where technically available, and we will mark
              related operational records so they are no longer used for future publishing actions.
            </p>

            <h2 className="mt-8 text-xl font-semibold text-white">What may remain</h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              Some audit records may be retained when needed to document prior approvals, provider responses, security
              review, or compliance history. Published content must also be managed through the provider account where it
              appears.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
