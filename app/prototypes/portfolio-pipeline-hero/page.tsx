import Image from 'next/image'
import Link from 'next/link'
import { ArrowDown, ArrowRight, Gauge, Network, Workflow } from 'lucide-react'

const HERO_IMAGE = '/prototypes/portfolio-pipeline-hero/canva-hero-pipeline-candidate-02.png'

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
          src={HERO_IMAGE}
          alt="Exploded business operating floor connected by a polished gold infrastructure pipeline."
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />

        <div className="absolute inset-0 bg-[#05090f]/24" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#05090f_0%,rgba(5,9,15,0.88)_22%,rgba(5,9,15,0.58)_47%,rgba(5,9,15,0.18)_75%,rgba(5,9,15,0.04)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,9,15,0.96)_0%,rgba(5,9,15,0.78)_44%,rgba(5,9,15,0.52)_100%)] sm:hidden" />
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[#05090f]/90 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#05090f] to-transparent" />

        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <svg
            className="absolute bottom-[2%] left-[6%] hidden w-[43rem] max-w-[52vw] opacity-[0.36] mix-blend-screen lg:block"
            viewBox="0 0 720 390"
            fill="none"
          >
            <defs>
              <linearGradient id="storefrontGold" x1="72" y1="35" x2="644" y2="314" gradientUnits="userSpaceOnUse">
                <stop stopColor="#F5D060" stopOpacity="0.92" />
                <stop offset="0.55" stopColor="#D4AF37" stopOpacity="0.56" />
                <stop offset="1" stopColor="#8B6914" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="storefrontGlass" x1="96" y1="120" x2="610" y2="335" gradientUnits="userSpaceOnUse">
                <stop stopColor="#EAECEE" stopOpacity="0.2" />
                <stop offset="1" stopColor="#EAECEE" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path
              d="M91 121H626V333H91V121Z"
              fill="url(#storefrontGlass)"
              stroke="url(#storefrontGold)"
              strokeWidth="1.4"
            />
            <path d="M119 156H292V333H119V156Z" stroke="url(#storefrontGold)" strokeWidth="1.2" />
            <path d="M331 156H598V333H331V156Z" stroke="url(#storefrontGold)" strokeWidth="1.2" />
            <path d="M91 121L142 66H678L626 121H91Z" fill="#D4AF37" fillOpacity="0.08" stroke="url(#storefrontGold)" strokeWidth="1.4" />
            <path d="M142 66H678L646 101H111L142 66Z" fill="#05090f" fillOpacity="0.34" />
            {Array.from({ length: 8 }).map((_, index) => {
              const x = 143 + index * 67
              return (
                <path
                  key={x}
                  d={`M${x} 66L${x - 31} 101H${x + 36}L${x + 67} 66H${x}Z`}
                  fill={index % 2 === 0 ? '#D4AF37' : '#EAECEE'}
                  fillOpacity={index % 2 === 0 ? 0.26 : 0.12}
                />
              )
            })}
            <path d="M111 101H646V121H91L111 101Z" fill="#D4AF37" fillOpacity="0.1" />
            <path d="M91 121H626" stroke="#F5D060" strokeOpacity="0.54" strokeWidth="1.2" />
            <path d="M205 156V333" stroke="#EAECEE" strokeOpacity="0.18" strokeWidth="1" />
            <path d="M464 156V333" stroke="#EAECEE" strokeOpacity="0.18" strokeWidth="1" />
            <path d="M115 333H636" stroke="#D4AF37" strokeOpacity="0.38" strokeWidth="1.6" />
            <path d="M60 350H672" stroke="#EAECEE" strokeOpacity="0.1" strokeWidth="1" />
            <path d="M267 216C304 210 332 221 367 215C406 209 425 190 461 188C498 186 526 204 556 197" stroke="#D4AF37" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div className="absolute left-[47%] top-[55%] h-px w-[34rem] rotate-[-24deg] bg-gradient-to-r from-transparent via-radiant-gold/90 to-transparent opacity-70 shadow-gold-glow-lg motion-safe:animate-[pipelineSweep_4.8s_ease-in-out_infinite]" />
          <div className="absolute right-[10%] top-[32%] h-24 w-24 rounded-full border border-radiant-gold/20 bg-radiant-gold/10 blur-xl motion-safe:animate-glow-pulse" />
          <div className="absolute right-[24%] top-[52%] h-20 w-20 rounded-full border border-radiant-gold/20 bg-radiant-gold/10 blur-xl motion-safe:animate-glow-pulse [animation-delay:1.2s]" />
          <div className="absolute right-[5%] top-[62%] h-24 w-24 rounded-full border border-radiant-gold/20 bg-radiant-gold/10 blur-xl motion-safe:animate-glow-pulse [animation-delay:2s]" />
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
