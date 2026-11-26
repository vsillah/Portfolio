'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import Link from 'next/link'
import { adaptEconomyEnvelope, type AdapterResult, type AltitudeId, type Boundary, type Edge, type EconomyModel, type EconomyNode, type FlowId, type JoinRef, type LabelPair, type LayerId, type View, type WalkId } from './adapter'
import { arrange, captionsAt, flowOf, historicalLineOf, initialView, joinOf, layersOfKind, nodeById, openNode, touching, visibleEdges, visibleNodes, withLayer } from './derive'
import { commonsEconomyPhotoStory, type PhotoStory, type StepPhoto } from './photo-story'
import { commonsEconomyStepMarks, type StepMark, type StepMarks } from './step-marks'
import styles from './CommonsEconomyMap.module.css'

/*
 * The AmaduTown research-index skin for the Roxbury Commons economy model.
 * Every node, flow, caption, layer, responsibility, correction, source,
 * boundary stamp and walkthrough printed here is read from one validated
 * envelope. This file owns layout, theme, interaction and responsive
 * presentation only. View state lives in memory and is gone on reload.
 *
 * It is set as a newspaper centre spread in the Roxbury Commons Cut Sheet
 * manner: one sheet of paper and ink, a masthead, a ruled desk of printed
 * controls, the plate across the fold, and the open node as a clipping. The
 * plate is read from its printed entries and their agate route lines; the
 * drawn rules under them only trace the same routes on a wide sheet.
 *
 * The sheet prints one Roxbury Commons model in its own terms. The source's
 * conceptual layer and its terms stay in the envelope and are credited under
 * Sources and method; they are not offered as a second version to compare.
 * The plate leads the sheet. It opens with the envelope's first walkthrough
 * already marked on it: every stop numbered, the current stop, its route and
 * its flow in the signal ink. A console is fixed to the head of the plate with
 * the path keys, the playback keys, the route as a row of stops, and one short
 * caption for the current step. Steps advance on their own only after the
 * reader presses Play. Who does what at the step is printed below the plate as
 * a terse row; the full account stays in the document for screen readers and
 * print, and opens on the sheet with More detail.
 *
 * Each step also has one staged photograph (photo-story.ts). The current
 * step's frame is a small panel in the console, changing with the step and
 * kept smaller than the plate; the whole path is printed as a captioned strip
 * below the plate. The frames are fictional and say so.
 */

export type CommonsEconomyMapProps = {
  /* One serialized model envelope, from the generated Phase 6 transport (transport.ts); without one the map stays closed. */
  envelope: unknown
  /* Resolves a Commons path to a verified destination. Until one exists, destinations print without links. */
  resolveJoinHref?: (href: string) => string | null
  /* The staged photo story, keyed by walkthrough step id. A step with no entry prints no picture. */
  photos?: PhotoStory
  /* The wayfinding marks, keyed by walkthrough step id. A step with no entry prints no mark. */
  marks?: StepMarks
}

const inkClass: Record<FlowId, string> = { goods: styles.goods, funding: styles.funding, decisions: styles.decisions }
const purposeVerb: Record<JoinRef['purpose'], string> = { claim: 'Join', learn: 'Learn', read: 'Read' }
const noLink = () => null
/* The two layers that together are the one model on this sheet: always on, never offered as a choice. */
const ONE_MODEL: LayerId[] = ['proposed', 'roxbury']
/* How long a step stays up while playing. Long enough to read the step's caption and its standing. */
const STEP_MS = 7000
const say = (pair: LabelPair) => pair.commons

function Swatch({ flow }: { flow: FlowId }) {
  return <svg className={`${styles.swatch} ${inkClass[flow]}`} viewBox="0 0 26 10" aria-hidden="true" focusable="false"><line x1="1" y1="5" x2="25" y2="5" /></svg>
}

function Stamp({ children, tbd }: { children: string; tbd?: boolean }) {
  return <span className={`${styles.stamp}${tbd ? ` ${styles.stampTbd}` : ''}`}>{children}</span>
}

function Toggle({ pressed, onClick, children, flow }: { pressed: boolean; onClick: () => void; children: string; flow?: FlowId }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={styles.key}
    >
      <span aria-hidden="true" className={styles.tick}>{pressed ? '■' : '□'}</span>
      {flow && <Swatch flow={flow} />}
      <span className="min-w-0 break-words">{children}</span>
    </button>
  )
}

function Destination({ target, resolve }: { target: JoinRef; resolve: (href: string) => string | null }) {
  const href = resolve(target.href)
  const text = `${purposeVerb[target.purpose]} · ${target.label}`
  return href
    ? <a href={href} className={styles.destination}>{text}</a>
    : <span>{text}</span>
}

/* How a drawn route stands in the path being followed: the route of the current step, a route that supports it, another route of the same path, or none. */
type Mark = 'now' | 'aid' | 'path' | null
/* Every frame prints 4:3 with the Commons filter. The crop position comes from the manifest; meal-3's keeps a partial jaw out of the print. */
function Frame({ photo, eager }: { photo: StepPhoto; eager?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element -- pre-sized static WebP with a CSS crop; no optimizer or remote loader is involved
  return <img src={photo.src} alt={photo.alt} width={1200} height={800} loading={eager ? 'eager' : 'lazy'} decoding="async" className={styles.frame} style={{ objectPosition: photo.position }} />
}

/*
 * The playback signs: printer's marks, not boxed keys. Play and pause are cut out of a solid ink disc; restart is an
 * arrow turning back on itself; previous and next are a pointer driven against a stop bar. Each is drawn here and
 * hidden from assistive technology: the button's word, printed small beneath it, is its name.
 */
const signs = {
  play: <path d="M9.2 6.2v11.6l9.6-5.8z" />,
  pause: <path d="M7.6 6.2h3.2v11.6H7.6zM13.2 6.2h3.2v11.6h-3.2z" />,
  restart: <><path d="M6.9 8.1A7 7 0 1 1 5 13.2" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="square" /><path d="M2.6 4.4l1.2 6.9 6.2-3.3z" /></>,
  previous: <path d="M5 5.5h2.6v13H5zM19.5 5.5v13L9 12z" />,
  next: <path d="M16.4 5.5H19v13h-2.6zM4.5 5.5v13L15 12z" />,
}
/*
 * One step's wayfinding mark. The rail and the plate both print a step's mark through this one component, from the
 * same entry, so the two can never differ. It is decoration beside a printed number and name, and hidden as such.
 * The drawing is keyed by its step, so a stop that changes step is drawn afresh and never patched from the last one.
 */
function Pictogram({ step, mark }: { step: string; mark: StepMark }) {
  return <span className={styles.pictogram} aria-hidden="true" data-step-mark={step}><svg key={step} viewBox="0 0 24 24" width="24" height="24" focusable="false" fill="currentColor">{mark.art}</svg></span>
}

/*
 * A rail numeral, centred on its ink. CSS centres the figure's advance box, but a figure's ink does not sit in the
 * middle of that box: a 1 stands left of centre, and without line-box trimming the figures ride high or low. Once the
 * fonts are in, this reads where the browser will actually draw the ink of this numeral and shifts it by the
 * difference, in em so it holds at every size. Where the measurement is not available the CSS centring stands.
 */
function Numeral({ n }: { n: number }) {
  const digit = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = digit.current
    const box = el?.parentElement
    if (!el || !box || typeof document === 'undefined') return
    let live = true
    const centre = () => {
      if (!live) return
      el.style.transform = ''
      /* Nothing is laid out (a test document, or a hidden sheet): leave the CSS centring alone. */
      if (!box.getBoundingClientRect().width) return
      let pen: CanvasRenderingContext2D | null = null
      try { pen = document.createElement('canvas').getContext('2d') } catch { pen = null }
      const cs = getComputedStyle(el)
      const size = parseFloat(cs.fontSize)
      if (!pen || !size || typeof pen.measureText !== 'function') return
      pen.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      pen.textAlign = 'left'
      pen.textBaseline = 'alphabetic'
      const m = pen.measureText(el.textContent ?? '')
      if (!Number.isFinite(m.actualBoundingBoxAscent) || !Number.isFinite(m.fontBoundingBoxAscent)) return
      const range = document.createRange()
      range.selectNodeContents(el)
      const text = range.getBoundingClientRect()
      const frame = box.getBoundingClientRect()
      if (!text.width || !frame.width) return
      const baseline = text.top + m.fontBoundingBoxAscent
      const dx = (text.left - m.actualBoundingBoxLeft + text.left + m.actualBoundingBoxRight) / 2 - (frame.left + frame.right) / 2
      const dy = (baseline - m.actualBoundingBoxAscent + baseline + m.actualBoundingBoxDescent) / 2 - (frame.top + frame.bottom) / 2
      el.style.transform = `translate(${(-dx / size).toFixed(4)}em, ${(-dy / size).toFixed(4)}em)`
    }
    centre()
    document.fonts?.ready.then(centre).catch(() => undefined)
    return () => { live = false }
  }, [n])
  return <span ref={digit} className={styles.railDigit}>{n}</span>
}

function Sign({ name }: { name: keyof typeof signs }) {
  return <span className={styles.sign} aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" focusable="false" fill="currentColor">{signs[name]}</svg></span>
}

type Path = { id: string; flow: FlowId; d: string; support: boolean; future: boolean; mark: Mark }

export default function CommonsEconomyMap({ envelope, resolveJoinHref = noLink, photos = commonsEconomyPhotoStory, marks = commonsEconomyStepMarks }: CommonsEconomyMapProps) {
  const [result, setResult] = useState<AdapterResult | null>(null)
  useEffect(() => {
    let live = true
    setResult(null)
    adaptEconomyEnvelope(envelope).then(next => { if (live) setResult(next) })
    return () => { live = false }
  }, [envelope])

  return (
    <article className={`${styles.root} mx-auto max-w-[96rem] px-3 pb-24 pt-24 sm:px-6 lg:px-10`}>
      <div className={styles.sheet}>
        <header className={styles.masthead}>
          <p className={styles.runningHead}>
            <Link href="/insights" className={`${styles.noPrint} ${styles.back}`}>All insights</Link>
            <span aria-hidden="true">Centre spread</span>
          </p>
          <p className={styles.kicker}>Insights · Roxbury Commons</p>
          <h1 className={styles.headline}>Commons Economy Map</h1>
        </header>
        {result === null && <p className={styles.notice} role="status" aria-busy="true">Opening the map…</p>}
        {result && !result.ok && (
          <section role="status" data-rejection={result.code} className={styles.closed}>
            <h2>This map is unavailable right now</h2>
            <p>The map opens only when its model can be verified, so nothing is shown in its place.</p>
          </section>
        )}
        {result?.ok && <Dashboard model={result.model} resolve={resolveJoinHref} photos={photos} stepMarks={marks} />}
      </div>
    </article>
  )
}

function Dashboard({ model, resolve, photos, stepMarks }: { model: EconomyModel; resolve: (href: string) => string | null; photos: PhotoStory; stepMarks: StepMarks }) {
  /* The lead story: the envelope's own default walk if it names one, otherwise its first walkthrough. */
  const lead = model.walkthroughs.find(item => item.id === model.defaultView.walk) ?? model.walkthroughs[0] ?? null
  const [view, setView] = useState<View>(() => {
    const whole = ONE_MODEL.reduce(withLayer, initialView(model))
    return lead ? withLayer(whole, lead.flow) : whole
  })
  const [selected, setSelected] = useState<string | null>(model.defaultView.hero)
  const [walkId, setWalkId] = useState<WalkId | null>(lead ? lead.id : null)
  const [stepIndex, setStepIndex] = useState(model.defaultView.step)
  /* Never true on load: only the Play button sets it. */
  const [playing, setPlaying] = useState(false)
  const [playNotice, setPlayNotice] = useState('')
  const panelHeading = useRef<HTMLHeadingElement>(null)
  const field = useRef<HTMLDivElement>(null)
  const nodeEls = useRef(new Map<string, HTMLElement>())
  const [paths, setPaths] = useState<Path[]>([])

  const shown = useMemo(() => visibleNodes(model, view), [model, view])
  const lines = useMemo(() => visibleEdges(model, view), [model, view])
  const open = openNode(model, view, selected)
  const altitude = model.altitudes.find(item => item.id === view.altitude)!
  const layout = arrange(shown)
  const walkthrough = walkId ? model.walkthroughs.find(item => item.id === walkId)! : null
  const step = walkthrough ? walkthrough.steps[Math.min(stepIndex, walkthrough.steps.length - 1)] : null
  /* The path on the plate, all read from the walkthrough: which stops it visits, in which steps, and over which routes. */
  const stops = useMemo(() => {
    const at = new Map<string, number[]>()
    for (const each of walkthrough?.steps ?? []) at.set(each.at, [...(at.get(each.at) ?? []), each.n])
    return at
  }, [walkthrough])
  const marks = useMemo(() => {
    const out = new Map<string, Mark>()
    for (const each of walkthrough?.steps ?? []) for (const id of [...(each.via ? [each.via.edge] : []), ...each.supports.map(ref => ref.edge)]) out.set(id, 'path')
    if (step) { for (const ref of step.supports) out.set(ref.edge, 'aid'); if (step.via) out.set(step.via.edge, 'now') }
    return out
  }, [walkthrough, step])
  const markKey = [...marks].map(([id, mark]) => `${id}:${mark}`).join('|')
  const [detailOpen, setDetailOpen] = useState(false)

  const toggleLayer = (id: LayerId) => setView(current => ({ ...current, layers: { ...current.layers, [id]: !current.layers[id] } }))
  const setAltitude = (next: AltitudeId) => setView(current => ({ ...current, altitude: next }))
  /* Choosing a path always opens it at its first step and stops any playback; a path is chosen, never switched off. */
  const follow = (id: WalkId) => {
    if (playing) setPlayNotice('Paused.')
    setPlaying(false)
    setWalkId(id)
    setStepIndex(0)
    const flow = model.walkthroughs.find(item => item.id === id)!.flow
    setView(current => withLayer(current, flow))
  }
  const choose = (id: string) => {
    if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 1024px)').matches) {
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const focusDetail = () => {
        panelHeading.current?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' })
        panelHeading.current?.focus({ preventScroll: true })
      }
      if (calm) { flushSync(() => setSelected(id)); focusDetail() }
      else { setSelected(id); requestAnimationFrame(focusDetail) }
    } else setSelected(id)
  }
  const stepRegion = useRef<HTMLDivElement>(null)
  const previousStep = useRef<HTMLButtonElement>(null)
  const nextStep = useRef<HTMLButtonElement>(null)
  /* Reaching the first or last step disables the button that has focus, and browsers blur a control as soon as it is disabled.
     Move focus to the labelled walkthrough region before that render, so arrow keys, Home and End keep working. */
  const moveTo = (target: number) => {
    if (!walkthrough) return
    const last = walkthrough.steps.length - 1
    const index = Math.max(0, Math.min(last, target))
    const active = typeof document === 'undefined' ? null : document.activeElement
    if ((index === 0 && active === previousStep.current) || (index === last && active === nextStep.current)) stepRegion.current?.focus()
    setStepIndex(index)
  }
  /* A step taken by hand, with a button or a key, takes over from playback. */
  const goToStep = (target: number) => {
    if (playing) setPlayNotice('Paused.')
    setPlaying(false)
    moveTo(target)
  }
  const play = () => {
    if (!walkthrough) return
    if (playing) { setPlaying(false); setPlayNotice('Paused.'); return }
    if (stepIndex >= walkthrough.steps.length - 1) moveTo(0)
    setPlaying(true)
    setPlayNotice(`Playing ${walkthrough.label}. A new step every ${STEP_MS / 1000} seconds.`)
  }
  const restart = () => moveTo(0)
  /* Playback is a timer the reader started. It moves the step and nothing else: focus stays where the reader left it,
     the step article announces itself politely, and every stamp on the step prints exactly as it does by hand. */
  const moveRef = useRef(moveTo)
  moveRef.current = moveTo
  const stepCount = walkthrough ? walkthrough.steps.length : 0
  const walkLabel = walkthrough ? walkthrough.label : ''
  useEffect(() => {
    if (!playing) return
    const last = stepCount - 1
    if (stepIndex >= last) { setPlaying(false); setPlayNotice(`End of ${walkLabel}.`); return }
    const timer = window.setTimeout(() => moveRef.current(stepIndex + 1), STEP_MS)
    return () => window.clearTimeout(timer)
  }, [playing, stepIndex, stepCount, walkLabel])
  useEffect(() => {
    if (!playing) return
    const hide = () => { if (document.visibilityState === 'hidden') { setPlaying(false); setPlayNotice('Paused.') } }
    document.addEventListener('visibilitychange', hide)
    return () => document.removeEventListener('visibilitychange', hide)
  }, [playing])
  const stepKeys = (event: KeyboardEvent<HTMLElement>) => {
    if (!walkthrough) return
    const next = event.key === 'ArrowRight' ? stepIndex + 1 : event.key === 'ArrowLeft' ? stepIndex - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? walkthrough.steps.length - 1 : null
    if (next === null) return
    event.preventDefault()
    goToStep(next)
  }

  /* Connectors are measured from the printed cards, so the drawing follows the responsive layout. */
  const measure = useCallback(() => {
    const host = field.current
    if (!host) return
    const box = host.getBoundingClientRect()
    const rectOf = (id: string) => { const el = nodeEls.current.get(id); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height } }
    const next: Path[] = []
    for (const item of lines) {
      if (item.from === item.to) continue
      const a = rectOf(item.from)
      const b = rectOf(item.to)
      if (!a || !b) continue
      const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 }
      const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 }
      /* Routes are ruled like column rules: straight runs with one square turn, never a free curve. */
      let d: string
      if (Math.abs(ac.y - bc.y) < Math.min(a.h, b.h) / 2) {
        const right = bc.x > ac.x
        const sx = right ? a.x + a.w : a.x
        const ex = right ? b.x : b.x + b.w
        const mid = Math.round((sx + ex) / 2)
        d = `M ${sx} ${ac.y} H ${mid} V ${bc.y} H ${ex}`
      } else {
        const down = bc.y > ac.y
        const sy = down ? a.y + a.h : a.y
        const ey = down ? b.y : b.y + b.h
        const mid = Math.round(sy + (ey - sy) / 2)
        d = `M ${ac.x} ${sy} V ${mid} H ${bc.x} V ${ey}`
      }
      next.push({ id: item.id, flow: item.flow, d, support: item.role === 'support', future: item.layers.includes('future'), mark: marks.get(item.id) ?? null })
    }
    setPaths(current => (JSON.stringify(current) === JSON.stringify(next) ? current : next))
  // eslint-disable-next-line react-hooks/exhaustive-deps -- markKey is the content of marks
  }, [lines, markKey])
  const measureRef = useRef(measure)
  measureRef.current = measure
  useLayoutEffect(() => { measure() }, [measure, view, selected])
  useEffect(() => {
    const host = field.current
    if (!host || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => measureRef.current())
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  const register = (id: string) => (el: HTMLElement | null) => { if (el) nodeEls.current.set(id, el); else nodeEls.current.delete(id) }

  const card = (item: EconomyNode, variant: 'member' | 'group' | 'centre' | 'node') => {
    const outgoing = touching(lines, item.id).filter(each => each.from === item.id)
    const isOpen = open?.id === item.id
    const onWalk = step?.at === item.id
    const futureOnly = !item.historical && item.layers.includes('future')
    /* The other steps of the path that stop here, so the whole path reads off the plate before anything is pressed. */
    const others = step ? (stops.get(item.id) ?? []).filter(n => n !== step.n) : []
    const markOf = (n: number) => { const id = walkthrough?.steps.find(each => each.n === n)?.id; return id && stepMarks[id] ? <Pictogram step={id} mark={stepMarks[id]} /> : null }
    const body = (
      <>
        {!walkthrough && item.id === model.defaultView.hero && <span className={styles.flag}>Start here</span>}
        <span className={styles.entryName}>{say(item.label)}</span>
        {(futureOnly || (onWalk && step) || others.length > 0) && (
          <span className={styles.entryNotes}>
            {futureOnly && <Stamp>{model.boundaryStamp.future}</Stamp>}
            {onWalk && step && <span className={styles.tagged}>{markOf(step.n)}<span className={styles.onWalk}>On the walk · step {step.n}</span></span>}
            {others.map(n => <span key={n} className={styles.tagged}>{markOf(n)}<span className={`${styles.stopNo}${step && n < step.n ? ` ${styles.stopDone}` : ''}`}>Step {n}</span></span>)}
          </span>
        )}
        {outgoing.length > 0 && (
          <span className={styles.routes} aria-hidden="true">
            {outgoing.map(each => <span key={each.id} className={`${styles.route} ${inkClass[each.flow]}${marks.get(each.id) === 'now' ? ` ${styles.routeNow}` : marks.get(each.id) ? ` ${styles.routePath}` : ''}`}><Swatch flow={each.flow} />{each.to === item.id ? '↻ ' : '→ '}{say(nodeById(model, each.to)!.label)}</span>)}
          </span>
        )}
      </>
    )
    /* Opaque so the ruled routes pass beneath the entries, never through their text. */
    const className = `${styles.node} ${styles.entry} ${styles[`entry_${variant}`]} ${futureOnly ? styles.entryFuture : ''} ${isOpen ? styles.nodeOpen : ''} ${onWalk ? styles.nodeWalk : others.length ? styles.nodeStop : ''}`
    if (item.interactive === false) return <div ref={register(item.id)} className={className}>{body}</div>
    return (
      <button
        ref={register(item.id)}
        type="button"
        aria-pressed={isOpen}
        aria-controls="econ-detail"
        onClick={() => choose(item.id)}
        className={className}
      >
        {body}
      </button>
    )
  }

  const modelLayers = layersOfKind(model, 'model')
  const extraLayers = modelLayers.filter(item => !ONE_MODEL.includes(item.id))
  const sourceLayers = modelLayers.filter(item => ONE_MODEL.includes(item.id))
  const sourceNames = model.nodes.filter(item => item.label.book !== item.label.commons)
  const stepPhoto = step ? photos[step.id] ?? null : null
  const pathPhotos = (walkthrough?.steps ?? []).flatMap(each => (photos[each.id] ? [{ each, photo: photos[each.id] }] : []))
  const stepSources = step ? model.sources.filter(item => nodeById(model, step.at)?.sources.includes(item.id)) : []
  const flowLayers = layersOfKind(model, 'flow')

  return (
    <div className={styles.dashboard}>
      <ul className={styles.stamps} aria-label="What is and is not real on this map">
        {model.stamps.map(line => <li key={line}><Stamp>{line}</Stamp></li>)}
      </ul>

      {walkthrough && step ? (
        <div className={styles.console}>
          <div className={`${styles.noPrint} ${styles.consoleBar}`}>
            <div className={styles.consolePaths}>
              <span id="econ-paths" className={styles.deskLabel}>Path</span>
              <div role="group" aria-label="Walkthroughs" aria-describedby="econ-paths" className={styles.keys}>
                {model.walkthroughs.map(item => <Toggle key={item.id} pressed={walkId === item.id} flow={item.flow} onClick={() => follow(item.id)}>{item.label}</Toggle>)}
              </div>
            </div>
            {/* The playback keys sit beside the path keys and answer the same step keys as the region they drive. */}
            <div role="group" aria-label="Playback" className={styles.transport} onKeyDown={stepKeys}>
              <button type="button" onClick={play} className={`${styles.cue} ${styles.cuePlay}${playing ? ` ${styles.cuePlaying}` : ''}`}><Sign name={playing ? 'pause' : 'play'} /><span className={styles.cueWord}>{playing ? 'Pause' : 'Play'}</span></button>
              <button type="button" onClick={restart} className={styles.cue}><Sign name="restart" /><span className={styles.cueWord}>Restart</span></button>
              <button type="button" ref={previousStep} onClick={() => goToStep(stepIndex - 1)} disabled={step.n === 1} aria-label="Previous step" className={styles.cue}><Sign name="previous" /><span className={styles.cueWord}>Previous</span></button>
              <button type="button" ref={nextStep} onClick={() => goToStep(stepIndex + 1)} disabled={step.n === step.of} aria-label="Next step" className={styles.cue}><Sign name="next" /><span className={styles.cueWord}>Next</span></button>
              <span role="status" className={styles.srOnly}>{playNotice}</span>
            </div>
          </div>
          <div ref={stepRegion} tabIndex={-1} className={`${styles.strip}${stepPhoto ? ` ${styles.stripPhoto}` : ''}`} role="region" aria-label={`${walkthrough.label}, step ${step.n} of ${step.of}`} onKeyDown={stepKeys}>
            {stepPhoto && (
              <figure className={styles.photoPanel} aria-labelledby={`econ-photo-${step.id}`}>
                <Frame key={step.id} photo={stepPhoto} eager />
                <figcaption id={`econ-photo-${step.id}`} className={styles.srOnly}>Staged picture for step {step.n}: {stepPhoto.caption}</figcaption>
              </figure>
            )}
            <ol className={`${styles.rail} ${inkClass[walkthrough.flow]}${playing ? ` ${styles.railPlaying}` : ''}`} aria-label={`The ${step.of} steps of ${walkthrough.label}`}>
              {walkthrough.steps.map(each => (
                <li key={each.id} aria-current={each.id === step.id ? 'step' : undefined} className={`${styles.railStop}${each.n < step.n ? ` ${styles.railDone}` : ''}`}>
                  <span className={styles.railNo} aria-hidden="true"><Numeral n={each.n} /></span>
                  {stepMarks[each.id] && <Pictogram step={each.id} mark={stepMarks[each.id]} />}
                  <span className={styles.railText}>
                    <span className={styles.srOnly}>Step {each.n}: {each.title}, at </span>
                    <span className={styles.railPlace}>{say(each.place)}</span>
                  </span>
                </li>
              ))}
            </ol>
            <article className={`${styles.avoidBreak} ${styles.now}`} aria-labelledby={`econ-step-${step.id}`} aria-live="polite">
              <p className={styles.slug}>Step {step.n} of {step.of} · {say(step.place)} · {step.altitudeLabel}</p>
              <h2 id={`econ-step-${step.id}`} className={styles.nowTitle}>{step.title}</h2>
              <p className={styles.nowCaption}>{step.caption}</p>
              {step.via && <p className={`${styles.nowVia} ${inkClass[walkthrough.flow]}`}><Swatch flow={walkthrough.flow} /> <b>{say(flowOf(model, walkthrough.flow).label)}</b> {say(step.via.label)}</p>}
              <ul className={styles.stampRow} aria-label="What this step is and is not">{step.stamps.map(line => <li key={line}><Stamp tbd={line === model.boundaryStamp.tbd}>{line}</Stamp></li>)}</ul>
            </article>
          </div>
        </div>
      ) : null}

      <div className={styles.spread}>
        <figure className={styles.figure} aria-labelledby="econ-map-caption">
          <div ref={field} className={styles.field}>
            <svg className={`${styles.lines}${walkthrough ? ` ${styles.linesWalking}` : ''}`} aria-hidden="true" focusable="false">
              <defs>
                {model.flows.map(item => (
                  <marker key={item.id} id={`econ-arrow-${item.id}`} viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
                    <path d="M 1 1 L 9 5 L 1 9" className={`${styles.arrow} ${inkClass[item.id]}`} />
                  </marker>
                ))}
              </defs>
              {paths.map(item => (
                <path key={item.id} d={item.d} markerEnd={`url(#econ-arrow-${item.flow})`} className={`${styles.line} ${inkClass[item.flow]}${item.support ? ` ${styles.support}` : ''}${item.future ? ` ${styles.future}` : ''}${item.mark === 'now' ? ` ${styles.walk}` : item.mark === 'aid' ? ` ${styles.walkAid}` : item.mark === 'path' ? ` ${styles.onPath}` : ''}`} />
              ))}
              {/* One token rides the current route into the current stop each time the step changes. Decoration only: the route and the stop are already marked. */}
              {paths.filter(item => item.mark === 'now').map(item => <circle key={`${item.id}-${step?.id}`} r="7" className={styles.token} style={{ offsetPath: `path("${item.d}")` }} />)}
            </svg>
            {shown.length === 0
              ? <p className={styles.blank}>Nothing in this model is on the map.</p>
              : (
                <div className={styles.plate}>
                  {layout.groups.map(({ group, members }) => (
                    <div key={group.id} className={styles.feature}>
                      <div className={styles.featureHead}>{card(group, 'group')}</div>
                      <div className={styles.members}>{members.map(item => <div key={item.id} className={styles.cell}>{card(item, 'member')}</div>)}</div>
                    </div>
                  ))}
                  {layout.centre.length > 0 && <div className={styles.nameplate}>{layout.centre.map(item => <div key={item.id} className={styles.cell}>{card(item, 'centre')}</div>)}</div>}
                  {layout.rest.length > 0 && <div className={styles.columns}>{layout.rest.map(item => <div key={item.id} className={styles.cell}>{card(item, 'node')}</div>)}</div>}
                </div>
              )}
          </div>
          <figcaption id="econ-map-caption" className={styles.caption}>
            {shown.length} of {model.nodes.length} nodes and {lines.length} of {model.edges.length} flows shown.{' '}
            {model.flows.map((item, index) => (
              <span key={item.id} className={view.layers[item.id] ? undefined : styles.off}>
                {index > 0 ? ' · ' : ''}<Swatch flow={item.id} /> {say(item.label)}{view.layers[item.id] ? '' : ' (off)'}
              </span>
            ))}
            . Choose a node to see its details. The same map is listed as a table below.
          </figcaption>
        </figure>

        <section id="econ-detail" aria-labelledby="econ-detail-title" className={`${styles.panel} ${styles.clipping}`}>
          {open ? (
            <>
              <p className={styles.slug}>Details · {altitude.label}</p>
              <h2 id="econ-detail-title" ref={panelHeading} tabIndex={-1} className={styles.clippingTitle}>{say(open.label)}</h2>
              <ul className={styles.stampRow} aria-label="What this node is and is not">
                {open.boundaries.map((id: Boundary) => <li key={id}><Stamp tbd={id === 'tbd'}>{model.boundaryStamp[id]}</Stamp></li>)}
              </ul>
              <dl className={styles.facts}>
                <div><dt>Work</dt><dd>{open.tap.works}</dd></div>
                <div><dt>Decisions</dt><dd>{open.tap.decides.text} <Stamp tbd={open.tap.decides.authority === 'tbd'}>{model.boundaryStamp[open.tap.decides.authority]}</Stamp></dd></div>
                <div>
                  <dt>At this altitude</dt>
                  <dd><ul className={styles.agateList}>{captionsAt(model, open.id, view.altitude).map(item => <li key={item.id}><b>{model.altitudes.find(each => each.id === item.detail)!.label}.</b> {item.text}</li>)}</ul></dd>
                </div>
                {touching(lines, open.id).length > 0 && (
                  <div>
                    <dt>Connections</dt>
                    <dd><ul className={styles.agateList}>{touching(lines, open.id).map(item => <li key={item.id}><Swatch flow={item.flow} /> <b>{say(flowOf(model, item.flow).label)}</b> {say(nodeById(model, item.from)!.label)} → {say(nodeById(model, item.to)!.label)}: {say(item.label)}</li>)}</ul></dd>
                  </div>
                )}
              </dl>
              <div className={styles.claims}>
                <h3>Open responsibilities</h3>
                {open.tap.claims.length
                  ? <ul>{open.tap.claims.map(item => <li key={item.id}><span>{item.label}</span><span className={styles.claimWay}><Destination target={joinOf(model, item.join)} resolve={resolve} /></span></li>)}</ul>
                  : <p className={styles.none}>Nothing here is open to claim.</p>}
                {open.joins.filter(id => !open.tap.claims.some(item => item.join === id)).map(id => <p key={id} className={styles.claimWay}><Destination target={joinOf(model, id)} resolve={resolve} /></p>)}
              </div>
            </>
          ) : (
            <>
              <h2 id="econ-detail-title" ref={panelHeading} tabIndex={-1} className={styles.clippingTitle}>No node selected</h2>
              <p className={styles.none}>The selected node is hidden by the current layers. Choose any node on the map.</p>
            </>
          )}
        </section>
      </div>

      {walkthrough && step && pathPhotos.length > 0 && (
        <section aria-labelledby="econ-photos-title" className={`${styles.walk} ${styles.avoidBreak}`}>
          <p className={styles.slug}>{walkthrough.label} · staged pictures</p>
          <h2 id="econ-photos-title" className={styles.sectionHead}>In pictures</h2>
          <p className={styles.stripLine}>Every picture is staged for this page. None shows a real person, place, record or decision.</p>
          <ol className={styles.photoStrip} aria-label={`${walkthrough.label} in ${pathPhotos.length} staged pictures`}>
            {pathPhotos.map(({ each, photo }) => (
              <li key={each.id} aria-current={each.id === step.id ? 'step' : undefined} className={styles.photoStop}>
                <figure>
                  <Frame photo={photo} />
                  <figcaption>
                    <b>Step {each.n} · {each.title}</b>
                    <span>{photo.caption}</span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ol>
        </section>
      )}

      {walkthrough && step && (
        <section aria-labelledby="econ-step-detail-title" className={styles.walk}>
          <p className={styles.slug}>{walkthrough.label} · step {step.n} of {step.of}</p>
          <h2 id="econ-step-detail-title" className={styles.sectionHead}>Who does what</h2>
          <p className={styles.stripLine}>{walkthrough.line}</p>
          <dl className={styles.brief} aria-label={`In short: ${step.title}`}>
            {step.responsibilities.map(line => (
              <div key={line.key}><dt>{line.label}</dt><dd>{line.holderLabel}{line.authority === 'tbd' && <> <Stamp tbd>{line.stamp}</Stamp></>}</dd></div>
            ))}
            <div><dt>{step.correction.label}</dt><dd>{step.correction.decided ? <>{step.correction.holderLabel}{step.correction.authority === 'tbd' && <> <Stamp tbd>{step.correction.stamp}</Stamp></>}</> : <Stamp tbd>{step.correction.stamp}</Stamp>}</dd></div>
          </dl>
          <button type="button" aria-expanded={detailOpen} aria-controls="econ-step-full" onClick={() => setDetailOpen(current => !current)} className={`${styles.noPrint} ${styles.turn} ${styles.more}`}>{detailOpen ? 'Less detail' : 'More detail'}<span aria-hidden="true" className={styles.moreMark}>{detailOpen ? '−' : '+'}</span></button>
          {/* Folded on the sheet, never out of the document: a screen reader and a printed copy always get the full account. */}
          <div id="econ-step-full" className={`${styles.full}${detailOpen ? '' : ` ${styles.fullFolded}`}`}>
            <h3 className={styles.stepTitle}>{step.title}</h3>
            <p className={styles.stepCaption}>{step.caption}</p>
            {step.via && <p className={styles.stepVia}><b>Arrives by</b> {say(step.via.label)}</p>}
            {step.supports.length > 0 && <p className={styles.stepVia}><b>Supported by</b> {step.supports.map(ref => say(ref.label)).join('; ')}</p>}
            <ul className={styles.stampRow} aria-label="What this step is and is not, in full">{step.stamps.map(line => <li key={line}><Stamp tbd={line === model.boundaryStamp.tbd}>{line}</Stamp></li>)}</ul>
            <dl className={styles.duties}>
              {step.responsibilities.map(line => (
                <div key={line.key}><dt>{line.label}</dt><dd><b>{line.holderLabel}.</b> {line.who} <Stamp tbd={line.authority === 'tbd'}>{line.stamp}</Stamp></dd></div>
              ))}
              <div>
                <dt>{step.correction.label}</dt>
                <dd>
                  {step.correction.decided
                    ? <><b>{step.correction.holderLabel}.</b> {step.correction.who} <Stamp tbd={step.correction.authority === 'tbd'}>{step.correction.stamp}</Stamp></>
                    : <>{step.correction.text} <Stamp tbd>{step.correction.stamp}</Stamp></>}
                </dd>
              </div>
            </dl>
            {step.joins.length > 0 && <ul className={styles.stepJoins}>{step.joins.map(target => <li key={target.id}><Destination target={target} resolve={detailOpen ? resolve : noLink} /></li>)}</ul>}
            {stepSources.length > 0 && <p className={styles.stepVia}><b>Drawn from</b> {stepSources.map(item => item.title).join('; ')}</p>}
          </div>
        </section>
      )}

      <section aria-label="Map controls" className={`${styles.noPrint} ${styles.desk}`}>
        <div role="group" aria-labelledby="econ-flows" className={styles.deskRow}>
          <span id="econ-flows" className={styles.deskLabel}>Flows</span>
          {flowLayers.map(item => <Toggle key={item.id} pressed={view.layers[item.id]} flow={item.id as FlowId} onClick={() => toggleLayer(item.id)}>{say(item.label)}</Toggle>)}
        </div>
        {extraLayers.length > 0 && (
          <div role="group" aria-labelledby="econ-layers" className={styles.deskRow}>
            <span id="econ-layers" className={styles.deskLabel}>Also show</span>
            {extraLayers.map(item => <Toggle key={item.id} pressed={view.layers[item.id]} onClick={() => toggleLayer(item.id)}>{say(item.label)}</Toggle>)}
          </div>
        )}
        <div role="group" aria-labelledby="econ-altitude" className={styles.deskRow}>
          <span id="econ-altitude" className={styles.deskLabel}>Altitude</span>
          {model.altitudes.map(item => <Toggle key={item.id} pressed={view.altitude === item.id} onClick={() => setAltitude(item.id)}>{item.label}</Toggle>)}
        </div>
      </section>

      <p className={styles.altitudeLine} aria-live="polite"><b>{altitude.label}.</b> {altitude.audience} {model.altitudeRule}</p>

      {layout.tried.length > 0 && (
        <section aria-labelledby="econ-tried-title" className={`${styles.avoidBreak} ${styles.tried}`}>
          <h2 id="econ-tried-title" className={styles.slug}>{say(model.layers.find(item => item.id === 'tried')!.label)}</h2>
          <ul>
            {layout.tried.map(item => {
              const line = historicalLineOf(model, item.id)
              return (
                <li key={item.id} ref={register(item.id)}>
                  <b>{say(item.label)}</b>
                  {line && <><Stamp>{line.stamp}</Stamp><span>{line.text}</span></>}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="econ-table-title" className={styles.ledgerSection}>
        <h2 id="econ-table-title" className={styles.sectionHead}>The map as a table</h2>
        <div className={styles.ledgerWrap}>
          <table className={styles.ledger}>
            <caption className={styles.srOnly}>Flows shown on the map, with what passes and its standing</caption>
            <thead><tr>{['Flow', 'From', 'What passes', 'To', 'Standing'].map(head => <th key={head} scope="col">{head}</th>)}</tr></thead>
            <tbody>
              {lines.length
                ? lines.map((item: Edge) => (
                  <tr key={item.id}>
                    <th scope="row"><Swatch flow={item.flow} /> {say(flowOf(model, item.flow).label)}</th>
                    <td data-label="From">{say(nodeById(model, item.from)!.label)}</td>
                    <td data-label="What passes">{say(item.label)}</td>
                    <td data-label="To">{say(nodeById(model, item.to)!.label)}</td>
                    <td data-label="Standing">{item.boundaries.map(id => model.boundaryStamp[id]).join(' · ')}</td>
                  </tr>
                ))
                : <tr><td colSpan={5} className={styles.none}>No flow is shown. Turn on a flow above.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <details className={styles.sources}>
        <summary>Sources and method</summary>
        <ul className={styles.sourceList}>
          {model.sources.map(item => (
            <li key={item.id}><b>{item.title}</b> <Stamp>{item.check === 'pending' ? 'Check pending' : item.check === 'verified' ? 'Checked' : 'Project document'}</Stamp><span className={styles.sourceUse}>{item.use}</span></li>
          ))}
        </ul>
        <ul className={styles.agateList}>{model.holders.map(item => <li key={item.id}><b>{item.label}.</b> {item.line}</li>)}</ul>
        <div className={styles.method}>
          <h3>Where the model comes from</h3>
          <ul className={styles.agateList}>{sourceLayers.map(item => <li key={item.id}><b>{say(item.label)}.</b> {item.line}</li>)}</ul>
          {sourceNames.length > 0 && (
            <>
              <h3>Names in the source</h3>
              <ul className={styles.agateList}>{sourceNames.map(item => <li key={item.id}><b>{item.label.commons}.</b> In the source: {item.label.book}</li>)}</ul>
            </>
          )}
        </div>
        <p className={styles.colophon}>This map is drawn from the Roxbury Commons economy model and shown here without changes.</p>
      </details>
    </div>
  )
}
