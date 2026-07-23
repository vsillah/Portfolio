import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BookOpen, Brain, CheckCircle2, ExternalLink, FileText, ShieldCheck } from 'lucide-react'
import Navigation from '@/components/Navigation'
import { agentifiedPublication } from '@/lib/agentified-publication'

const principles = [
  {
    title: 'Start with the corpus',
    body: 'Portfolio comes first because agents need a governed substrate, not a blank prompt.',
  },
  {
    title: 'Make authority visible',
    body: 'Agent roles, routing rules, approval gates, and receipts turn motion into accountable work.',
  },
  {
    title: 'Scale trust before scale',
    body: 'Evals, drift checks, and Open Brain memory proposals make acceleration durable.',
  },
]

export default function AgentifiedPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation />

      <section className="pt-28 pb-20 px-6 sm:px-10 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
            <div className="absolute -inset-4 rounded-[2rem] border border-radiant-gold/20 bg-radiant-gold/5" />
            <Image
              src={agentifiedPublication.coverImage}
              alt={`${agentifiedPublication.title} cover`}
              width={900}
              height={1350}
              priority
              className="relative rounded-2xl shadow-[0_32px_110px_rgba(0,0,0,0.28)]"
            />
          </div>

          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-radiant-gold/30 bg-radiant-gold/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-radiant-gold">
              <BookOpen size={14} />
              <span>{agentifiedPublication.statusLabel}</span>
            </div>
            <h1 className="font-premium text-5xl text-foreground sm:text-6xl lg:text-7xl">
              {agentifiedPublication.title}
            </h1>
            <p className="mt-5 max-w-3xl text-xl font-medium leading-relaxed text-radiant-gold sm:text-2xl">
              {agentifiedPublication.subtitle}
            </p>
            <p className="mt-2 max-w-3xl text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {agentifiedPublication.longSubtitle}
            </p>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
              {agentifiedPublication.description}
            </p>
            <p className="mt-5 max-w-3xl text-base leading-7 text-foreground/85">
              {agentifiedPublication.promise}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {agentifiedPublication.purchaseLinks.map((link) => {
                const isPrimary = link.kind === 'primary'
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={
                      isPrimary
                        ? 'group rounded-xl bg-radiant-gold px-5 py-4 text-imperial-navy transition hover:brightness-110'
                        : 'group rounded-xl border border-radiant-gold/25 bg-background/50 px-5 py-4 text-foreground transition hover:bg-radiant-gold/10'
                    }
                  >
                    <span className="flex items-center justify-between gap-3 text-sm font-bold">
                      {link.label}
                      <ExternalLink size={15} className="shrink-0 transition group-hover:translate-x-0.5" />
                    </span>
                    <span className={isPrimary ? 'mt-2 block text-xs text-imperial-navy/75' : 'mt-2 block text-xs text-muted-foreground'}>
                      {link.status}
                    </span>
                  </a>
                )
              })}
            </div>

            <div className="mt-4 rounded-xl border border-radiant-gold/10 bg-silicon-slate/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-radiant-gold">
                Wide distribution
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Draft2Digital/Books2Read currently routes readers to available ebook retailers, including{' '}
                {agentifiedPublication.wideRetailers.join(', ')}. Some storefronts can continue propagating after publication.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/#publications"
                className="inline-flex items-center gap-2 rounded-full bg-radiant-gold px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-imperial-navy transition hover:brightness-110"
              >
                <span>View in publications</span>
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/#contact"
                className="inline-flex items-center gap-2 rounded-full border border-radiant-gold/30 px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-radiant-gold transition hover:bg-radiant-gold/10"
              >
                <span>Discuss agentic OS work</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-radiant-gold/10 bg-silicon-slate/20 px-6 py-14 sm:px-10 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
          {principles.map((principle) => (
            <div key={principle.title} className="rounded-xl border border-radiant-gold/10 bg-background/60 p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-radiant-gold/12 text-radiant-gold">
                <CheckCircle2 size={20} />
              </div>
              <h2 className="text-lg font-semibold">{principle.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{principle.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-16 sm:px-10 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
          <div className="rounded-xl border border-radiant-gold/10 bg-silicon-slate/20 p-6">
            <div className="mb-3 flex items-center gap-2 text-radiant-gold">
              <Brain size={18} />
              <h2 className="text-xl font-semibold">What the book is solving</h2>
            </div>
            <p className="text-sm leading-7 text-muted-foreground">
              {agentifiedPublication.operatingThesis}
            </p>
          </div>

          <div className="rounded-xl border border-radiant-gold/10 bg-silicon-slate/20 p-6">
            <div className="mb-4 flex items-center gap-2 text-radiant-gold">
              <ShieldCheck size={18} />
              <h2 className="text-xl font-semibold">Portfolio proof layer</h2>
            </div>
            <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
              {agentifiedPublication.publicSafeProof.map((proof) => (
                <li key={proof} className="flex gap-3">
                  <FileText size={16} className="mt-0.5 shrink-0 text-radiant-gold" />
                  <span>{proof}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  )
}
