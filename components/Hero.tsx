'use client'

import Link from 'next/link'
import { ArrowDown, ArrowRight } from 'lucide-react'

const HERO_POSTER =
  '/prototypes/portfolio-pipeline-hero/amadutown-storefront-pipeline-hero-approved-20260617.png'
const HERO_VIDEO =
  '/prototypes/portfolio-pipeline-hero/higgsfield-gold-pipeline-loop-desktop-only-360-starburst-web-20260617.mp4'

export default function Hero() {
  return (
    <section
      id="home"
      data-section="hero"
      className="relative min-h-[100svh] overflow-hidden bg-[#05090f] text-platinum-white"
    >
      <video
        className="absolute inset-0 h-full w-full object-cover object-[center_bottom] sm:object-center"
        poster={HERO_POSTER}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      >
        <source src={HERO_VIDEO} type="video/mp4" />
      </video>

      <div className="absolute inset-0 bg-[#05090f]/18" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,9,15,0.74)_0%,rgba(5,9,15,0.52)_22%,rgba(5,9,15,0.22)_48%,rgba(5,9,15,0.04)_74%,rgba(5,9,15,0)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,9,15,0.86)_0%,rgba(5,9,15,0.68)_34%,rgba(5,9,15,0.36)_64%,rgba(5,9,15,0.42)_100%)] sm:hidden" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#05090f]/84 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#05090f] to-transparent" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute right-[10%] top-[32%] hidden h-24 w-24 rounded-full border border-radiant-gold/15 bg-radiant-gold/10 blur-xl motion-safe:animate-glow-pulse sm:block" />
        <div className="absolute right-[5%] top-[62%] hidden h-24 w-24 rounded-full border border-radiant-gold/15 bg-radiant-gold/10 blur-xl motion-safe:animate-glow-pulse [animation-delay:2s] sm:block" />
      </div>

      <div className="relative z-10 flex min-h-[100svh] items-center px-5 pb-24 pt-28 sm:px-8 lg:px-12">
        <div className="max-w-[43rem]">
          <p className="mb-6 font-heading text-[0.68rem] uppercase tracking-[0.32em] text-radiant-gold/90">
            AI Operations Infrastructure
          </p>
          <h1 className="font-premium text-[clamp(3.35rem,7.6vw,8rem)] font-medium leading-[0.9] text-platinum-white sm:text-[clamp(4.2rem,7.6vw,8rem)]">
            Turn disconnected work into one operating system.
          </h1>
          <p className="mt-8 max-w-[32rem] font-body text-base leading-8 text-platinum-white/76 sm:text-lg">
            AmaduTown designs the automation layer that connects intake, scheduling,
            communications, service delivery, billing, reporting, and knowledge management.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a
              href="#contact"
              className="inline-flex h-12 items-center justify-center gap-3 rounded-full bg-radiant-gold px-6 font-heading text-[0.68rem] uppercase tracking-[0.22em] text-[#08101a] shadow-gold-glow transition hover:bg-gold-light"
            >
              Map the System
              <ArrowRight size={15} />
            </a>
            <Link
              href="/work"
              className="inline-flex h-12 items-center justify-center gap-3 rounded-full border border-platinum-white/18 bg-platinum-white/[0.03] px-6 font-heading text-[0.68rem] uppercase tracking-[0.22em] text-platinum-white/82 backdrop-blur-md transition hover:border-radiant-gold/60 hover:text-radiant-gold"
            >
              See the Work
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute bottom-16 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-3 font-heading text-[0.62rem] uppercase tracking-[0.28em] text-platinum-white/42 sm:flex">
        <span>Scroll</span>
        <ArrowDown size={14} className="text-radiant-gold" />
      </div>
    </section>
  )
}
