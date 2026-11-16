import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BookOpen, PlayCircle } from 'lucide-react'

const workshops = [
  {
    slug: 'accelerated',
    eyebrow: 'Product strategy workshop',
    title: 'Accelerated',
    subtitle: 'Building Smarter Products with AI',
    description:
      'A 16-lesson workshop and Decision File for turning one consequential product choice into evidence, alignment, and momentum.',
    image: '/showcases/service-photographic/accelerated-cohort-workshop-hero.jpg',
    imageAlt: 'A diverse workshop group collaborating around laptops and printed materials',
    href: '/accelerated',
    cta: 'Explore Accelerated',
  },
  {
    slug: 'agentified',
    eyebrow: 'Agentic operating workshop',
    title: 'Agentified',
    subtitle: 'Achieve agentic scale through trust',
    description:
      'A 16-lesson workshop for leaders building governed agentic systems with clear authority, memory, approvals, evaluation, and receipts.',
    image: '/agentified-cover.jpg',
    imageAlt: 'Agentified book cover',
    href: '/agentified',
    cta: 'Explore Agentified',
  },
] as const

export default function FlagshipWorkshops({ className = '' }: { className?: string }) {
  return (
    <section aria-labelledby="flagship-workshops-title" className={className}>
      <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-[10px] uppercase tracking-[0.24em] text-radiant-gold">
            Guided learning systems
          </p>
          <h2 id="flagship-workshops-title" className="mt-2 font-premium text-3xl text-foreground sm:text-4xl">
            Flagship workshops
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          Start with the book, work through the guided lessons, and leave with an operating artifact you can keep using.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {workshops.map((workshop) => (
          <article
            key={workshop.slug}
            className="group grid min-w-0 overflow-hidden rounded-2xl border border-radiant-gold/20 bg-card shadow-[0_22px_70px_rgba(18,30,49,0.10)] sm:grid-cols-[minmax(0,1.08fr)_minmax(210px,0.92fr)] dark:bg-silicon-slate/35"
          >
            <div className="flex min-w-0 flex-col p-6 sm:p-7">
              <div className="mb-5 flex items-center gap-2 text-radiant-gold">
                {workshop.slug === 'accelerated' ? <PlayCircle size={17} aria-hidden="true" /> : <BookOpen size={17} aria-hidden="true" />}
                <span className="font-heading text-[10px] uppercase tracking-[0.18em]">{workshop.eyebrow}</span>
              </div>
              <h3 className="font-premium text-3xl text-card-foreground">{workshop.title}</h3>
              <p className="mt-1 text-sm font-semibold text-radiant-gold">{workshop.subtitle}</p>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">{workshop.description}</p>
              <Link
                href={workshop.href}
                className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border border-radiant-gold/30 px-4 py-2 font-heading text-[10px] uppercase tracking-[0.16em] text-radiant-gold transition hover:bg-radiant-gold/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {workshop.cta}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>

            <div className={`relative order-first min-h-64 overflow-hidden border-b border-radiant-gold/15 sm:order-none sm:min-h-full sm:border-b-0 sm:border-l ${workshop.slug === 'agentified' ? 'bg-[#121e31]' : ''}`}>
              <Image
                src={workshop.image}
                alt={workshop.imageAlt}
                fill
                className={workshop.slug === 'agentified' ? 'object-contain p-5' : 'object-cover'}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 45vw, 25vw"
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export { workshops as flagshipWorkshops }
