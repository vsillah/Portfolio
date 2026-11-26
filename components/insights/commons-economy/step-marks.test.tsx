import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { commonsEconomyTransport } from './generated/commons-economy-envelope.generated'
import { commonsEconomyStepMarks, type StepMarks } from './step-marks'
import { envelopeFor, syntheticModel } from './synthetic-envelope.test-fixture'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a>,
}))

const envelope = envelopeFor(syntheticModel())
vi.mock('./adapter', async original => {
  const actual = await original<typeof import('./adapter')>()
  return { ...actual, adaptEconomyEnvelope: (input: unknown) => actual.adaptEconomyEnvelope(input, { acceptedPayloadSha256: envelope.payloadSha256 }) }
})
const { default: CommonsEconomyMap } = await import('./CommonsEconomyMap')
const { default: styles } = await import('./CommonsEconomyMap.module.css')

type Walk = { id: string; label: string; steps: { id: string; title: string; caption: string }[] }
const payload = JSON.parse(commonsEconomyTransport.envelope.payload) as { walkthroughs: Walk[] }
const drawn = (id: string) => renderToStaticMarkup(<svg>{commonsEconomyStepMarks[id].art}</svg>)

describe('Commons Economy Map step marks', () => {
  it('has exactly one mark for every step of every transported walkthrough, and none for anything else', () => {
    expect(payload.walkthroughs.map(walk => walk.id)).toEqual(['meal', 'dollar', 'vote'])
    const stepIds = payload.walkthroughs.flatMap(walk => walk.steps.map(step => step.id))
    expect(stepIds).toHaveLength(11)
    expect(Object.keys(commonsEconomyStepMarks).sort()).toEqual([...stepIds].sort())
  })

  it('draws every mark differently, as ink in the current colour, with nothing borrowed from an icon font or an emoji', () => {
    const all = Object.keys(commonsEconomyStepMarks).map(drawn)
    expect(new Set(all).size).toBe(all.length)
    for (const markup of all) {
      expect(markup).toMatch(/<(path|circle) /)
      expect(markup).not.toMatch(/<(text|image|use|foreignObject)\b/)
      expect(markup).not.toMatch(/\p{Extended_Pictographic}/u)
      /* No colour of its own: fills and strokes are the current colour, or none. */
      for (const paint of markup.match(/(?:fill|stroke)="[^"]*"/g) ?? []) expect(paint).toMatch(/="(currentColor|none)"/)
    }
  })

  it('describes each drawing without repeating the model', () => {
    const source = readFileSync(join(process.cwd(), 'components', 'insights', 'commons-economy', 'step-marks.tsx'), 'utf8')
    for (const walk of payload.walkthroughs) {
      expect(source).not.toContain(walk.label)
      for (const step of walk.steps) {
        expect(commonsEconomyStepMarks[step.id].cue.length).toBeGreaterThan(12)
        expect(source).not.toContain(step.title)
        expect(source).not.toContain(step.caption)
      }
    }
  })
})

describe('Commons Economy Map wayfinding on the page', () => {
  const marks: StepMarks = {
    'w-1': { cue: 'Synthetic drawing one', art: <path d="M1 1h10v10H1z" /> },
    'w-2': { cue: 'Synthetic drawing two', art: <circle cx="12" cy="12" r="8" /> },
  }
  const open = async (given?: StepMarks) => {
    render(given ? <CommonsEconomyMap envelope={envelope} marks={given} /> : <CommonsEconomyMap envelope={envelope} />)
    await screen.findByRole('heading', { level: 2, name: 'Synthetic local A' })
  }
  const figure = () => document.querySelector('[aria-labelledby="econ-map-caption"]') as HTMLElement
  const rail = () => within(screen.getByRole('region', { name: /Synthetic walk, step \d of 2/ })).getByRole('list', { name: /2 steps of Synthetic walk/ })
  const stops = () => within(rail()).getAllByRole('listitem')
  const markIn = (root: Element, id: string) => [...root.querySelectorAll(`[data-step-mark="${id}"]`)]
  const state = (li: HTMLElement) => (li.getAttribute('aria-current') === 'step' ? 'current' : li.className.split(/\s+/).includes(styles.railDone) ? 'done' : 'upcoming')
  const tagOf = (id: string) => markIn(figure(), id)[0].parentElement!.querySelector(`.${styles.onWalk}, .${styles.stopNo}`)!
  const tagState = (id: string) => { const cls = tagOf(id).className.split(/\s+/); return cls.includes(styles.onWalk) ? 'current' : cls.includes(styles.stopDone) ? 'done' : 'upcoming' }
  afterEach(() => vi.useRealTimers())

  it('prints no mark for a step that has none, and changes no name or number', async () => {
    await open()
    expect(document.querySelectorAll('[data-step-mark]')).toHaveLength(0)
    expect(stops().map(li => li.textContent)).toEqual(['1Step 1: Synthetic step one, at Synthetic local A', '2Step 2: Synthetic step two, at Synthetic local centre'])
  })

  it('prints the same mark for a step on the rail and on its node, once each, hidden from assistive technology, beside the number and the name', async () => {
    await open(marks)
    for (const [index, id] of ['w-1', 'w-2'].entries()) {
      const onRail = markIn(stops()[index], id), onPlate = markIn(figure(), id)
      expect(onRail).toHaveLength(1)
      expect(onPlate).toHaveLength(1)
      expect(markIn(document.body, id)).toHaveLength(2)
      expect(onRail[0].innerHTML).toBe(onPlate[0].innerHTML)
      for (const mark of [onRail[0], onPlate[0]]) {
        expect(mark).toHaveAttribute('aria-hidden', 'true')
        expect(mark.querySelector('svg')).toHaveAttribute('focusable', 'false')
        expect(mark.textContent).toBe('')
      }
      /* The other step's mark is nowhere in this stop. */
      expect(markIn(stops()[index], index === 0 ? 'w-2' : 'w-1')).toHaveLength(0)
    }
    expect(markIn(document.body, 'w-1')[0].innerHTML).not.toBe(markIn(document.body, 'w-2')[0].innerHTML)
    /* Number and words are still printed, and the names are what they were without marks. */
    expect(stops().map(li => li.textContent)).toEqual(['1Step 1: Synthetic step one, at Synthetic local A', '2Step 2: Synthetic step two, at Synthetic local centre'])
    expect(within(figure()).getByRole('button', { name: /^Synthetic local A\s*On the walk · step 1/ })).toContainElement(markIn(figure(), 'w-1')[0] as HTMLElement)
    expect(within(figure()).getByRole('button', { name: /^Synthetic local centre\s*Step 2/ })).toContainElement(markIn(figure(), 'w-2')[0] as HTMLElement)
    expect(tagOf('w-1').textContent).toBe('On the walk · step 1')
    expect(tagOf('w-2').textContent).toBe('Step 2')
  })

  it('keeps current, done and upcoming in step, on the rail and the plate, through manual steps', async () => {
    await open(marks)
    expect(stops().map(state)).toEqual(['current', 'upcoming'])
    expect(['w-1', 'w-2'].map(tagState)).toEqual(['current', 'upcoming'])
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    expect(stops().map(state)).toEqual(['done', 'current'])
    expect(['w-1', 'w-2'].map(tagState)).toEqual(['done', 'current'])
    expect(markIn(stops()[1], 'w-2')).toHaveLength(1)
    expect(markIn(figure(), 'w-1')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Previous step' }))
    expect(stops().map(state)).toEqual(['current', 'upcoming'])
    expect(['w-1', 'w-2'].map(tagState)).toEqual(['current', 'upcoming'])
    fireEvent.keyDown(rail().closest('[role="region"]')!, { key: 'End' })
    expect(stops().map(state)).toEqual(['done', 'current'])
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
    expect(stops().map(state)).toEqual(['current', 'upcoming'])
    fireEvent.click(screen.getByRole('button', { name: 'Synthetic walk' }))
    expect(stops().map(state)).toEqual(['current', 'upcoming'])
    expect(markIn(document.body, 'w-1')).toHaveLength(2)
  })

  it('keeps the states and the marks in step during autoplay', async () => {
    await open(marks)
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(stops().map(state)).toEqual(['current', 'upcoming'])
    act(() => { vi.advanceTimersByTime(7000) })
    expect(stops().map(state)).toEqual(['done', 'current'])
    expect(['w-1', 'w-2'].map(tagState)).toEqual(['done', 'current'])
    for (const id of ['w-1', 'w-2']) expect(markIn(document.body, id).map(el => el.innerHTML)).toEqual([markIn(document.body, id)[0].innerHTML, markIn(document.body, id)[0].innerHTML])
  })

  it('sets the rail numeral as one centred figure in a square box, with no figure features that the centring cannot measure', async () => {
    await open(marks)
    for (const [index, li] of stops().entries()) {
      const box = li.querySelector(`.${styles.railNo}`)!
      expect(box).toHaveAttribute('aria-hidden', 'true')
      expect(box.children).toHaveLength(1)
      expect(box.firstElementChild!.className).toBe(styles.railDigit)
      expect(box.textContent).toBe(String(index + 1))
    }
    const css = readFileSync(join(process.cwd(), 'components', 'insights', 'commons-economy', 'CommonsEconomyMap.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const box = css.match(/\n\.railNo \{([^}]*)\}/)![1], digit = css.match(/\n\.railDigit \{([^}]*)\}/)![1]
    expect(box).toMatch(/display: grid; place-items: center;/)
    expect(box).toMatch(/width: 1\.7rem; height: 1\.7rem;/)
    expect(digit).toMatch(/var\(--sans\)/)
    expect(digit).toMatch(/font-variant-numeric: normal; font-feature-settings: normal;/)
    expect(digit).toMatch(/text-box: trim-both cap alphabetic;/)
    expect(digit).not.toMatch(/padding|margin|top:|left:/)
  })
})
