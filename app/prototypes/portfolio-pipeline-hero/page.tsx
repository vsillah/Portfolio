import Image from 'next/image'
import Link from 'next/link'
import { ArrowDown, ArrowRight, Gauge, Network, Workflow } from 'lucide-react'

const HERO_IMAGE_DESKTOP = '/prototypes/portfolio-pipeline-hero/amadutown-storefront-pipeline-hero-v2.png'
const HERO_IMAGE_MOBILE = '/prototypes/portfolio-pipeline-hero/amadutown-storefront-pipeline-hero-mobile-v2.png'

const operatingSignals = [
  {
    label: 'Intake',
    value: 'Lead context captured before the first handoff.',
  },
  {
    label: 'Delivery',
    value: 'Work moves through one visible operating layer.',
  },
  {
    label: 'Reporting',
    value: 'Every room feeds the same decision system.',
  },
]

const proofPoints = [
  {
    Icon: Network,
    title: 'Disconnected functions',
    body: 'Client intake, scheduling, communications, service delivery, billing, reporting, and playbooks keep their own shape.',
  },
  {
    Icon: Workflow,
    title: 'Gold operating layer',
    body: 'AmaduTown becomes the infrastructure that routes data, decisions, approvals, and follow-up through the whole business.',
  },
  {
    Icon: Gauge,
    title: 'Coordinated output',
    body: 'The business starts to feel less like separate rooms and more like one operating system.',
  },
]

export default function PortfolioPipelineHeroPrototypePage() {
  return (
    <main className="min-h-screen bg-[#05090f] text-platinum-white">
      <section className="relative min-h-[100svh] overflow-hidden">
        <Image
          src={HERO_IMAGE_DESKTOP}
          alt="Exploded business operating floor connected by a polished gold infrastructure pipeline."
          fill
          priority
          sizes="100vw"
          className="hidden object-cover object-center sm:block"
        />
        <Image
          src={HERO_IMAGE_MOBILE}
          alt="Small local business storefront and operating rooms connected by a polished gold infrastructure pipeline."
          fill
          priority
          sizes="100vw"
          className="object-cover object-center sm:hidden"
        />

        <div className="absolute inset-0 bg-[#05090f]/24" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#05090f_0%,rgba(5,9,15,0.88)_22%,rgba(5,9,15,0.58)_47%,rgba(5,9,15,0.18)_75%,rgba(5,9,15,0.04)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,9,15,0.96)_0%,rgba(5,9,15,0.78)_44%,rgba(5,9,15,0.52)_100%)] sm:hidden" />
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[#05090f]/90 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#05090f] to-transparent" />

        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute left-[47%] top-[55%] hidden h-px w-[34rem] rotate-[-24deg] bg-gradient-to-r from-transparent via-radiant-gold/90 to-transparent opacity-60 shadow-gold-glow-lg motion-safe:animate-[pipelineSweep_4.8s_ease-in-out_infinite] sm:block" />
          <div className="absolute right-[10%] top-[32%] hidden h-24 w-24 rounded-full border border-radiant-gold/20 bg-radiant-gold/10 blur-xl motion-safe:animate-glow-pulse sm:block" />
          <div className="absolute right-[24%] top-[52%] hidden h-20 w-20 rounded-full border border-radiant-gold/20 bg-radiant-gold/10 blur-xl motion-safe:animate-glow-pulse [animation-delay:1.2s] sm:block" />
          <div className="absolute right-[5%] top-[62%] hidden h-24 w-24 rounded-full border border-radiant-gold/20 bg-radiant-gold/10 blur-xl motion-safe:animate-glow-pulse [animation-delay:2s] sm:block" />
        </div>

        <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
          <Link href="/" className="font-heading text-xs tracking-[0.32em] text-platinum-white/88">
            AMADUTOWN
          </Link>
          <nav className="hidden items-center gap-8 text-[0.68rem] uppercase tracking-[0.24em] text-platinum-white/62 md:flex">
            <Link href="/services" className="transition hover:text-radiant-gold">
              Services
            </Link>
            <Link href="/work" className="transition hover:text-radiant-gold">
              Work
            </Link>
            <Link href="/contact" className="transition hover:text-radiant-gold">
              Contact
            </Link>
          </nav>
        </header>

        <div className="relative z-10 flex min-h-[calc(100svh-5rem)] items-center px-5 pb-24 pt-12 sm:px-8 lg:px-12">
          <div className="max-w-[44rem]">
            <p className="mb-6 font-heading text-[0.68rem] uppercase tracking-[0.32em] text-radiant-gold/90">
              AI Operations Infrastructure
            </p>
            <h1 className="font-premium text-[clamp(3.8rem,8vw,8.2rem)] font-medium leading-[0.9] text-platinum-white">
              Turn disconnected work into one operating system.
            </h1>
            <p className="mt-8 max-w-[34rem] font-body text-base leading-8 text-platinum-white/72 sm:text-lg">
              AmaduTown designs the automation layer that connects intake, scheduling, communications,
              service delivery, billing, reporting, and knowledge management.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/contact"
                className="inline-flex h-12 items-center justify-center gap-3 rounded-full bg-radiant-gold px-6 font-heading text-[0.68rem] uppercase tracking-[0.22em] text-[#08101a] shadow-gold-glow transition hover:bg-gold-light"
              >
                Map the System
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/work"
                className="inline-flex h-12 items-center justify-center gap-3 rounded-full border border-platinum-white/18 bg-platinum-white/[0.03] px-6 font-heading text-[0.68rem] uppercase tracking-[0.22em] text-platinum-white/82 backdrop-blur-md transition hover:border-radiant-gold/60 hover:text-radiant-gold"
              >
                See the Work
              </Link>
            </div>

            <div className="mt-14 grid max-w-[38rem] gap-3 sm:grid-cols-3">
              {operatingSignals.map((signal) => (
                <div
                  key={signal.label}
                  className="border-l border-radiant-gold/34 bg-[#05090f]/22 py-2 pl-4 backdrop-blur-[2px]"
                >
                  <p className="font-heading text-[0.62rem] uppercase tracking-[0.24em] text-radiant-gold">
                    {signal.label}
                  </p>
                  <p className="mt-2 text-sm leading-5 text-platinum-white/62">{signal.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute bottom-5 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-3 font-heading text-[0.62rem] uppercase tracking-[0.28em] text-platinum-white/42 sm:flex">
          <span>Scroll</span>
          <ArrowDown size={14} className="text-radiant-gold" />
        </div>
      </section>

      <section className="relative border-t border-radiant-gold/12 bg-[#05090f] px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="font-heading text-[0.68rem] uppercase tracking-[0.3em] text-radiant-gold/80">
              Prototype Direction
            </p>
            <h2 className="mt-5 font-premium text-4xl leading-tight text-platinum-white sm:text-5xl">
              The homepage opens with the system, not the service menu.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {proofPoints.map(({ Icon, title, body }) => (
              <article
                key={title}
                className="border border-platinum-white/10 bg-platinum-white/[0.035] p-5 backdrop-blur-md"
              >
                <Icon className="mb-7 text-radiant-gold" size={22} strokeWidth={1.6} />
                <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-platinum-white/86">
                  {title}
                </h3>
                <p className="mt-4 text-sm leading-6 text-platinum-white/58">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <style>{`
        @keyframes pipelineSweep {
          0% {
            opacity: 0;
            transform: translateX(-14%) rotate(-24deg) scaleX(0.72);
          }
          28% {
            opacity: 0.9;
          }
          62% {
            opacity: 0.72;
            transform: translateX(18%) rotate(-24deg) scaleX(1);
          }
          100% {
            opacity: 0;
            transform: translateX(34%) rotate(-24deg) scaleX(0.72);
          }
        }
      `}</style>
    </main>
  )
}
