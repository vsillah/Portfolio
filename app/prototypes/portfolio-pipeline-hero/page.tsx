import Image from 'next/image'
import Link from 'next/link'
import { ArrowDown, ArrowRight, Gauge, Network, Workflow } from 'lucide-react'

const HERO_IMAGE_DESKTOP =
  '/prototypes/portfolio-pipeline-hero/higgsfield-light-mode-hero-poster-20260628.webp'
const HERO_IMAGE_MOBILE =
  '/prototypes/portfolio-pipeline-hero/higgsfield-light-mode-hero-poster-20260628.webp'
const HERO_VIDEO_DESKTOP =
  '/prototypes/portfolio-pipeline-hero/higgsfield-light-mode-hero-loop-web-20260628.mp4'

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
    <main className="min-h-screen bg-[#fbf7ee] text-[#08101a]">
      <section className="relative min-h-[100svh] overflow-hidden">
        <Image
          src={HERO_IMAGE_DESKTOP}
          alt="Light-mode AmaduTown operating system hero composition."
          fill
          priority
          sizes="(min-width: 640px) 100vw, 0px"
          className="hidden object-cover object-center sm:block"
        />
        <Image
          src={HERO_IMAGE_MOBILE}
          alt="Light-mode AmaduTown operating system hero composition."
          fill
          priority
          sizes="(max-width: 639px) 100vw, 0px"
          className="object-cover object-[center_bottom] sm:hidden"
        />
        <video
          className="absolute inset-0 h-full w-full object-cover object-[center_bottom] sm:object-center"
          poster={HERO_IMAGE_DESKTOP}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        >
          <source src={HERO_VIDEO_DESKTOP} type="video/mp4" />
        </video>

        <div className="absolute inset-0 bg-white/[0.08]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(251,247,238,0.88)_0%,rgba(251,247,238,0.68)_22%,rgba(251,247,238,0.24)_48%,rgba(251,247,238,0.06)_74%,rgba(251,247,238,0)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(251,247,238,0.9)_0%,rgba(251,247,238,0.72)_34%,rgba(251,247,238,0.44)_64%,rgba(251,247,238,0.5)_100%)] sm:hidden" />
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[#fbf7ee]/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#fbf7ee] to-transparent" />

        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute right-[10%] top-[32%] hidden h-24 w-24 rounded-full border border-radiant-gold/15 bg-radiant-gold/10 blur-xl motion-safe:animate-glow-pulse sm:block" />
          <div className="absolute right-[5%] top-[62%] hidden h-24 w-24 rounded-full border border-radiant-gold/15 bg-radiant-gold/10 blur-xl motion-safe:animate-glow-pulse [animation-delay:2s] sm:block" />
        </div>

        <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
          <Link href="/" className="font-heading text-xs tracking-[0.32em] text-[#08101a]/88">
            AMADUTOWN
          </Link>
          <nav className="hidden items-center gap-8 text-[0.68rem] uppercase tracking-[0.24em] text-[#08101a]/62 md:flex">
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
          <div className="max-w-[43rem]">
            <p className="mb-6 font-heading text-[0.68rem] uppercase tracking-[0.32em] text-radiant-gold/90">
              AI Operations Infrastructure
            </p>
            <h1 className="font-premium text-[clamp(3.35rem,7.6vw,8rem)] font-medium leading-[0.9] text-[#08101a] sm:text-[clamp(4.2rem,7.6vw,8rem)]">
              Turn disconnected work into one operating system.
            </h1>
            <p className="mt-8 max-w-[32rem] font-body text-base leading-8 text-[#243449]/78 sm:text-lg">
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
                className="inline-flex h-12 items-center justify-center gap-3 rounded-full border border-[#08101a]/16 bg-white/40 px-6 font-heading text-[0.68rem] uppercase tracking-[0.22em] text-[#08101a]/82 backdrop-blur-md transition hover:border-radiant-gold/70 hover:text-[#6f5600]"
              >
                See the Work
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute bottom-5 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-3 font-heading text-[0.62rem] uppercase tracking-[0.28em] text-[#08101a]/46 sm:flex">
          <span>Scroll</span>
          <ArrowDown size={14} className="text-radiant-gold" />
        </div>
      </section>

      <section className="relative border-t border-[#08101a]/10 bg-[#fbf7ee] px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="font-heading text-[0.68rem] uppercase tracking-[0.3em] text-radiant-gold/80">
              Prototype Direction
            </p>
            <h2 className="mt-5 font-premium text-4xl leading-tight text-[#08101a] sm:text-5xl">
              The homepage opens with the system, not the service menu.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {proofPoints.map(({ Icon, title, body }) => (
              <article
                key={title}
                className="border border-[#08101a]/10 bg-white/45 p-5 backdrop-blur-md"
              >
                <Icon className="mb-7 text-radiant-gold" size={22} strokeWidth={1.6} />
                <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-[#08101a]/86">
                  {title}
                </h3>
                <p className="mt-4 text-sm leading-6 text-[#243449]/66">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
