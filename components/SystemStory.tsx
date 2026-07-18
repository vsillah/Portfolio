'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Route, ScanSearch, Workflow, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const SYSTEM_STORY_ASSET_PATH = '/prototypes/portfolio-pipeline-hero'

type SystemStoryFrame = {
  title: string
  copy: string
  image: string
  icon: LucideIcon
  calloutTitle: string
  detail: string
}

const frames: SystemStoryFrame[] = [
  {
    title: "The work is already there. It just isn't connected.",
    copy:
      'Small businesses can have the right people, tools, and intentions while intake, scheduling, communications, delivery, billing, reporting, and knowledge still move in separate rooms.',
    image: `${SYSTEM_STORY_ASSET_PATH}/system-story-fragmented-rooms-20260617.webp`,
    icon: ScanSearch,
    calloutTitle: 'Intake Drift Detected',
    detail:
      'Diagnostic read: requests enter through one channel, scheduling lives somewhere else, delivery updates depend on memory, and billing or reporting only appears after the work has already moved.',
  },
  {
    title: 'We map the operating system.',
    copy:
      'AmaduTown traces how work enters, where decisions wait, and which handoffs create repeat effort. The map turns scattered activity into a buildable blueprint.',
    image: `${SYSTEM_STORY_ASSET_PATH}/system-story-blueprint-map-20260617.webp`,
    icon: Route,
    calloutTitle: 'Handoffs Under Review',
    detail:
      'Mapping follows the path from first inquiry to completed service, marking where ownership changes, where decisions pause, and where the same information gets retyped across tools.',
  },
  {
    title: 'Then we connect the work.',
    copy:
      'Automations, agents, dashboards, and reusable playbooks become the piping between departments, so the business operates with less chasing and clearer follow-through.',
    image: `${SYSTEM_STORY_ASSET_PATH}/system-story-connected-pipeline-20260617.webp`,
    icon: Workflow,
    calloutTitle: 'Operating Layer Engaged',
    detail:
      'The connection layer turns those mapped handoffs into triggers, dashboards, reminders, and reusable playbooks so the business can move as one system instead of separate rooms.',
  },
]

const systemFunctions = [
  'Intake',
  'Scheduling',
  'Communications',
  'Delivery',
  'Billing',
  'Reporting',
  'Knowledge',
]

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export default function SystemStory() {
  const sectionRef = useRef<HTMLElement>(null)
  const [activeFrame, setActiveFrame] = useState(0)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    let animationFrame = 0

    const updateActiveFrame = () => {
      animationFrame = 0

      const scrollDistance = section.offsetHeight - window.innerHeight
      const sectionTop = section.getBoundingClientRect().top
      const progress = scrollDistance > 0 ? clamp(-sectionTop / scrollDistance, 0, 1) : 0
      const nextFrame = clamp(Math.floor(progress * frames.length), 0, frames.length - 1)

      setActiveFrame((current) => (current === nextFrame ? current : nextFrame))
    }

    const requestUpdate = () => {
      if (animationFrame) return
      animationFrame = window.requestAnimationFrame(updateActiveFrame)
    }

    requestUpdate()
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
    }
  }, [])

  const ActiveIcon = frames[activeFrame].icon

  return (
    <section
      ref={sectionRef}
      id="system"
      data-section="system-story"
      className="relative h-[320svh] scroll-mt-24 bg-[#f4f6fa] text-[#121E31] dark:bg-[#121E31] dark:text-platinum-white"
    >
      <div className="sticky top-0 min-h-[100svh] overflow-hidden">
        <div className="absolute inset-0 bg-[#f4f6fa] dark:bg-[#121E31]" />

        {frames.map((frame, index) => (
          <Image
            key={frame.image}
            src={frame.image}
            alt=""
            fill
            sizes="100vw"
            className={`object-cover object-center transition-opacity duration-700 ${
              activeFrame === index ? 'opacity-[0.44]' : 'opacity-0'
            }`}
            aria-hidden="true"
            priority={index === 0}
          />
        ))}

        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(244,246,250,0.76)_0%,rgba(244,246,250,0.58)_30%,rgba(244,246,250,0.18)_66%,rgba(244,246,250,0.34)_100%)] dark:bg-[linear-gradient(90deg,#121E31_0%,rgba(18,30,49,0.9)_28%,rgba(18,30,49,0.46)_62%,rgba(18,30,49,0.72)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_74%_44%,rgba(212,175,55,0.10),transparent_42%)] dark:bg-[radial-gradient(ellipse_at_74%_44%,rgba(212,175,55,0.12),transparent_42%)]" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#f4f6fa]/60 to-transparent dark:from-[#121E31]" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#f4f6fa]/56 to-transparent dark:from-[#121E31]" />

        <div className="pointer-events-none absolute inset-0 opacity-50" aria-hidden="true">
          <svg className="h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="none">
            <path
              d="M0 650 C240 590 350 720 520 610 C720 480 820 610 1010 490 C1180 380 1280 420 1440 330"
              fill="none"
              stroke="rgba(212,175,55,0.26)"
              strokeWidth="1.5"
            />
            <path
              d="M0 710 C260 640 390 790 570 660 C760 522 850 682 1060 535 C1200 437 1290 465 1440 390"
              fill="none"
              stroke="rgba(234,236,238,0.08)"
              strokeWidth="1"
            />
          </svg>
        </div>

        <div className="relative z-10 flex min-h-[100svh] items-center px-5 py-28 sm:px-8 lg:px-12">
          <div className="grid w-full items-center gap-12 lg:grid-cols-[minmax(0,0.86fr)_minmax(24rem,0.64fr)]">
            <div className="max-w-[46rem]">
              <div className="mb-8 flex items-center gap-4 font-heading text-[0.62rem] uppercase tracking-[0.24em] text-radiant-gold/80">
                <span>System Story</span>
                <span className="h-px w-12 bg-radiant-gold/30" />
                <span>{String(activeFrame + 1).padStart(2, '0')} / 03</span>
              </div>

              <h2 className="font-premium text-[clamp(2.85rem,6.6vw,6.8rem)] font-medium leading-[0.92] text-[#121E31] dark:text-platinum-white">
                {frames[activeFrame].title}
              </h2>

              <p className="mt-7 max-w-[37rem] font-body text-base leading-8 text-[#2C3E50]/[0.86] dark:text-platinum-white/74 sm:text-lg">
                {frames[activeFrame].copy}
              </p>

              <div className="mt-9 flex flex-wrap gap-2">
                {systemFunctions.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[#121E31]/10 bg-white/70 px-3 py-2 font-heading text-[0.57rem] uppercase tracking-[0.16em] text-[#121E31]/[0.58] backdrop-blur-sm dark:border-platinum-white/10 dark:bg-platinum-white/[0.04] dark:text-platinum-white/58"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#contact"
                  className="inline-flex h-12 items-center justify-center gap-3 rounded-full bg-radiant-gold px-6 font-heading text-[0.68rem] uppercase tracking-[0.22em] text-[#08101a] shadow-gold-glow transition hover:bg-gold-light"
                >
                  Map My System
                  <ArrowRight size={15} />
                </a>
                <Link
                  href="#services"
                  className="inline-flex h-12 items-center justify-center gap-3 rounded-full border border-[#121E31]/[0.18] bg-white/[0.65] px-6 font-heading text-[0.68rem] uppercase tracking-[0.22em] text-[#121E31]/[0.82] backdrop-blur-md transition hover:border-radiant-gold/60 hover:text-radiant-gold dark:border-platinum-white/18 dark:bg-platinum-white/[0.03] dark:text-platinum-white/82"
                >
                  See Services
                </Link>
              </div>
            </div>

            <div className="relative hidden min-h-[32rem] lg:block" aria-hidden="true">
              <svg
                className="absolute right-0 top-1/2 h-[28rem] w-[28rem] -translate-y-1/2"
                viewBox="0 0 448 448"
                fill="none"
              >
                <circle
                  key={`ring-${activeFrame}`}
                  className="system-focus-ring"
                  cx="224"
                  cy="224"
                  r="222"
                  stroke="rgba(212,175,55,0.18)"
                  strokeWidth="1.5"
                />
              </svg>
              <div
                key={`orb-primary-${activeFrame}`}
                className="system-focus-orb absolute right-[6.5rem] top-[7rem] h-5 w-5 rounded-full bg-radiant-gold"
              />
              <div
                key={`orb-secondary-${activeFrame}`}
                className="system-focus-orb absolute right-[16rem] top-[17rem] h-3 w-3 rounded-full bg-radiant-gold/60"
                style={{ animationDelay: '180ms' }}
              />
              <div
                key={`orb-tertiary-${activeFrame}`}
                className="system-focus-orb absolute bottom-[4.25rem] right-[3.5rem] h-4 w-4 rounded-full bg-radiant-gold/75"
                style={{ animationDelay: '320ms' }}
              />

              <div
                key={`callout-${activeFrame}`}
                className="absolute bottom-0 right-0 w-full max-w-[25rem] pl-8"
              >
                <span className="system-focus-line absolute bottom-0 left-0 h-full w-px bg-radiant-gold/18" />
                <div className="system-focus-icon mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-radiant-gold/28 bg-white/72 text-radiant-gold backdrop-blur dark:bg-[#121E31]/70">
                  <ActiveIcon size={20} />
                </div>
                <p className="system-type-line font-heading text-[0.62rem] uppercase tracking-[0.24em] text-radiant-gold/90">
                  {frames[activeFrame].calloutTitle}
                </p>
                <p className="system-focus-copy mt-4 font-body text-sm leading-7 text-[#2C3E50]/[0.78] dark:text-platinum-white/66">
                  {frames[activeFrame].detail}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-10 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3">
          {frames.map((frame, index) => (
            <span
              key={frame.title}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                activeFrame === index ? 'w-10 bg-radiant-gold' : 'w-2 bg-[#121E31]/[0.24] dark:bg-platinum-white/24'
              }`}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        .system-focus-ring {
          stroke-dasharray: 1395;
          stroke-dashoffset: 1395;
          filter: drop-shadow(0 0 14px rgba(212, 175, 55, 0.18));
          animation: system-ring-draw 920ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .system-focus-line {
          transform-origin: bottom;
          transform: scaleY(0);
          animation: system-line-draw 620ms cubic-bezier(0.22, 1, 0.36, 1) 320ms forwards;
        }

        .system-focus-icon {
          opacity: 0;
          transform: translateY(10px) scale(0.92);
          animation: system-focus-in 520ms cubic-bezier(0.22, 1, 0.36, 1) 520ms forwards;
        }

        .system-focus-orb {
          opacity: 0;
          box-shadow: 0 0 0 rgba(212, 175, 55, 0);
          transform: scale(0.8);
          animation: system-orb-glow 1400ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .system-type-line {
          display: inline-block;
          max-width: max-content;
          overflow: hidden;
          white-space: nowrap;
          opacity: 0;
          border-right: 1px solid rgba(212, 175, 55, 0.62);
          animation:
            system-type-reveal 820ms steps(24, end) 720ms forwards,
            system-caret 740ms steps(1, end) 720ms 2;
        }

        .system-focus-copy {
          opacity: 0;
          transform: translateY(8px);
          animation: system-focus-in 560ms cubic-bezier(0.22, 1, 0.36, 1) 1100ms forwards;
        }

        @keyframes system-ring-draw {
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes system-line-draw {
          to {
            transform: scaleY(1);
          }
        }

        @keyframes system-focus-in {
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes system-orb-glow {
          0% {
            opacity: 0;
            transform: scale(0.8);
            box-shadow: 0 0 0 rgba(212, 175, 55, 0);
          }
          45% {
            opacity: 1;
            transform: scale(1.18);
            box-shadow:
              0 0 18px rgba(212, 175, 55, 0.72),
              0 0 46px rgba(212, 175, 55, 0.28);
          }
          100% {
            opacity: 1;
            transform: scale(1);
            box-shadow:
              0 0 14px rgba(212, 175, 55, 0.54),
              0 0 34px rgba(212, 175, 55, 0.18);
          }
        }

        @keyframes system-type-reveal {
          from {
            width: 0;
            opacity: 1;
          }
          to {
            width: 100%;
            opacity: 1;
          }
        }

        @keyframes system-caret {
          0%,
          100% {
            border-color: transparent;
          }
          50% {
            border-color: rgba(212, 175, 55, 0.62);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .system-focus-ring,
          .system-focus-line,
          .system-focus-icon,
          .system-focus-orb,
          .system-type-line,
          .system-focus-copy {
            animation: none;
            opacity: 1;
            transform: none;
            stroke-dashoffset: 0;
            width: auto;
          }

          .system-type-line {
            border-right: 0;
          }
        }
      `}</style>
    </section>
  )
}
