'use client'

import Link from 'next/link'
import { ArrowDown, ArrowRight } from 'lucide-react'
import { useEffect, useRef } from 'react'

const HERO_DARK_POSTER =
  '/prototypes/portfolio-pipeline-hero/amadutown-storefront-pipeline-hero-approved-20260617.png'
const HERO_DARK_VIDEO =
  '/prototypes/portfolio-pipeline-hero/higgsfield-gold-pipeline-loop-desktop-only-360-starburst-web-20260617.mp4'
const HERO_LIGHT_POSTER =
  '/prototypes/portfolio-pipeline-hero/higgsfield-light-mode-hero-still-20260628.png'
const HERO_LIGHT_VIDEO =
  '/prototypes/portfolio-pipeline-hero/higgsfield-light-mode-hero-loop-web-20260628.mp4'
const ORB_GLOW_SCROLL_POINT = 0.75

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const lightVideoRef = useRef<HTMLVideoElement>(null)
  const darkVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const videos = [lightVideoRef.current, darkVideoRef.current].filter(
      (video): video is HTMLVideoElement => Boolean(video),
    )

    if (!section || videos.length === 0) return

    let animationFrame = 0

    const updateVideoProgress = () => {
      animationFrame = 0

      const scrollDistance = section.offsetHeight - window.innerHeight
      const sectionTop = section.getBoundingClientRect().top
      const scrollProgress =
        scrollDistance > 0 ? clamp(-sectionTop / scrollDistance, 0, 1) : 0
      const videoProgress = clamp(scrollProgress / ORB_GLOW_SCROLL_POINT, 0, 1)
      videos.forEach((video) => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0

        if (duration > 0) {
          const targetTime = Math.min(duration - 0.05, videoProgress * duration)

          if (Math.abs(video.currentTime - targetTime) > 0.04) {
            video.currentTime = targetTime
          }
        }

        if (!video.paused) {
          video.pause()
        }
      })
    }

    const requestUpdate = () => {
      if (animationFrame) return
      animationFrame = window.requestAnimationFrame(updateVideoProgress)
    }

    videos.forEach((video) => {
      video.pause()
      video.currentTime = 0
    })
    requestUpdate()

    videos.forEach((video) => video.addEventListener('loadedmetadata', requestUpdate))
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame)
      videos.forEach((video) => video.removeEventListener('loadedmetadata', requestUpdate))
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      id="home"
      data-section="hero"
      className="relative z-10 h-[240svh] bg-[#fbf7ee] text-[#08101a] dark:bg-[#05090f] dark:text-platinum-white"
    >
      <div className="sticky top-0 min-h-[100svh] overflow-hidden">
        <video
          ref={lightVideoRef}
          data-theme-video="light"
          className="absolute inset-0 h-full w-full object-cover object-[center_bottom] dark:hidden sm:object-center"
          poster={HERO_LIGHT_POSTER}
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
        >
          <source src={HERO_LIGHT_VIDEO} type="video/mp4" />
        </video>
        <video
          ref={darkVideoRef}
          data-theme-video="dark"
          className="absolute inset-0 hidden h-full w-full object-cover object-[center_bottom] dark:block sm:object-center"
          poster={HERO_DARK_POSTER}
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
        >
          <source src={HERO_DARK_VIDEO} type="video/mp4" />
        </video>

        <div className="absolute inset-0 bg-white/[0.08] dark:bg-[#05090f]/18" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(251,247,238,0.88)_0%,rgba(251,247,238,0.68)_22%,rgba(251,247,238,0.24)_48%,rgba(251,247,238,0.06)_74%,rgba(251,247,238,0)_100%)] dark:bg-[linear-gradient(90deg,rgba(5,9,15,0.74)_0%,rgba(5,9,15,0.52)_22%,rgba(5,9,15,0.22)_48%,rgba(5,9,15,0.04)_74%,rgba(5,9,15,0)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(251,247,238,0.9)_0%,rgba(251,247,238,0.72)_34%,rgba(251,247,238,0.44)_64%,rgba(251,247,238,0.5)_100%)] dark:bg-[linear-gradient(180deg,rgba(5,9,15,0.86)_0%,rgba(5,9,15,0.68)_34%,rgba(5,9,15,0.36)_64%,rgba(5,9,15,0.42)_100%)] sm:hidden" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#fbf7ee]/70 to-transparent dark:from-[#05090f]/84" />
        <div className="absolute inset-x-0 bottom-0 h-72 bg-[linear-gradient(0deg,#fbf7ee_0%,rgba(251,247,238,0.86)_24%,rgba(251,247,238,0.48)_58%,rgba(251,247,238,0)_100%)] dark:bg-[linear-gradient(0deg,#121E31_0%,rgba(18,30,49,0.92)_24%,rgba(7,16,26,0.64)_58%,rgba(5,9,15,0)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-[radial-gradient(ellipse_at_72%_100%,rgba(212,175,55,0.13),transparent_58%)] dark:bg-[radial-gradient(ellipse_at_72%_100%,rgba(212,175,55,0.18),transparent_58%)]" />

        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute right-[10%] top-[32%] hidden h-24 w-24 rounded-full border border-radiant-gold/15 bg-radiant-gold/10 blur-xl motion-safe:animate-glow-pulse sm:block" />
          <div className="absolute right-[5%] top-[62%] hidden h-24 w-24 rounded-full border border-radiant-gold/15 bg-radiant-gold/10 blur-xl motion-safe:animate-glow-pulse [animation-delay:2s] sm:block" />
        </div>

        <div className="relative z-10 flex min-h-[100svh] items-center px-5 pb-24 pt-28 sm:px-8 lg:px-12">
          <div className="max-w-[43rem]">
            <p className="mb-6 font-heading text-[0.68rem] uppercase tracking-[0.32em] text-radiant-gold/90">
              AI Operations Infrastructure
            </p>
            <h1 className="font-premium text-[clamp(3.35rem,7.6vw,8rem)] font-medium leading-[0.9] text-[#08101a] dark:text-platinum-white sm:text-[clamp(4.2rem,7.6vw,8rem)]">
              Turn disconnected work into one operating system.
            </h1>
            <p className="mt-8 max-w-[32rem] font-body text-base leading-8 text-[#243449]/78 dark:text-platinum-white/76 sm:text-lg">
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
                className="inline-flex h-12 items-center justify-center gap-3 rounded-full border border-[#08101a]/16 bg-white/40 px-6 font-heading text-[0.68rem] uppercase tracking-[0.22em] text-[#08101a]/82 backdrop-blur-md transition hover:border-radiant-gold/70 hover:text-[#6f5600] dark:border-platinum-white/18 dark:bg-platinum-white/[0.03] dark:text-platinum-white/82 dark:hover:border-radiant-gold/60 dark:hover:text-radiant-gold"
              >
                See the Work
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute bottom-16 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-3 font-heading text-[0.62rem] uppercase tracking-[0.28em] text-[#08101a]/46 dark:text-platinum-white/42 sm:flex">
          <span>Scroll</span>
          <ArrowDown size={14} className="text-radiant-gold" />
        </div>
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 -bottom-20 z-20 h-28 bg-[linear-gradient(180deg,rgba(251,247,238,0.78)_0%,rgba(251,247,238,0.34)_52%,rgba(251,247,238,0)_100%)] dark:bg-[linear-gradient(180deg,rgba(18,30,49,0.78)_0%,rgba(18,30,49,0.34)_52%,rgba(18,30,49,0)_100%)]"
        aria-hidden="true"
      />
    </section>
  )
}
