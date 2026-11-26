'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { adaptEconomyEnvelope, type AdapterResult, type AltitudeId, type Boundary, type Edge, type EconomyModel, type EconomyNode, type FlowId, type JoinRef, type LabelMode, type LayerId, type View, type WalkId } from './adapter'
import { arrange, captionsAt, flowOf, historicalLineOf, initialView, joinOf, labelOf, layersOfKind, nodeById, openNode, touching, visibleEdges, visibleNodes, withLayer } from './derive'
import styles from './CommonsEconomyMap.module.css'

/*
 * The AmaduTown research-index skin for the Roxbury Commons economy model.
 * Every node, flow, caption, layer, responsibility, correction, source,
 * boundary stamp and walkthrough printed here is read from one validated
 * envelope. This file owns layout, theme, interaction and responsive
 * presentation only. View state lives in memory and is gone on reload.
 */

export type CommonsEconomyMapProps = {
  /* One serialized model envelope, from the generated Phase 6 transport (transport.ts); without one the map stays closed. */
  envelope: unknown
  /* Resolves a Commons path to a verified destination. Until one exists, destinations print without links. */
  resolveJoinHref?: (href: string) => string | null
}

const inkClass: Record<FlowId, string> = { goods: styles.goods, funding: styles.funding, decisions: styles.decisions }
const purposeVerb: Record<JoinRef['purpose'], string> = { claim: 'Join', learn: 'Learn', read: 'Read' }
const noLink = () => null

function Swatch({ flow }: { flow: FlowId }) {
  return <svg className={`${styles.swatch} ${inkClass[flow]}`} viewBox="0 0 26 10" aria-hidden="true" focusable="false"><line x1="1" y1="5" x2="25" y2="5" /></svg>
}

function Stamp({ children, tbd }: { children: string; tbd?: boolean }) {
  return <span className={`${styles.stamp}${tbd ? ` ${styles.stampTbd}` : ''} text-muted-foreground`}>{children}</span>
}

function Toggle({ pressed, onClick, children, flow }: { pressed: boolean; onClick: () => void; children: string; flow?: FlowId }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-border px-3.5 py-1.5 text-left text-sm leading-5 hover:border-[#A88A2D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A88A2D] aria-pressed:border-[#A88A2D] aria-pressed:bg-[#A88A2D]/10 aria-pressed:font-semibold"
    >
      <span aria-hidden="true" className="font-mono text-xs">{pressed ? '■' : '□'}</span>
      {flow && <Swatch flow={flow} />}
      <span className="min-w-0 break-words">{children}</span>
    </button>
  )
}

function Destination({ target, resolve }: { target: JoinRef; resolve: (href: string) => string | null }) {
  const href = resolve(target.href)
  const text = `${purposeVerb[target.purpose]} · ${target.label}`
  return href
    ? <a href={href} className="underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A88A2D]">{text}</a>
    : <span>{text}</span>
}

type Path = { id: string; flow: FlowId; d: string; support: boolean; future: boolean; walk: boolean }

export default function CommonsEconomyMap({ envelope, resolveJoinHref = noLink }: CommonsEconomyMapProps) {
  const [result, setResult] = useState<AdapterResult | null>(null)
  useEffect(() => {
    let live = true
    setResult(null)
    adaptEconomyEnvelope(envelope).then(next => { if (live) setResult(next) })
    return () => { live = false }
  }, [envelope])

  return (
    <article className={`${styles.root} mx-auto max-w-7xl px-5 pb-24 pt-28 sm:px-10 lg:px-12`}>
      <header className="max-w-3xl">
        <Link href="/insights" className={`${styles.noPrint} mb-5 inline-block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2`}>
          All insights
        </Link>
        <p className="font-heading text-xs uppercase tracking-[0.22em] text-muted-foreground">Insights · Roxbury Commons</p>
        <h1 className="mt-4 font-premium text-4xl leading-[1.1] tracking-tight sm:text-6xl">Commons Economy Map</h1>
      </header>
      {result === null && <p className="mt-10 text-muted-foreground" role="status" aria-busy="true">Opening the map…</p>}
      {result && !result.ok && (
        <section role="status" data-rejection={result.code} className="mt-10 max-w-2xl rounded-2xl border border-border bg-card p-6 sm:p-8">
          <h2 className="font-heading text-lg font-bold tracking-wide">This map is unavailable right now</h2>
          <p className="mt-3 text-muted-foreground">The map opens only when its model can be verified, so nothing is shown in its place.</p>
        </section>
      )}
      {result?.ok && <Dashboard model={result.model} resolve={resolveJoinHref} />}
    </article>
  )
}

function Dashboard({ model, resolve }: { model: EconomyModel; resolve: (href: string) => string | null }) {
  const [view, setView] = useState<View>(() => initialView(model))
  const [selected, setSelected] = useState<string | null>(model.defaultView.hero)
  const [walkId, setWalkId] = useState<WalkId | null>(model.defaultView.walk)
  const [stepIndex, setStepIndex] = useState(model.defaultView.step)
  const panelHeading = useRef<HTMLHeadingElement>(null)
  const field = useRef<HTMLDivElement>(null)
  const nodeEls = useRef(new Map<string, HTMLElement>())
  const [paths, setPaths] = useState<Path[]>([])

  const say = useCallback((pair: { book: string; commons: string }) => labelOf(pair, view.labels), [view.labels])
  const shown = useMemo(() => visibleNodes(model, view), [model, view])
  const lines = useMemo(() => visibleEdges(model, view), [model, view])
  const open = openNode(model, view, selected)
  const altitude = model.altitudes.find(item => item.id === view.altitude)!
  const otherMode = model.labelModes.find(item => item.id !== view.labels)!
  const layout = arrange(shown)
  const walkthrough = walkId ? model.walkthroughs.find(item => item.id === walkId)! : null
  const step = walkthrough ? walkthrough.steps[Math.min(stepIndex, walkthrough.steps.length - 1)] : null
  const walkEdges = useMemo(() => (step ? [...(step.via ? [step.via.edge] : []), ...step.supports.map(ref => ref.edge)] : []), [step])

  const toggleLayer = (id: LayerId) => setView(current => ({ ...current, layers: { ...current.layers, [id]: !current.layers[id] } }))
  const setLabels = (labels: LabelMode) => setView(current => ({ ...current, labels }))
  const setAltitude = (next: AltitudeId) => setView(current => ({ ...current, altitude: next }))
  const follow = (id: WalkId | null) => {
    setWalkId(id)
    setStepIndex(0)
    const flow = id ? model.walkthroughs.find(item => item.id === id)!.flow : null
    if (flow) setView(current => withLayer(current, flow))
  }
  const choose = (id: string) => {
    setSelected(id)
    if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 1024px)').matches) {
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      requestAnimationFrame(() => {
        panelHeading.current?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' })
        panelHeading.current?.focus({ preventScroll: true })
      })
    }
  }
  const stepRegion = useRef<HTMLDivElement>(null)
  const previousStep = useRef<HTMLButtonElement>(null)
  const nextStep = useRef<HTMLButtonElement>(null)
  /* Reaching the first or last step disables the button that has focus, and browsers blur a control as soon as it is disabled.
     Move focus to the labelled walkthrough region before that render, so arrow keys, Home and End keep working. */
  const goToStep = (target: number) => {
    if (!walkthrough) return
    const last = walkthrough.steps.length - 1
    const index = Math.max(0, Math.min(last, target))
    const active = typeof document === 'undefined' ? null : document.activeElement
    if ((index === 0 && active === previousStep.current) || (index === last && active === nextStep.current)) stepRegion.current?.focus()
    setStepIndex(index)
  }
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
      let d: string
      if (Math.abs(ac.y - bc.y) < Math.min(a.h, b.h) / 2) {
        const right = bc.x > ac.x
        const sx = right ? a.x + a.w : a.x
        const ex = right ? b.x : b.x + b.w
        d = `M ${sx} ${ac.y} C ${(sx + ex) / 2} ${ac.y} ${(sx + ex) / 2} ${bc.y} ${ex} ${bc.y}`
      } else {
        const down = bc.y > ac.y
        const sy = down ? a.y + a.h : a.y
        const ey = down ? b.y : b.y + b.h
        const bend = (ey - sy) / 2
        d = `M ${ac.x} ${sy} C ${ac.x} ${sy + bend} ${bc.x} ${ey - bend} ${bc.x} ${ey}`
      }
      next.push({ id: item.id, flow: item.flow, d, support: item.role === 'support', future: item.layers.includes('future'), walk: walkEdges.includes(item.id) })
    }
    setPaths(current => (JSON.stringify(current) === JSON.stringify(next) ? current : next))
  }, [lines, walkEdges])
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
    const body = (
      <>
        <span className={`block font-semibold leading-snug ${variant === 'centre' ? 'text-lg' : 'text-[0.95rem]'}`}>{say(item.label)}</span>
        <span className="mt-1.5 flex flex-wrap gap-1.5">
          {futureOnly && <Stamp>{model.boundaryStamp.future}</Stamp>}
          {item.id === model.defaultView.hero && <span className="text-xs text-muted-foreground">Start here</span>}
          {onWalk && step && <span className="text-xs font-semibold">On the walk · step {step.n}</span>}
        </span>
        {outgoing.length > 0 && (
          <span className="mt-2 flex flex-col gap-0.5 text-xs" aria-hidden="true">
            {outgoing.map(each => <span key={each.id} className={`${inkClass[each.flow]} break-words`}>{each.to === item.id ? '↻ ' : '→ '}{say(nodeById(model, each.to)!.label)}</span>)}
          </span>
        )}
      </>
    )
    /* Opaque so connectors pass beneath the cards, never through their text. */
    const tone = variant === 'centre' ? 'bg-card dark:bg-background border-[#A88A2D]/70 border-2' : 'bg-card dark:bg-background'
    const className = `${styles.node} ${isOpen ? styles.nodeOpen : ''} ${onWalk ? styles.nodeWalk : ''} relative z-10 block w-full min-w-0 rounded-xl border border-border ${tone} p-3 text-left`
    if (item.interactive === false) return <div ref={register(item.id)} className={className}>{body}</div>
    return (
      <button
        ref={register(item.id)}
        type="button"
        aria-pressed={isOpen}
        aria-controls="econ-detail"
        onClick={() => choose(item.id)}
        className={`${className} min-h-11 hover:border-[#A88A2D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A88A2D]`}
      >
        {body}
      </button>
    )
  }

  const modelLayers = layersOfKind(model, 'model')
  const flowLayers = layersOfKind(model, 'flow')

  return (
    <div className="mt-8">
      <ul className="flex flex-wrap gap-2" aria-label="What is and is not real on this map">
        {model.stamps.map(line => <li key={line}><Stamp>{line}</Stamp></li>)}
      </ul>

      <section aria-label="Map controls" className={`${styles.noPrint} mt-8 grid gap-4 rounded-2xl border border-border bg-card p-4 sm:p-6 md:grid-cols-2`}>
        <div role="group" aria-labelledby="econ-layers" className="flex flex-wrap items-center gap-2">
          <span id="econ-layers" className="w-full font-heading text-xs uppercase tracking-[0.18em] text-muted-foreground">Layers</span>
          {modelLayers.map(item => <Toggle key={item.id} pressed={view.layers[item.id]} onClick={() => toggleLayer(item.id)}>{say(item.label)}</Toggle>)}
        </div>
        <div role="group" aria-labelledby="econ-flows" className="flex flex-wrap items-center gap-2">
          <span id="econ-flows" className="w-full font-heading text-xs uppercase tracking-[0.18em] text-muted-foreground">Flows</span>
          {flowLayers.map(item => <Toggle key={item.id} pressed={view.layers[item.id]} flow={item.id as FlowId} onClick={() => toggleLayer(item.id)}>{say(item.label)}</Toggle>)}
        </div>
        <div role="group" aria-labelledby="econ-labels" className="flex flex-wrap items-center gap-2">
          <span id="econ-labels" className="w-full font-heading text-xs uppercase tracking-[0.18em] text-muted-foreground">Labels</span>
          {model.labelModes.map(item => <Toggle key={item.id} pressed={view.labels === item.id} onClick={() => setLabels(item.id)}>{item.label}</Toggle>)}
        </div>
        <div role="group" aria-labelledby="econ-altitude" className="flex flex-wrap items-center gap-2">
          <span id="econ-altitude" className="w-full font-heading text-xs uppercase tracking-[0.18em] text-muted-foreground">Altitude</span>
          {model.altitudes.map(item => <Toggle key={item.id} pressed={view.altitude === item.id} onClick={() => setAltitude(item.id)}>{item.label}</Toggle>)}
        </div>
      </section>

      <p className="mt-5 max-w-3xl text-sm leading-6 text-muted-foreground" aria-live="polite"><b className="text-foreground">{altitude.label}.</b> {altitude.audience} {model.altitudeRule}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <figure className="min-w-0" aria-labelledby="econ-map-caption">
          <div ref={field} className="relative">
            <svg className={`${styles.lines} hidden md:block`} aria-hidden="true" focusable="false">
              <defs>
                {model.flows.map(item => (
                  <marker key={item.id} id={`econ-arrow-${item.id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M 1 1 L 9 5 L 1 9" className={`${styles.arrow} ${inkClass[item.id]}`} />
                  </marker>
                ))}
              </defs>
              {paths.map(item => (
                <path key={item.id} d={item.d} markerEnd={`url(#econ-arrow-${item.flow})`} className={`${styles.line} ${inkClass[item.flow]}${item.support ? ` ${styles.support}` : ''}${item.future ? ` ${styles.future}` : ''}${item.walk ? ` ${styles.walk}` : ''}`} />
              ))}
            </svg>
            {shown.length === 0
              ? <p className="rounded-xl border border-dashed border-border p-6 text-muted-foreground">Every layer is off. Turn on a layer to show the map again.</p>
              : (
                <div className="relative flex flex-col gap-10">
                  {layout.groups.map(({ group, members }) => (
                    <div key={group.id} className="relative rounded-2xl border border-dashed border-border p-3 sm:p-4">
                      <div className="max-w-sm">{card(group, 'group')}</div>
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">{members.map(item => <div key={item.id} className="min-w-0">{card(item, 'member')}</div>)}</div>
                    </div>
                  ))}
                  {layout.centre.length > 0 && <div className="mx-auto grid w-full max-w-md gap-3">{layout.centre.map(item => <div key={item.id}>{card(item, 'centre')}</div>)}</div>}
                  {layout.rest.length > 0 && <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">{layout.rest.map(item => <div key={item.id} className="min-w-0">{card(item, 'node')}</div>)}</div>}
                </div>
              )}
          </div>
          <figcaption id="econ-map-caption" className="mt-5 text-sm leading-6 text-muted-foreground">
            {shown.length} of {model.nodes.length} nodes and {lines.length} of {model.edges.length} flows shown.{' '}
            {model.flows.map((item, index) => (
              <span key={item.id} className={view.layers[item.id] ? undefined : 'opacity-60'}>
                {index > 0 ? ' · ' : ''}<Swatch flow={item.id} /> {say(item.label)}{view.layers[item.id] ? '' : ' (off)'}
              </span>
            ))}
            . Choose a node to see its details. The same map is listed as a table below.
          </figcaption>
        </figure>

        <section id="econ-detail" aria-labelledby="econ-detail-title" className={`${styles.panel} self-start rounded-2xl border border-border bg-card p-5 sm:p-6 lg:sticky lg:top-24`}>
          {open ? (
            <>
              <p className="font-heading text-xs uppercase tracking-[0.18em] text-muted-foreground">Details · {altitude.label}</p>
              <h2 id="econ-detail-title" ref={panelHeading} tabIndex={-1} className="mt-3 font-premium text-2xl leading-tight focus:outline-none">{say(open.label)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{otherMode.label}: {labelOf(open.label, otherMode.id)}</p>
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="What this node is and is not">
                {open.boundaries.map((id: Boundary) => <li key={id}><Stamp tbd={id === 'tbd'}>{model.boundaryStamp[id]}</Stamp></li>)}
              </ul>
              <dl className="mt-4 space-y-3 text-sm leading-6">
                <div><dt className="font-semibold">Work</dt><dd className="text-muted-foreground">{open.tap.works}</dd></div>
                <div><dt className="font-semibold">Decisions</dt><dd className="text-muted-foreground">{open.tap.decides.text} <Stamp tbd={open.tap.decides.authority === 'tbd'}>{model.boundaryStamp[open.tap.decides.authority]}</Stamp></dd></div>
                <div>
                  <dt className="font-semibold">At this altitude</dt>
                  <dd><ul className="space-y-1 text-muted-foreground">{captionsAt(model, open.id, view.altitude).map(item => <li key={item.id}><b className="text-foreground">{model.altitudes.find(each => each.id === item.detail)!.label}.</b> {item.text}</li>)}</ul></dd>
                </div>
                {touching(lines, open.id).length > 0 && (
                  <div>
                    <dt className="font-semibold">Connections</dt>
                    <dd><ul className="space-y-1 text-muted-foreground">{touching(lines, open.id).map(item => <li key={item.id}><Swatch flow={item.flow} /> <b className="text-foreground">{say(flowOf(model, item.flow).label)}</b> {say(nodeById(model, item.from)!.label)} → {say(nodeById(model, item.to)!.label)}: {say(item.label)}</li>)}</ul></dd>
                  </div>
                )}
              </dl>
              <div className="mt-5 border-t border-border pt-4 text-sm leading-6">
                <h3 className="font-semibold">Open responsibilities</h3>
                {open.tap.claims.length
                  ? <ul className="mt-2 space-y-2">{open.tap.claims.map(item => <li key={item.id}><span className="block">{item.label}</span><span className="text-muted-foreground"><Destination target={joinOf(model, item.join)} resolve={resolve} /></span></li>)}</ul>
                  : <p className="mt-1 text-muted-foreground">Nothing here is open to claim.</p>}
                {open.joins.filter(id => !open.tap.claims.some(item => item.join === id)).map(id => <p key={id} className="mt-2 text-muted-foreground"><Destination target={joinOf(model, id)} resolve={resolve} /></p>)}
              </div>
            </>
          ) : (
            <>
              <h2 id="econ-detail-title" ref={panelHeading} tabIndex={-1} className="font-premium text-2xl leading-tight focus:outline-none">No node selected</h2>
              <p className="mt-2 text-sm text-muted-foreground">The selected node is hidden by the current layers. Choose any node on the map.</p>
            </>
          )}
        </section>
      </div>

      {layout.tried.length > 0 && (
        <section aria-labelledby="econ-tried-title" className={`${styles.avoidBreak} mt-10 rounded-2xl border border-dashed border-border p-5 text-muted-foreground sm:p-6`}>
          <h2 id="econ-tried-title" className="font-heading text-sm uppercase tracking-[0.18em]">{say(model.layers.find(item => item.id === 'tried')!.label)}</h2>
          <ul className="mt-3 space-y-3">
            {layout.tried.map(item => {
              const line = historicalLineOf(model, item.id)
              return (
                <li key={item.id} ref={register(item.id)} className="flex flex-wrap items-baseline gap-2">
                  <b className="text-foreground/80">{say(item.label)}</b>
                  {line && <><Stamp>{line.stamp}</Stamp><span>{line.text}</span></>}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="econ-walk-title" className="mt-12">
        <h2 id="econ-walk-title" className="font-heading text-xl font-bold tracking-wide">Follow one thing</h2>
        <div role="group" aria-label="Walkthroughs" className={`${styles.noPrint} mt-4 flex flex-wrap gap-2`}>
          {model.walkthroughs.map(item => <Toggle key={item.id} pressed={walkId === item.id} flow={item.flow} onClick={() => follow(walkId === item.id ? null : item.id)}>{item.label}</Toggle>)}
        </div>
        {walkthrough && step ? (
          <div ref={stepRegion} tabIndex={-1} className="mt-5 rounded-2xl border border-border bg-card p-5 sm:p-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A88A2D]" role="region" aria-label={`${walkthrough.label}, step ${step.n} of ${step.of}`} onKeyDown={stepKeys}>
            <p className="text-sm text-muted-foreground">{walkthrough.line}</p>
            <article className={`${styles.avoidBreak} mt-4`} aria-labelledby={`econ-step-${step.id}`} aria-live="polite">
              <p className="font-heading text-xs uppercase tracking-[0.18em] text-muted-foreground">Step {step.n} of {step.of} · {labelOf(step.place, view.labels)} · {step.altitudeLabel}</p>
              <h3 id={`econ-step-${step.id}`} className="mt-2 font-premium text-2xl leading-tight">{step.title}</h3>
              <p className="mt-2 leading-7">{step.caption}</p>
              {step.via && <p className="mt-2 text-sm text-muted-foreground"><b className="text-foreground">Arrives by</b> {labelOf(step.via.label, view.labels)}</p>}
              {step.supports.length > 0 && <p className="mt-1 text-sm text-muted-foreground"><b className="text-foreground">Supported by</b> {step.supports.map(ref => labelOf(ref.label, view.labels)).join('; ')}</p>}
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="What this step is and is not">{step.stamps.map(line => <li key={line}><Stamp tbd={line === model.boundaryStamp.tbd}>{line}</Stamp></li>)}</ul>
              <dl className="mt-4 grid gap-3 text-sm leading-6 md:grid-cols-2">
                {step.responsibilities.map(line => (
                  <div key={line.key} className="min-w-0"><dt className="font-semibold">{line.label}</dt><dd className="text-muted-foreground"><b className="text-foreground">{line.holderLabel}.</b> {line.who} <Stamp tbd={line.authority === 'tbd'}>{line.stamp}</Stamp></dd></div>
                ))}
                <div className="min-w-0">
                  <dt className="font-semibold">{step.correction.label}</dt>
                  <dd className="text-muted-foreground">
                    {step.correction.decided
                      ? <><b className="text-foreground">{step.correction.holderLabel}.</b> {step.correction.who} <Stamp tbd={step.correction.authority === 'tbd'}>{step.correction.stamp}</Stamp></>
                      : <>{step.correction.text} <Stamp tbd>{step.correction.stamp}</Stamp></>}
                  </dd>
                </div>
              </dl>
              {step.joins.length > 0 && <ul className="mt-4 space-y-1 text-sm text-muted-foreground">{step.joins.map(target => <li key={target.id}><Destination target={target} resolve={resolve} /></li>)}</ul>}
            </article>
            <div className={`${styles.noPrint} mt-5 flex flex-wrap items-center gap-3`}>
              <button type="button" ref={previousStep} onClick={() => goToStep(stepIndex - 1)} disabled={step.n === 1} className="min-h-11 rounded-full border border-border px-4 text-sm disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A88A2D]">Previous step</button>
              <button type="button" ref={nextStep} onClick={() => goToStep(stepIndex + 1)} disabled={step.n === step.of} className="min-h-11 rounded-full border border-border px-4 text-sm disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A88A2D]">Next step</button>
              <span className="text-xs text-muted-foreground">Arrow keys move between steps.</span>
            </div>
          </div>
        ) : <p className="mt-4 text-sm text-muted-foreground">Choose a walkthrough to follow it step by step across the map.</p>}
      </section>

      <section aria-labelledby="econ-table-title" className="mt-12">
        <h2 id="econ-table-title" className="font-heading text-xl font-bold tracking-wide">The map as a table</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Flows shown on the map, with what passes and its standing</caption>
            <thead className="bg-card"><tr>{['Flow', 'From', 'What passes', 'To', 'Standing'].map(head => <th key={head} scope="col" className="px-3 py-2 font-semibold">{head}</th>)}</tr></thead>
            <tbody>
              {lines.length
                ? lines.map((item: Edge) => (
                  <tr key={item.id} className="border-t border-border align-top">
                    <th scope="row" className="px-3 py-2 font-normal"><Swatch flow={item.flow} /> {say(flowOf(model, item.flow).label)}</th>
                    <td className="px-3 py-2">{say(nodeById(model, item.from)!.label)}</td>
                    <td className="px-3 py-2">{say(item.label)}</td>
                    <td className="px-3 py-2">{say(nodeById(model, item.to)!.label)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{item.boundaries.map(id => model.boundaryStamp[id]).join(' · ')}</td>
                  </tr>
                ))
                : <tr><td colSpan={5} className="px-3 py-3 text-muted-foreground">No flow is shown. Turn on a flow above.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <details className="mt-10 rounded-2xl border border-border p-5 sm:p-6">
        <summary className="cursor-pointer font-heading text-sm uppercase tracking-[0.18em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A88A2D]">Sources and method</summary>
        <ul className="mt-4 space-y-3 text-sm leading-6">
          {model.sources.map(item => (
            <li key={item.id}><b>{item.title}</b> <Stamp>{item.check === 'pending' ? 'Check pending' : item.check === 'verified' ? 'Checked' : 'Project document'}</Stamp><span className="block text-muted-foreground">{item.use}</span></li>
          ))}
        </ul>
        <ul className="mt-4 space-y-1 text-sm text-muted-foreground">{model.holders.map(item => <li key={item.id}><b className="text-foreground">{item.label}.</b> {item.line}</li>)}</ul>
        <p className="mt-4 text-sm text-muted-foreground">This map is drawn from the Roxbury Commons economy model and shown here without changes.</p>
      </details>
    </div>
  )
}
