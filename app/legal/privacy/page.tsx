import type { Metadata } from 'next'
import Link from 'next/link'
import Navigation from '@/components/Navigation'

export const metadata: Metadata = {
  title: 'Privacy Policy | AmaduTown, LLC',
  description: 'Privacy policy for AmaduTown, LLC social publishing and optional SMS communications.',
}

const sections = [
  {
    title: 'SMS communications',
    body: [
      'When you select SMS consent on our contact form, AmaduTown Advisory Solutions, LLC records your submitted mobile number, normalized number, affirmative choice, the disclosure you accepted, and when and where you submitted it. The record is linked to your inquiry for reference; it does not verify your identity or ownership of the number. A number entered without SMS consent is not saved by this form.',
      'We use these records to review your request and honor your choices. SMS updates are not active yet. Sending requires separate program and sender approval and confirmation safeguards. Consent submitted here does not reverse an existing opt-out or suppression record.',
      'We do not sell or share mobile information, SMS subscription records, or consent data for marketing or promotion by third parties, including affiliates. Messaging data may be disclosed to service providers and carriers only as needed to operate and support the program. Other sharing provisions in this policy do not authorize unrelated use of SMS consent data.',
      'When messaging is available, messaging and opt-out history will be used to honor your choices and investigate delivery issues. For questions or deletion requests, contact vambah@amadutown.com; necessary suppression and compliance records may be retained.',
    ],
  },
  {
    title: 'What we collect',
    body: [
      'AmaduTown, LLC may collect account identifiers, profile names, page or channel names, permission scopes, content metadata, post status, and provider response IDs when you connect social publishing tools to Portfolio.',
      'We do not ask providers for more access than is needed to prepare, review, schedule, publish, and audit approved AmaduTown, LLC content.',
    ],
  },
  {
    title: 'How we use it',
    body: [
      'Provider data is used to connect approved AmaduTown, LLC channels, show publishing readiness, submit approved content, record audit trails, and troubleshoot failed provider actions.',
      'Portfolio keeps human approval gates around content review, asset rights, privacy review, scheduling, and final publishing decisions.',
    ],
  },
  {
    title: 'What we do not sell',
    body: [
      'AmaduTown, LLC does not sell social account data, provider tokens, customer data, or private operational records.',
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
            AmaduTown, LLC
          </Link>
          <h1 className="mt-6 text-4xl font-bold tracking-normal text-foreground">Privacy Policy</h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            This policy explains how AmaduTown, LLC handles data used by Portfolio social publishing workflows and optional SMS communications.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: September 9, 2026</p>

          <div className="mt-10 space-y-8 rounded-2xl border border-radiant-gold/15 bg-silicon-slate/25 p-6 sm:p-8">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
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
