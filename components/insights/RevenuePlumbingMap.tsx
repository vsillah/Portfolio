'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import {
  FAUCET_PATH,
  FLYWHEEL_PATH,
  MAP_HEIGHT,
  MAP_WIDTH,
  PIPE_COUPLINGS,
  PIPE_LOOPS_PATH,
  PIPE_RUN_PATH,
  PLUMBING_STEPS,
  STAGE_LABELS,
  STAGE_ORDER,
  type PlumbingStage,
} from './revenue-plumbing-data'

const NAVY = '#121E31'
const SLATE = '#2C3E50'
const PLATINUM = '#EAECEE'
const GOLD = '#D4AF37'
const BRONZE = '#8B6914'
const GOLD_LIGHT = '#F5D060'

const HEADING_FONT = 'var(--font-orbitron), sans-serif'
const PREMIUM_FONT = 'var(--font-cormorant), serif'
const BODY_FONT = 'var(--font-inter), system-ui, sans-serif'

const CHIP_STYLES: Record<PlumbingStage, CSSProperties> = {
  marketing: { background: 'rgba(212,175,55,0.14)', border: '1px solid rgba(212,175,55,0.6)', color: GOLD_LIGHT },
  sales: { background: SLATE, border: '1px solid rgba(234,236,238,0.22)', color: PLATINUM },
  delivery: { background: PLATINUM, border: `1px solid ${PLATINUM}`, color: NAVY },
  expansion: {
    background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
    border: 'none',
    color: NAVY,
    fontWeight: 700,
    boxShadow: '0 0 20px rgba(212,175,55,0.3)',
  },
}

const LEGEND: Array<{ stage: PlumbingStage; left: number; width: number }> = [
  { stage: 'marketing', left: 1090, width: 96 },
  { stage: 'sales', left: 1198, width: 160 },
  { stage: 'delivery', left: 1370, width: 132 },
  { stage: 'expansion', left: 1514, width: 102 },
]

const MAP_CSS = `
@keyframes rpm-flow { to { stroke-dashoffset: -32; } }
@keyframes rpm-fly { to { stroke-dashoffset: -14; } }
@keyframes rpm-pulse { 0% { transform: scale(0.6); opacity: 1; } 100% { transform: scale(2.4); opacity: 0; } }
@keyframes rpm-drip { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(64px); opacity: 0; } }
@keyframes rpm-coin { 0% { transform: translateY(-26px); opacity: 0; } 15% { opacity: 1; } 75% { transform: translateY(26px); opacity: 1; } 100% { transform: translateY(32px); opacity: 0; } }
.rpm-flow { animation: rpm-flow 0.9s linear infinite; }
.rpm-fly { animation: rpm-fly 0.9s linear infinite; }
.rpm-ring { transform-box: fill-box; transform-origin: center; animation: rpm-pulse 1.4s ease-out infinite; }
.rpm-drop { animation: rpm-drip 1.1s ease-in infinite; }
.rpm-coin { animation: rpm-coin 2.4s ease-in infinite; }
.rpm-chip { position: absolute; box-sizing: border-box; display: flex; align-items: center; justify-content: center; text-align: center; border-radius: 8px; font-size: 14px; line-height: 18px; font-weight: 600; padding: 0; cursor: pointer; font-family: inherit; }
.rpm-chip:focus-visible, .rpm-control:focus-visible { outline: 2px solid #ffffff; outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) {
  .rpm-flow, .rpm-fly, .rpm-ring, .rpm-drop, .rpm-coin { animation: none; }
}
`

function PipeStrokes({ d }: { d: string }) {
  return (
    <>
      <path d={d} stroke={BRONZE} strokeWidth={30} />
      <path d={d} stroke={GOLD} strokeWidth={24} />
      <path d={d} stroke={GOLD_LIGHT} strokeWidth={6} />
      <path
        className="rpm-flow"
        d={d}
        stroke="#FFF6D6"
        strokeWidth={4}
        strokeDasharray="6 26"
        strokeLinecap="round"
        opacity={0.85}
      />
    </>
  )
}

interface RevenuePlumbingMapProps {
  /** Seconds each step stays on screen while the walkthrough is playing. */
  secondsPerStep?: number
}

export default function RevenuePlumbingMap({ secondsPerStep = 5 }: RevenuePlumbingMapProps) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [compactControls, setCompactControls] = useState(false)
  const [scale, setScale] = useState(1)
  const frameRef = useRef<HTMLDivElement>(null)

  const total = PLUMBING_STEPS.length
  const current = PLUMBING_STEPS[index]

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setPlaying(false)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const query = window.matchMedia('(max-width: 1023px)')
    const update = () => setCompactControls(query.matches)
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const update = () => setScale(frame.clientWidth / MAP_WIDTH)
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % total),
      Math.max(2, secondsPerStep) * 1000,
    )
    return () => window.clearInterval(timer)
  }, [playing, secondsPerStep, total])

  const pick = useCallback((i: number) => {
    setIndex(i)
    setPlaying(false)
  }, [])

  const counter = `Leak ${String(index + 1).padStart(2, '0')} of ${total}`

  return (
    <div style={{ fontFamily: BODY_FONT }}>
      <style>{MAP_CSS}</style>

      {/* Map: fixed 1680 x 1470 canvas, scaled to the available width */}
      <div
        ref={frameRef}
        className="relative w-full overflow-hidden rounded-xl border border-radiant-gold/30"
        style={{ height: MAP_HEIGHT * scale, background: NAVY }}
      >
        <div
          aria-hidden={compactControls || undefined}
          data-testid="revenue-map-overview"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: MAP_WIDTH,
            height: MAP_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            background: `radial-gradient(circle at 88% 0%, rgba(139,105,20,0.20), rgba(18,30,49,0) 46%), ${NAVY}`,
            color: PLATINUM,
          }}
        >
          {/* Reinvest flywheel */}
          <svg
            aria-hidden
            width={300}
            height={1020}
            viewBox="120 400 300 1020"
            style={{ position: 'absolute', left: 120, top: 400, overflow: 'visible' }}
            fill="none"
            stroke={GOLD_LIGHT}
            strokeWidth={2}
            strokeLinecap="round"
          >
            <defs>
              <marker id="rpm-arrow-head" orient="auto" markerWidth={6} markerHeight={6} refX={2} refY={2} overflow="visible">
                <path d="M0 0 L5 2 L0 4 Z" fill={GOLD_LIGHT} stroke="none" />
              </marker>
            </defs>
            <path className="rpm-fly" d={FLYWHEEL_PATH} strokeDasharray="6 8" markerEnd="url(#rpm-arrow-head)" />
          </svg>

          {/* Barrel: the market */}
          <svg aria-hidden width={280} height={360} viewBox="0 0 280 360" style={{ position: 'absolute', left: 64, top: 220 }}>
            <defs>
              <clipPath id="rpm-barrel-clip">
                <path d="M 36 30 C 0 120, 0 240, 36 330 L 244 330 C 280 240, 280 120, 244 30 Z" />
              </clipPath>
            </defs>
            <path d="M 36 30 C 0 120, 0 240, 36 330 L 244 330 C 280 240, 280 120, 244 30 Z" fill={SLATE} />
            <g clipPath="url(#rpm-barrel-clip)" fill="none">
              <g stroke={NAVY} strokeWidth={2} opacity={0.55}>
                <path d="M 76 30 C 52 120, 52 240, 76 330" />
                <path d="M 118 30 C 108 120, 108 240, 118 330" />
                <path d="M 162 30 C 172 120, 172 240, 162 330" />
                <path d="M 204 30 C 228 120, 228 240, 204 330" />
              </g>
              {[
                { stroke: BRONZE, width: 16 },
                { stroke: GOLD, width: 10 },
              ].map((hoop) => (
                <g key={hoop.stroke} stroke={hoop.stroke} strokeWidth={hoop.width}>
                  <path d="M 0 82 Q 140 106 280 82" />
                  <path d="M 0 136 Q 140 162 280 136" />
                  <path d="M 0 222 Q 140 248 280 222" />
                  <path d="M 0 276 Q 140 300 280 276" />
                </g>
              ))}
            </g>
            <path d="M 36 30 C 0 120, 0 240, 36 330 L 244 330 C 280 240, 280 120, 244 30" fill="none" stroke={GOLD} strokeWidth={2} />
            <path d="M 36 330 Q 140 352 244 330" fill={SLATE} stroke={GOLD} strokeWidth={2} />
            <ellipse cx={140} cy={30} rx={104} ry={20} fill="#1A2838" stroke={GOLD} strokeWidth={2} />
            <ellipse cx={140} cy={30} rx={84} ry={13} fill="none" stroke={GOLD_LIGHT} strokeWidth={1} opacity={0.5} />
          </svg>

          {/* Faucet */}
          <svg aria-hidden width={240} height={160} viewBox="344 300 240 160" style={{ position: 'absolute', left: 344, top: 300 }} fill="none">
            <rect x={531} y={440} width={18} height={16} fill={PLATINUM} opacity={0.55} />
            <PipeStrokes d={FAUCET_PATH} />
            <path d="M 440 366 L 440 332" stroke={BRONZE} strokeWidth={12} />
            <path d="M 408 330 L 472 330" stroke={GOLD} strokeWidth={12} strokeLinecap="round" />
            <circle cx={440} cy={330} r={10} fill={GOLD_LIGHT} />
            <g fill={SLATE} stroke={GOLD_LIGHT} strokeWidth={1.5}>
              <rect x={345} y={358} width={14} height={44} rx={3} />
              <rect x={418} y={360} width={44} height={12} rx={3} />
              <rect x={520} y={426} width={40} height={14} rx={3} />
            </g>
          </svg>

          {/* Pipe run */}
          <svg aria-hidden width={1112} height={992} viewBox="380 360 1112 992" style={{ position: 'absolute', left: 380, top: 360 }} fill="none">
            <PipeStrokes d={PIPE_LOOPS_PATH} />
            <PipeStrokes d={PIPE_RUN_PATH} />
            <g fill={SLATE} stroke={GOLD_LIGHT} strokeWidth={1.5}>
              {PIPE_COUPLINGS.map(([x, y, w, h]) => (
                <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx={3} />
              ))}
            </g>
          </svg>

          {/* Coin and bank */}
          <svg aria-hidden width={140} height={180} viewBox="0 0 140 180" style={{ position: 'absolute', left: 330, top: 1270, overflow: 'visible' }}>
            <g className="rpm-coin">
              <circle cx={70} cy={34} r={22} fill={GOLD} stroke={GOLD_LIGHT} strokeWidth={2} />
              <path d="M 76 26 Q 70 20 64 26 Q 60 32 70 34 Q 80 36 76 42 Q 70 48 64 42 M 70 18 L 70 50" fill="none" stroke={NAVY} strokeWidth={3} strokeLinecap="round" />
            </g>
            <path d="M 12 110 L 70 76 L 128 110 Z" fill={SLATE} stroke={GOLD} strokeWidth={2} strokeLinejoin="round" />
            <rect x={12} y={112} width={116} height={10} fill={GOLD} />
            <g fill={SLATE} stroke={GOLD} strokeWidth={2}>
              <rect x={22} y={124} width={14} height={36} />
              <rect x={50} y={124} width={14} height={36} />
              <rect x={76} y={124} width={14} height={36} />
              <rect x={104} y={124} width={14} height={36} />
            </g>
            <rect x={6} y={162} width={128} height={12} rx={2} fill={GOLD} />
          </svg>

          {/* Title plate */}
          <div style={{ position: 'absolute', left: 64, top: 64, fontFamily: HEADING_FONT, fontWeight: 500, fontSize: 13, lineHeight: '16px', letterSpacing: '0.22em', color: GOLD }}>
            AMADUTOWN ADVISORY SOLUTIONS
          </div>
          <div style={{ position: 'absolute', left: 64, top: 92, fontFamily: HEADING_FONT, fontWeight: 700, fontSize: 44, lineHeight: '52px', letterSpacing: '0.02em', color: PLATINUM }}>
            The Revenue Plumbing Map
          </div>
          <div style={{ position: 'absolute', left: 64, top: 154, width: 760, fontFamily: PREMIUM_FONT, fontStyle: 'italic', fontWeight: 500, fontSize: 26, lineHeight: '32px', color: 'rgba(234,236,238,0.78)' }}>
            From raw market value to money in the bank. Every joint is a place value can leak.
          </div>

          {/* Legend */}
          {LEGEND.map(({ stage, left, width }) => (
            <div
              key={stage}
              style={{
                position: 'absolute',
                left,
                top: 84,
                width,
                height: 32,
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                ...CHIP_STYLES[stage],
                boxShadow: 'none',
              }}
            >
              {STAGE_LABELS[stage]}
            </div>
          ))}

          {/* Fixed labels */}
          <div style={{ position: 'absolute', left: 104, top: 596, width: 200, textAlign: 'center', fontFamily: HEADING_FONT, fontWeight: 500, fontSize: 13, lineHeight: '18px', letterSpacing: '0.12em', color: GOLD }}>
            MARKET
            <br />
            (RAW VALUE)
          </div>
          <div style={{ position: 'absolute', left: 592, top: 318, width: 120, fontSize: 14, lineHeight: '20px', color: 'rgba(234,236,238,0.78)' }}>
            <b style={{ color: PLATINUM }}>Ads</b>
            <br />
            (or content)
            <br />
            (or outreach)
          </div>
          <div style={{ position: 'absolute', left: 60, top: 1000, width: 84, textAlign: 'center', fontFamily: HEADING_FONT, fontWeight: 500, fontSize: 12, lineHeight: '18px', letterSpacing: '0.1em', color: GOLD_LIGHT }}>
            REINVEST
            <br />
            FLYWHEEL
          </div>
          <div style={{ position: 'absolute', left: 478, top: 1396, width: 64, fontFamily: HEADING_FONT, fontWeight: 500, fontSize: 13, lineHeight: '18px', letterSpacing: '0.12em', color: GOLD }}>
            BANK
          </div>

          {/* Step chips */}
          {PLUMBING_STEPS.map((step, i) => {
            const content = (
              <span>
                {step.label.map((line) => (
                  <span key={line} style={{ display: 'block' }}>
                    {line}
                  </span>
                ))}
              </span>
            )
            const style = { left: step.x, top: step.y, width: step.w, height: step.h, ...CHIP_STYLES[step.stage] }

            return compactControls ? (
              <span key={step.id} className="rpm-chip" style={{ ...style, cursor: 'default' }}>
                {content}
              </span>
            ) : (
              <button
                key={step.id}
                type="button"
                className="rpm-chip"
                aria-pressed={i === index}
                aria-label={`${step.name}: show where it leaks`}
                onClick={() => pick(i)}
                style={style}
              >
                {content}
              </button>
            )
          })}

          {/* Active step ring */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: current.x - 5,
              top: current.y - 5,
              width: current.w + 10,
              height: current.h + 10,
              boxSizing: 'border-box',
              border: '2px solid #FFFFFF',
              borderRadius: 12,
              boxShadow: '0 0 0 4px rgba(245,208,96,0.35), 0 0 24px rgba(245,208,96,0.6)',
              pointerEvents: 'none',
              transition: 'left 0.35s ease, top 0.35s ease, width 0.35s ease, height 0.35s ease',
            }}
          />

          {/* Leak marker */}
          <svg
            aria-hidden
            width={60}
            height={120}
            viewBox="0 0 60 120"
            style={{
              position: 'absolute',
              left: current.lx - 30,
              top: current.ly - 30,
              overflow: 'visible',
              pointerEvents: 'none',
              transition: 'left 0.35s ease, top 0.35s ease',
            }}
          >
            <circle className="rpm-ring" cx={30} cy={30} r={10} fill="none" stroke="#FFFFFF" strokeWidth={2.5} />
            <circle cx={30} cy={30} r={6} fill="#FFFFFF" stroke={NAVY} strokeWidth={2} />
            <circle className="rpm-drop" cx={30} cy={44} r={4} fill="#FFFFFF" />
            <circle className="rpm-drop" cx={23} cy={44} r={3} fill={PLATINUM} style={{ animationDelay: '0.35s' }} />
            <circle className="rpm-drop" cx={37} cy={44} r={2.5} fill={PLATINUM} style={{ animationDelay: '0.7s' }} />
          </svg>
        </div>
      </div>

      {/* Explanation console */}
      <div
        className="mt-4 rounded-xl border border-radiant-gold/30 p-5 sm:p-6"
        style={{ background: NAVY, color: PLATINUM }}
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          <div className="lg:w-72 lg:shrink-0" aria-live={playing ? 'off' : 'polite'}>
            <p className="text-xs uppercase tracking-[0.16em]" style={{ fontFamily: HEADING_FONT, color: GOLD }}>
              {counter} · {STAGE_LABELS[current.stage]}
            </p>
            <p className="mt-2 text-2xl font-bold leading-8" style={{ fontFamily: HEADING_FONT }}>
              {current.name}
            </p>
            <p className="mt-2 text-sm" style={{ color: 'rgba(234,236,238,0.72)' }}>
              Select any step, or let it run.
            </p>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.16em]" style={{ fontFamily: HEADING_FONT, color: GOLD_LIGHT }}>
              Where it leaks
            </p>
            <p className="mt-2 text-base leading-6">{current.leak}</p>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.16em]" style={{ fontFamily: HEADING_FONT, color: GOLD_LIGHT }}>
              How to seal it
            </p>
            <p className="mt-2 text-base leading-6">{current.fix}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="rpm-control flex h-12 w-12 items-center justify-center rounded-lg border bg-transparent"
              style={{ borderColor: 'rgba(212,175,55,0.6)', color: GOLD_LIGHT }}
              aria-label="Previous step"
              onClick={() => pick((index - 1 + total) % total)}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              className="rpm-control flex h-14 w-14 items-center justify-center rounded-xl"
              style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, color: NAVY }}
              aria-label={playing ? 'Pause walkthrough' : 'Play walkthrough'}
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
            </button>
            <button
              type="button"
              className="rpm-control flex h-12 w-12 items-center justify-center rounded-lg border bg-transparent"
              style={{ borderColor: 'rgba(212,175,55,0.6)', color: GOLD_LIGHT }}
              aria-label="Next step"
              onClick={() => pick((index + 1) % total)}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Small screens: the map labels are too small to tap, so list the steps here */}
        {compactControls ? (
          <div className="mt-6 space-y-4 border-t border-white/10 pt-5" data-testid="compact-step-list">
            {STAGE_ORDER.map((stage) => (
              <div key={stage}>
                <p className="text-xs uppercase tracking-[0.16em]" style={{ fontFamily: HEADING_FONT, color: GOLD }}>
                  {STAGE_LABELS[stage]}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PLUMBING_STEPS.map((step, i) =>
                    step.stage === stage ? (
                      <button
                        key={step.id}
                        type="button"
                        className="rpm-control min-h-[44px] rounded-lg px-3 text-sm font-semibold"
                        aria-pressed={i === index}
                        onClick={() => pick(i)}
                        style={{
                          ...CHIP_STYLES[stage],
                          boxShadow: i === index ? '0 0 0 2px #FFFFFF' : 'none',
                        }}
                      >
                        {step.name}
                      </button>
                    ) : null,
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
