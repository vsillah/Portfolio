import type { Metadata } from 'next'
import Link from 'next/link'
import Navigation from '@/components/Navigation'

export const metadata: Metadata = {
  title: 'Privacy Policy | AmaduTown',
  description: 'Privacy policy for AmaduTown social publishing and content operations.',
}

const sections = [
  {
    title: 'What we collect',
    body: [
      'AmaduTown may collect account identifiers, profile names, page or channel names, permission scopes, content metadata, post status, and provider response IDs when you connect social publishing tools to Portfolio.',
      'We do not ask providers for more access than is needed to prepare, review, schedule, publish, and audit approved AmaduTown content.',
    ],
  },
  {
    title: 'How we use it',
    body: [
      'Provider data is used to connect approved AmaduTown channels, show publishing readiness, submit approved content, record audit trails, and troubleshoot failed provider actions.',
      'Portfolio keeps human approval gates around content review, asset rights, privacy review, scheduling, and final publishing decisions.',
    ],
  },
  {
    title: 'What we do not sell',
    body: [
      'AmaduTown does not sell social account data, provider tokens, customer data, or private operational records.',
      'Provider credentials and tokens are treated as security-sensitive operational data and are not exposed in public content.',
    ],
  },
  {
    title: 'Retention and deletion',
    body: [
      'Operational records are retained only as long as they are needed for publishing history, auditability, compliance, and support.',
      'You can request deletion of connected social-provider data by emailing vambah@amadutown.com. See the data deletion page for the request process.',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation />
      <section className="px-6 pt-28 pb-20 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <Link href="/" className="text-sm font-semibold uppercase tracking-[0.2em] text-radiant-gold">
            AmaduTown
          </Link>
          <h1 className="mt-6 text-4xl font-bold tracking-normal text-white">Privacy Policy</h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            This policy explains how AmaduTown handles data used by Portfolio social publishing workflows.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: August 6, 2026</p>

          <div className="mt-10 space-y-8 rounded-2xl border border-radiant-gold/15 bg-silicon-slate/25 p-6 sm:p-8">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-xl font-semibold text-white">{section.title}</h2>
                <div className="mt-3 space-y-3 text-muted-foreground">
                  {section.body.map((paragraph) => (
                    <p key={paragraph} className="leading-7">{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            Questions or requests can be sent to{' '}
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
