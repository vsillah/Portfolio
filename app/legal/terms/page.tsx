import type { Metadata } from 'next'
import Link from 'next/link'
import Navigation from '@/components/Navigation'

export const metadata: Metadata = {
  title: 'Terms of Service | AmaduTown, LLC',
  description: 'Terms for using AmaduTown, LLC Portfolio social publishing workflows and optional SMS communications.',
}

const terms = [
  {
    title: 'AmaduTown, LLC SMS program',
    body: 'AmaduTown Advisory Solutions, LLC offers optional low-volume marketing and customer-care texts about business and technology consulting and AI automation services, including automated messages. Participation is not required to buy a product or service. Message frequency varies, and your carrier’s message and data rates may apply. Only opt into this program using a number you control.',
  },
  {
    title: 'SMS availability and your choices',
    body: 'SMS updates are not active yet. This form records your consent for review; it does not start messages, confirm phone ownership, or reverse an earlier opt-out. Once messaging is available, reply STOP to unsubscribe or HELP for assistance. You may also contact vambah@amadutown.com for help or to withdraw your request. Carriers are not responsible for delayed or undelivered messages.',
  },
  {
    title: 'Use of Portfolio',
    body: 'Portfolio is used to plan, review, approve, schedule, publish, and audit AmaduTown, LLC content. Users are responsible for ensuring that content, media, permissions, and connected accounts are approved before external publishing.',
  },
  {
    title: 'Connected accounts',
    body: 'When a social provider is connected, Portfolio may use approved provider permissions to publish or schedule content only through the connected AmaduTown, LLC workflow and its approval gates.',
  },
  {
    title: 'Content and rights',
    body: 'Content should not be submitted for publication unless copy, visual assets, source provenance, privacy, rights, and channel readiness have been reviewed under the applicable AmaduTown, LLC process.',
  },
  {
    title: 'Operational records',
    body: 'Portfolio may retain status, approval, provider response, and audit records so publishing decisions remain traceable and recoverable.',
  },
  {
    title: 'Changes',
    body: 'AmaduTown, LLC may update these terms as its publishing workflows, channels, or provider integrations change.',
  },
]

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation />
      <section className="px-6 pt-28 pb-20 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <Link href="/" className="text-sm font-semibold uppercase tracking-[0.2em] text-radiant-gold">
            AmaduTown, LLC
          </Link>
          <h1 className="mt-6 text-4xl font-bold tracking-normal text-foreground">Terms of Service</h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            These terms apply to AmaduTown, LLC Portfolio social publishing, content operations, and optional SMS communications.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: September 9, 2026</p>

          <div className="mt-10 space-y-8 rounded-2xl border border-radiant-gold/15 bg-silicon-slate/25 p-6 sm:p-8">
            {terms.map((term) => (
              <section key={term.title} id={term.title === 'AmaduTown, LLC SMS program' ? 'sms' : undefined} className="scroll-mt-28">
                <h2 className="text-xl font-semibold text-foreground">{term.title}</h2>
                <p className="mt-3 leading-7 text-muted-foreground">{term.body}</p>
              </section>
            ))}
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            Our <Link href="/legal/privacy" className="underline underline-offset-4">Privacy Policy</Link> explains how we handle mobile information and consent records. Questions can be sent to{' '}
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
