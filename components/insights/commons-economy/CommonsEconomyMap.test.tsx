import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useState } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
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

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((query: string) => ({ matches: query.includes('min-width'), media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList)
})

const pressed = (name: string | RegExp) => screen.getByRole('button', { name }).getAttribute('aria-pressed')

describe('Commons Economy Map skin', () => {
  it('stays closed and prints nothing from a missing envelope', async () => {
    render(<CommonsEconomyMap envelope={null} />)
    const status = await screen.findByText('This map is unavailable right now')
    expect(status.closest('[data-rejection]')?.getAttribute('data-rejection')).toBe('envelope')
    expect(screen.queryByText(/Synthetic/)).not.toBeInTheDocument()
  })

  it('stays closed for a tampered envelope', async () => {
    render(<CommonsEconomyMap envelope={{ ...envelope, payload: envelope.payload.replace('Synthetic work A', 'Synthetic work Z') }} />)
    expect(await screen.findByText('This map is unavailable right now')).toBeInTheDocument()
    expect(screen.queryByText(/Synthetic work/)).not.toBeInTheDocument()
  })

  it('opens from the envelope defaults and prints only envelope values', async () => {
    render(<CommonsEconomyMap envelope={envelope} />)
    const detail = await screen.findByRole('heading', { level: 2, name: 'Synthetic local A' })
    expect(detail).toBeInTheDocument()
    const panel = detail.closest('section')!
    expect(within(panel).getByText('Synthetic work A')).toBeInTheDocument()
    expect(within(panel).getByText('Synthetic caption A block')).toBeInTheDocument()
    expect(within(panel).queryByText('Synthetic caption A household')).not.toBeInTheDocument()
    expect(within(panel).getByText('Join · Synthetic destination').closest('a')).toBeNull()
    expect(screen.queryByRole('button', { name: /Synthetic (local|book) layer [PR]/ })).toBeNull()
    expect(pressed('Synthetic local layer T')).toBe('false')
    expect(pressed('Synthetic local flow F')).toBe('false')
    expect(within(screen.getByRole('list', { name: 'What is and is not real on this map' })).getByText('Synthetic page stamp')).toBeInTheDocument()
    expect(screen.queryByText('Synthetic local old')).not.toBeInTheDocument()
  })

  it('follows altitude, layer and flow toggles', async () => {
    render(<CommonsEconomyMap envelope={envelope} />)
    await screen.findByRole('heading', { level: 2, name: 'Synthetic local A' })
    fireEvent.click(screen.getByRole('button', { name: 'Synthetic altitude household' }))
    expect(screen.getByText('Synthetic caption A household')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Synthetic local layer T' }))
    expect(screen.getByText('Synthetic pending line')).toBeInTheDocument()
    expect(screen.getByText('Synthetic local old').closest('button')).toBeNull()
    expect(screen.queryAllByText('Synthetic local funding edge')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Synthetic local flow F' }))
    expect(screen.getAllByText('Synthetic local funding edge').length).toBeGreaterThan(0)
  })

  it('prints one model: no version or term comparison on the sheet, with the source credited under Sources and method', async () => {
    render(<CommonsEconomyMap envelope={envelope} />)
    await screen.findByRole('heading', { level: 2, name: 'Synthetic local A' })
    const sources = screen.getByText('Sources and method').closest('details')!
    expect(sources.open).toBe(false)
    for (const name of [/Synthetic mode/, /Synthetic (local|book) layer [PR]/]) expect(screen.queryByRole('button', { name })).toBeNull()
    expect(document.getElementById('econ-labels')).toBeNull()
    const bookTerms = screen.queryAllByText(/Synthetic book/)
    expect(bookTerms.length).toBeGreaterThan(0)
    for (const el of bookTerms) expect(sources.contains(el)).toBe(true)
    for (const el of screen.queryAllByText(/Synthetic local layer [PR]/)) expect(sources.contains(el)).toBe(true)
    expect(within(sources).getByText(/In the source: Synthetic book A/)).toBeInTheDocument()
    expect(within(sources).getByText('Synthetic local layer P.')).toBeInTheDocument()
    expect(within(sources).getByText('Synthetic local layer R.')).toBeInTheDocument()
    /* The model itself cannot be switched off, so the plate never empties. */
    for (const toggle of within(screen.getByRole('region', { name: 'Map controls' })).getAllByRole('button', { pressed: true })) if (!/altitude/.test(toggle.textContent!)) fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: /^Synthetic local centre/ })).toBeInTheDocument()
  })

  it('opens on the first walkthrough at its first step, and a chosen path cannot be switched off', async () => {
    render(<CommonsEconomyMap envelope={envelope} />)
    await screen.findByRole('heading', { level: 2, name: 'Synthetic local A' })
    const region = screen.getByRole('region', { name: /Synthetic walk, step 1 of 2/ })
    expect(pressed('Synthetic walk')).toBe('true')
    expect(within(region).getByRole('heading', { level: 2, name: 'Synthetic step one' })).toBeInTheDocument()
    const rail = within(region).getByRole('list', { name: /2 steps of Synthetic walk/ })
    expect(within(rail).getAllByRole('listitem')).toHaveLength(2)
    expect(within(rail).getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'step')
    /* The plate leads: the console, then the plate, and only then the supporting detail and the map controls. */
    const figure = document.querySelector('[aria-labelledby="econ-map-caption"]') as HTMLElement
    const after = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(after(region, figure)).toBe(true)
    expect(after(figure, screen.getByRole('heading', { level: 2, name: 'Who does what' }))).toBe(true)
    expect(after(figure, screen.getByRole('region', { name: 'Map controls' }))).toBe(true)
    expect(figure.contains(region)).toBe(false)
    /* The path is on the plate before anything is pressed: the current stop, the other stop, and the route between them. */
    expect(within(figure).getByRole('button', { name: /^Synthetic local A\s*On the walk · step 1/ })).toBeInTheDocument()
    expect(within(figure).getByRole('button', { name: /^Synthetic local centre\s*Step 2/ })).toBeInTheDocument()
    expect(figure.querySelector(`.${styles.routePath}`)).not.toBeNull()
    fireEvent.keyDown(region, { key: 'End' })
    fireEvent.click(screen.getByRole('button', { name: 'Synthetic walk' }))
    expect(pressed('Synthetic walk')).toBe('true')
    expect(screen.getByRole('region', { name: /Synthetic walk, step 1 of 2/ })).toBeInTheDocument()
  })

  it('walks step by step with buttons and arrow keys, including the derived correction line', async () => {
    render(<CommonsEconomyMap envelope={envelope} />)
    await screen.findByRole('heading', { level: 2, name: 'Synthetic local A' })
    fireEvent.click(screen.getByRole('button', { name: 'Synthetic walk' }))
    const region = screen.getByRole('region', { name: /Synthetic walk, step 1 of 2/ })
    const full = document.getElementById('econ-step-full')!
    expect(within(full).getByText('Synthetic undecided correction')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous step' })).toBeDisabled()
    fireEvent.keyDown(region, { key: 'ArrowRight' })
    const next = screen.getByRole('region', { name: /step 2 of 2/ })
    expect(within(next).getByRole('heading', { name: 'Synthetic step two' })).toBeInTheDocument()
    expect(within(full).getAllByText('Synthetic reviewer who corrects')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Next step' })).toBeDisabled()
    fireEvent.keyDown(next, { key: 'Home' })
    expect(screen.getByRole('region', { name: /step 1 of 2/ })).toBeInTheDocument()
  })

  describe('keeps keyboard focus in the walkthrough when the focused step button becomes disabled', () => {
    /* Chromium blurs a focused control the moment it is disabled, before React layout effects run; jsdom does not, so emulate it.
       jsdom ignores blur() on an element that is already disabled, so blur in the same commit just before the attribute lands. */
    let restore: () => void
    beforeEach(() => {
      const setAttribute = Element.prototype.setAttribute
      Element.prototype.setAttribute = function (this: Element, name: string, value: string) {
        if (name === 'disabled' && this === document.activeElement) (this as HTMLElement).blur()
        setAttribute.call(this, name, value)
      }
      restore = () => { Element.prototype.setAttribute = setAttribute }
    })
    afterEach(() => restore())

    const openWalk = async () => {
      render(<CommonsEconomyMap envelope={envelope} />)
      await screen.findByRole('heading', { level: 2, name: 'Synthetic local A' })
      fireEvent.click(screen.getByRole('button', { name: 'Synthetic walk' }))
      return screen.getByRole('region', { name: /Synthetic walk, step 1 of 2/ })
    }
    const stillOperable = () => {
      const region = screen.getByRole('region', { name: /Synthetic walk, step \d of 2/ })
      expect(document.activeElement).toBe(region)
      fireEvent.keyDown(document.activeElement!, { key: 'Home' })
      expect(screen.getByRole('region', { name: /step 1 of 2/ })).toBe(document.activeElement)
      fireEvent.keyDown(document.activeElement!, { key: 'End' })
      expect(screen.getByRole('region', { name: /step 2 of 2/ })).toBe(document.activeElement)
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' })
      expect(screen.getByRole('region', { name: /step 1 of 2/ })).toBe(document.activeElement)
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
      expect(screen.getByRole('region', { name: /step 2 of 2/ })).toBe(document.activeElement)
    }

    it('emulates the browser: a focused button that React disables loses focus during commit', () => {
      const Probe = () => { const [off, setOff] = useState(false); return <button type="button" disabled={off} onClick={() => setOff(true)}>Probe</button> }
      render(<Probe />)
      const probe = screen.getByRole('button', { name: 'Probe' })
      probe.focus()
      fireEvent.click(probe)
      expect(probe).toBeDisabled()
      expect(document.activeElement).toBe(document.body)
    })

    it('when Next step is activated onto the last step', async () => {
      await openWalk()
      const next = screen.getByRole('button', { name: 'Next step' })
      next.focus()
      fireEvent.click(next)
      expect(next).toBeDisabled()
      expect(document.activeElement).not.toBe(document.body)
      stillOperable()
    })

    it('when End or ArrowRight is pressed while Next step has focus', async () => {
      await openWalk()
      for (const key of ['End', 'ArrowRight']) {
        fireEvent.keyDown(screen.getByRole('region', { name: /step \d of 2/ }), { key: 'Home' })
        const next = screen.getByRole('button', { name: 'Next step' })
        next.focus()
        fireEvent.keyDown(next, { key })
        expect(next).toBeDisabled()
        stillOperable()
      }
    })

    it('when Previous step, Home or ArrowLeft reaches the first step while Previous step has focus', async () => {
      await openWalk()
      for (const action of ['click', 'Home', 'ArrowLeft']) {
        fireEvent.keyDown(screen.getByRole('region', { name: /step \d of 2/ }), { key: 'End' })
        const previous = screen.getByRole('button', { name: 'Previous step' })
        previous.focus()
        if (action === 'click') fireEvent.click(previous)
        else fireEvent.keyDown(previous, { key: action })
        expect(previous).toBeDisabled()
        stillOperable()
      }
    })

    it('leaves focus on a step button that stays enabled', async () => {
      await openWalk()
      fireEvent.keyDown(screen.getByRole('region', { name: /step 1 of 2/ }), { key: 'End' })
      const next = screen.getByRole('button', { name: 'Next step' })
      const previous = screen.getByRole('button', { name: 'Previous step' })
      expect(next).toBeDisabled()
      previous.focus()
      fireEvent.keyDown(previous, { key: 'ArrowRight' })
      expect(document.activeElement).toBe(previous)
    })
  })

  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('opens the exact focused closed node with %s after an altitude change', async (_name, keys) => {
    const user = userEvent.setup()
    render(<CommonsEconomyMap envelope={envelope} />)
    await screen.findByRole('heading', { level: 2, name: 'Synthetic local A' })
    await user.click(screen.getByRole('button', { name: 'Synthetic altitude household' }))
    const figure = document.querySelector('[aria-labelledby="econ-map-caption"]') as HTMLElement
    const closed = within(figure).getAllByRole('button', { pressed: false })
    expect(closed.length).toBeGreaterThan(0)
    const target = closed[0]
    target.focus()
    expect(document.activeElement).toBe(target)
    await user.keyboard(keys)
    expect(target.isConnected).toBe(true)
    expect(target).toHaveAttribute('aria-pressed', 'true')
    expect(within(figure).getAllByRole('button', { pressed: true })).toEqual([target])
    expect(document.activeElement).toBe(target)
  })

  it('opens a node from the keyboard', async () => {
    render(<CommonsEconomyMap envelope={envelope} />)
    await screen.findByRole('heading', { level: 2, name: 'Synthetic local A' })
    const centre = screen.getByRole('button', { name: /^Synthetic local centre/ })
    centre.focus()
    fireEvent.click(centre)
    expect(centre).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { level: 2, name: 'Synthetic local centre' })).toBeInTheDocument()
  })
})

describe('Commons Economy Map playback', () => {
  const STEP = 7000
  const open = async () => {
    render(<CommonsEconomyMap envelope={envelope} />)
    await screen.findByRole('heading', { level: 2, name: 'Synthetic local A' })
    vi.useFakeTimers()
  }
  const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })
  const at = (n: number) => screen.queryByRole('region', { name: new RegExp(`Synthetic walk, step ${n} of 2`) })
  const status = () => screen.getByRole('status').textContent
  afterEach(() => vi.useRealTimers())

  it('never plays on load', async () => {
    await open()
    tick(STEP * 20)
    expect(at(1)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull()
    expect(status()).toBe('')
  })

  it('plays only after Play, one step per interval, keeps focus, and stops at the end', async () => {
    await open()
    const play = screen.getByRole('button', { name: 'Play' })
    play.focus()
    fireEvent.click(play)
    expect(play).toHaveTextContent('Pause')
    expect(status()).toMatch(/^Playing Synthetic walk\. A new step every 7 seconds\.$/)
    tick(STEP - 1)
    expect(at(1)).toBeInTheDocument()
    tick(1)
    expect(at(2)).toBeInTheDocument()
    expect(document.activeElement).toBe(play)
    expect(play).toHaveTextContent('Play')
    expect(status()).toBe('End of Synthetic walk.')
    tick(STEP * 5)
    expect(at(2)).toBeInTheDocument()
    /* The step article is the polite announcement, and it carries the step's standing exactly as it does by hand. */
    const article = within(at(2)!).getByRole('article')
    expect(article).toHaveAttribute('aria-live', 'polite')
    expect(within(article).getByRole('list', { name: 'What this step is and is not' }).children.length).toBeGreaterThan(0)
    fireEvent.click(play)
    expect(at(1)).toBeInTheDocument()
    expect(play).toHaveTextContent('Pause')
  })

  it('pauses with Pause, and Restart returns to the first step', async () => {
    await open()
    const play = screen.getByRole('button', { name: 'Play' })
    fireEvent.click(play)
    tick(STEP / 2)
    fireEvent.click(play)
    expect(play).toHaveTextContent('Play')
    expect(status()).toBe('Paused.')
    tick(STEP * 3)
    expect(at(1)).toBeInTheDocument()
    fireEvent.keyDown(at(1)!, { key: 'End' })
    expect(at(2)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
    expect(at(1)).toBeInTheDocument()
  })

  it.each([
    ['a step key', () => fireEvent.keyDown(screen.getByRole('region', { name: /Synthetic walk/ }), { key: 'Home' })],
    ['Next step', () => fireEvent.click(screen.getByRole('button', { name: 'Next step' }))],
    ['choosing a path', () => fireEvent.click(screen.getByRole('button', { name: 'Synthetic walk' }))],
    ['the document becoming hidden', () => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
      fireEvent(document, new Event('visibilitychange'))
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    }],
  ])('pauses on %s and does not resume by itself', async (_name, interrupt) => {
    await open()
    const play = screen.getByRole('button', { name: 'Play' })
    fireEvent.click(play)
    tick(1000)
    interrupt()
    expect(play).toHaveTextContent('Play')
    expect(status()).toBe('Paused.')
    const where = screen.getByRole('region', { name: /Synthetic walk/ }).getAttribute('aria-label')
    tick(STEP * 5)
    expect(screen.getByRole('region', { name: /Synthetic walk/ }).getAttribute('aria-label')).toBe(where)
  })

  it('names every control and keeps the step buttons where the keyboard handlers expect them', async () => {
    await open()
    const playback = screen.getByRole('group', { name: 'Playback' })
    expect(within(playback).getAllByRole('button').map(each => each.getAttribute('aria-label') ?? each.textContent)).toEqual(['Play', 'Restart', 'Previous step', 'Next step'])
    for (const each of within(playback).getAllByRole('button')) expect((each.getAttribute('aria-label') ?? each.textContent)!).toContain(each.textContent!)
    expect(within(screen.getByRole('group', { name: 'Walkthroughs' })).getAllByRole('button')).toHaveLength(1)
    expect(document.querySelector('[aria-labelledby="econ-map-caption"]')!.contains(playback)).toBe(false)
  })

  it('prints playback as a strip of signs, each over its word, with exact names and no boxed-key styling', async () => {
    await open()
    const playback = screen.getByRole('group', { name: 'Playback' })
    const cues = within(playback).getAllByRole('button')
    expect(cues).toHaveLength(4)
    for (const cue of cues) {
      /* One drawn sign, hidden from assistive technology, and one printed word that is, or is inside, the accessible name. */
      const signs = cue.querySelectorAll('svg')
      expect(signs).toHaveLength(1)
      expect(signs[0].closest('[aria-hidden="true"]')).not.toBeNull()
      expect(signs[0]).toHaveAttribute('focusable', 'false')
      expect(cue.textContent!.trim().length).toBeGreaterThan(3)
      expect(cue.className.split(/\s+/)).toContain(styles.cue)
      expect(cue.className.split(/\s+/)).not.toContain(styles.turn)
      expect(cue.className.split(/\s+/)).not.toContain(styles.key)
    }
    expect(cues.map(cue => cue.getAttribute('aria-label') ?? cue.textContent)).toEqual(['Play', 'Restart', 'Previous step', 'Next step'])
    expect(cues[0].className.split(/\s+/)).toContain(styles.cuePlay)
    expect(cues.filter(cue => cue.className.split(/\s+/).includes(styles.cuePlay))).toHaveLength(1)
    expect(cues[2]).toBeDisabled()
    expect(cues[3]).toBeEnabled()
    /* The sign changes with the state, as well as the word. */
    const drawn = () => cues[0].querySelector('svg path')!.getAttribute('d')
    const playSign = drawn()
    fireEvent.click(cues[0])
    expect(cues[0]).toHaveAccessibleName('Pause')
    expect(drawn()).not.toBe(playSign)
    expect(cues[0].className.split(/\s+/)).toContain(styles.cuePlaying)
    fireEvent.click(cues[0])
    expect(cues[0]).toHaveAccessibleName('Play')
    expect(drawn()).toBe(playSign)
    /* The four signs are four different drawings. */
    expect(new Set(cues.map(cue => cue.querySelector('svg')!.innerHTML)).size).toBe(4)
    /* The transport has its own rules: no keyline, no fill, so it cannot be mistaken for the path keys. */
    const css = readFileSync(join(process.cwd(), 'components', 'insights', 'commons-economy', 'CommonsEconomyMap.module.css'), 'utf8')
    const cueRule = css.match(/\n\.cue \{([^}]*)\}/)![1]
    expect(cueRule).toMatch(/border: 0;/)
    expect(cueRule).toMatch(/background: transparent;/)
    expect(cueRule).toMatch(/min-height: 44px;/)
  })

  it('drives the plate: each played step moves the marked stop and the marked route, and the caption with them', async () => {
    await open()
    const figure = document.querySelector('[aria-labelledby="econ-map-caption"]') as HTMLElement
    const marked = () => [...figure.querySelectorAll(`.${styles.nodeWalk}`)].map(el => el.textContent)
    expect(marked()).toHaveLength(1)
    expect(marked()[0]).toMatch(/^Synthetic local AOn the walk · step 1/)
    expect(figure.querySelector(`.${styles.routeNow}`)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    tick(STEP)
    expect(marked()).toHaveLength(1)
    expect(marked()[0]).toMatch(/^Synthetic local centreOn the walk · step 2/)
    expect(figure.querySelector(`.${styles.routeNow}`)!.textContent).toContain('Synthetic local centre')
    expect(within(at(2)!).getByRole('heading', { level: 2, name: 'Synthetic step two' })).toBeInTheDocument()
    expect(within(figure).getByRole('button', { name: /^Synthetic local A\s*Step 1/ })).toBeInTheDocument()
  })

  it('keeps who does what terse and folded, with the full account always in the document', async () => {
    await open()
    const section = screen.getByRole('heading', { level: 2, name: 'Who does what' }).closest('section')!
    const more = within(section).getByRole('button', { name: 'More detail' })
    const full = document.getElementById('econ-step-full')!
    expect(more).toHaveAttribute('aria-expanded', 'false')
    expect(more).toHaveAttribute('aria-controls', 'econ-step-full')
    expect(full.className.split(/\s+/)).toContain(styles.fullFolded)
    expect(full.hidden).toBe(false)
    expect(full.closest('[aria-hidden="true"], [inert]')).toBeNull()
    /* Terse row: one holder for each duty, and what is undecided still says so. */
    const brief = section.querySelector('dl')!
    expect(brief.querySelectorAll('dt')).toHaveLength(6)
    expect(within(brief as HTMLElement).getAllByText('Synthetic stamp T').length).toBeGreaterThan(0)
    expect(within(brief as HTMLElement).queryByText(/Synthetic who/)).toBeNull()
    /* Full account, folded or not: every duty, the correction line, the standing and where it is drawn from. */
    for (const who of ['Synthetic who 1', 'Synthetic who 2', 'Synthetic who 3', 'Synthetic who 4', 'Synthetic who 5', 'Synthetic undecided correction']) expect(within(full).getByText(who)).toBeInTheDocument()
    expect(within(full).getByRole('list', { name: 'What this step is and is not, in full' }).children.length).toBeGreaterThan(0)
    expect(within(full).getByText('Drawn from')).toBeInTheDocument()
    fireEvent.click(more)
    expect(more).toHaveAttribute('aria-expanded', 'true')
    expect(more).toHaveAccessibleName('Less detail')
    expect(full.className.split(/\s+/)).not.toContain(styles.fullFolded)
    fireEvent.keyDown(at(1)!, { key: 'End' })
    expect(within(full).getAllByText('Synthetic reviewer who corrects')).toHaveLength(2)
    expect(more).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('Commons Economy Map reduced motion', () => {
  const css = readFileSync(join(process.cwd(), 'components', 'insights', 'commons-economy', 'CommonsEconomyMap.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

  const mediaBlocks = (query: string) => {
    const blocks: string[] = []
    let from = 0
    for (;;) {
      const at = css.indexOf(`@media (${query})`, from)
      if (at < 0) return blocks
      const open = css.indexOf('{', at)
      let depth = 1
      let i = open + 1
      while (depth > 0) depth += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0, i++
      blocks.push(css.slice(open + 1, i - 1))
      from = i
    }
  }
  const rules = (body: string) => [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectors, declarations]) => ({
    selectors: selectors.split(',').map(each => each.trim()),
    declarations: declarations.replace(/\s+/g, ' ').trim(),
  }))

  it('stills every transition and animation on the map root and all descendants', () => {
    const blocks = mediaBlocks('prefers-reduced-motion: reduce')
    expect(blocks).toHaveLength(1)
    const stilled = rules(blocks[0]).find(rule => rule.selectors.includes('.root *'))
    expect(stilled).toBeDefined()
    expect(stilled!.selectors).toEqual(expect.arrayContaining(['.root', '.root *', '.root *::before', '.root *::after']))
    expect(stilled!.declarations).toContain('transition: none !important')
    expect(stilled!.declarations).toContain('animation: none !important')
  })

  it('never reaches outside the map root and keeps standard motion intact', () => {
    for (const block of mediaBlocks('prefers-reduced-motion: reduce')) {
      for (const rule of rules(block)) for (const selector of rule.selectors) expect(selector).toMatch(/^\.root(?![\w-])/)
    }
    const standard = css.replace(/@media[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
    expect(rules(standard).find(rule => rule.selectors.includes('.node'))?.declarations).toMatch(/transition: border-color \.2s ease, box-shadow \.2s ease/)
  })

  it('renders the map inside the root that carries the scoped reduced-motion contract', async () => {
    const { default: styles } = await import('./CommonsEconomyMap.module.css')
    render(<CommonsEconomyMap envelope={envelope} />)
    await screen.findByRole('heading', { level: 2, name: 'Synthetic local A' })
    const article = screen.getByRole('heading', { level: 1, name: 'Commons Economy Map' }).closest('article')!
    expect(styles.root).toBeTruthy()
    expect(article.className.split(/\s+/)).toContain(styles.root)
    for (const control of [...document.querySelectorAll('button, a')]) expect(article.contains(control)).toBe(true)
  })
})

describe('Commons Economy Map AmaduTown palette', () => {
  const css = readFileSync(join(process.cwd(), 'components', 'insights', 'commons-economy', 'CommonsEconomyMap.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const screen = css.slice(0, css.indexOf('@media print'))
  const brand: Record<string, [string, string]> = {
    '--at-navy': ['--imperial-navy', '#121E31'], '--at-gold': ['--radiant-gold', '#D4AF37'], '--at-slate': ['--silicon-slate', '#2C3E50'],
    '--at-platinum': ['--platinum-white', '#EAECEE'], '--at-bronze': ['--bronze', '#8B6914'], '--at-gold-light': ['--gold-light', '#F5D060'],
  }

  it('reads the six brand colours from the site tokens, with the canonical values as the only fallbacks', () => {
    for (const [name, [token, hex]] of Object.entries(brand)) expect(css).toContain(`${name}: var(${token}, ${hex});`)
    /* The same six values are what the site declares. */
    const site = [join(process.cwd(), 'app', 'globals.css'), join(process.cwd(), 'tailwind.config.ts')].filter(existsSync).map(file => readFileSync(file, 'utf8').toLowerCase())
    for (const text of site) for (const [, hex] of Object.values(brand)) expect(text).toContain(hex.toLowerCase())
  })

  it('uses no colour on screen that is not one of the six, a mix of them, or a system colour', () => {
    const allowed = new Set(Object.values(brand).map(([, hex]) => hex.toLowerCase()))
    for (const hex of screen.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) expect(allowed.has(hex.toLowerCase())).toBe(true)
    /* The only rgb() left on screen is the neutral cast shadow of the night edition. */
    expect(screen.match(/rgba?\([^)]*\)/g) ?? []).toEqual(['rgba(0, 0, 0, .45)'])
    for (const mix of screen.match(/color-mix\([^;]*\)/g) ?? []) expect(mix).toMatch(/^color-mix\(in srgb, var\(--at-[a-z-]+\) [\d.]+%, (var\(--at-[a-z-]+\)|transparent)\)$/)
    expect(css).not.toMatch(/ff4a1c|b8320d|ff7a4d|ff9a73|f4f3ec|171b1a/i)
  })

  it('keeps gold for the current block, always with navy type and a keyline, in both editions', () => {
    const block = (selector: string) => css.match(new RegExp(`${selector.replace(/[.()]/g, '\\$&')} \\{([^}]*)\\}`))![1]
    const day = block('.root'), night = block(':global(.dark) .root')
    expect(day).toMatch(/--paper: var\(--at-platinum\);/)
    expect(day).toMatch(/--ink: var\(--at-navy\);/)
    expect(night).toMatch(/--paper: var\(--at-navy\);/)
    expect(night).toMatch(/--ink: var\(--at-platinum\);/)
    for (const edition of [day, night]) {
      expect(edition).toMatch(/--signal-fill: var\(--at-gold\);/)
      expect(edition).toMatch(/--on-signal: var\(--at-navy\);/)
      expect(edition).toMatch(/--signal-edge: var\(--at-(navy|gold)\);/)
    }
    /* Gold is never type or a rule on the day paper: it would not be legible there. */
    expect(day).not.toMatch(/--(signal|signal-ink|ink|ink-soft|muted): var\(--at-gold(-light)?\)/)
    const current = css.match(/\n\.nodeWalk, \.entry_centre\.nodeWalk \{([^}]*)\}/)![1]
    expect(current).toMatch(/background: var\(--signal-fill\);/)
    expect(current).toMatch(/color: var\(--on-signal\);/)
    expect(current).toMatch(/border-color: var\(--signal-edge\);/)
    /* The photographs keep the Commons print filter and take no brand tint. */
    expect(css.match(/\n\.frame \{([^}]*)\}/)![1]).toMatch(/filter: grayscale\(\.9\) contrast\(1\.08\);/)
  })
})

describe('Commons Economy Map keyboard focus', () => {
  const css = readFileSync(join(process.cwd(), 'components', 'insights', 'commons-economy', 'CommonsEconomyMap.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const flat = css.replace(/@media[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
  const forced = css.match(/@media \(forced-colors: active\)\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/)?.[1] ?? ''
  const declared = (body: string, selector: string) => [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => selectors.split(',').map(each => each.trim()).includes(selector))
    .map(([, , declarations]) => declarations.replace(/\s+/g, ' ').trim())
    .join(' ')
  const outline = (declarations: string) => declarations.match(/outline:\s*([^;]+)/)?.[1].trim()

  describe('opening a node on a narrow sheet', () => {
    const scrollIntoView = Element.prototype.scrollIntoView
    beforeEach(() => { Element.prototype.scrollIntoView = vi.fn() })
    afterEach(() => { Element.prototype.scrollIntoView = scrollIntoView; vi.restoreAllMocks() })

    it.each([['Space', ' '], ['Enter', '{Enter}']])('moves focus to the opened detail immediately with %s under reduced motion', async (_, key) => {
      vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: query.includes('prefers-reduced-motion'), media: query }) as MediaQueryList)
      const frame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
      const user = userEvent.setup()
      render(<CommonsEconomyMap envelope={envelope} />)
      await screen.findByRole('heading', { level: 2, name: 'Synthetic local A' })
      const closed = document.querySelector<HTMLButtonElement>('[aria-labelledby="econ-map-caption"] button[aria-pressed="false"]')!
      const detail = document.getElementById('econ-detail-title')!
      let announced = ''
      detail.addEventListener('focus', () => { announced = detail.textContent ?? '' }, { once: true })
      closed.focus()
      await user.keyboard(key)
      expect(closed).toHaveAttribute('aria-pressed', 'true')
      expect(document.activeElement).toBe(detail)
      expect(announced).toBe(detail.textContent)
      expect(frame).not.toHaveBeenCalled()
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' })
      expect(screen.getByRole('region', { name: /Synthetic walk, step 1 of 2/ })).toBeInTheDocument()
    })

    it('keeps mouse activation on the existing smooth-scroll path', async () => {
      vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: false, media: query }) as MediaQueryList)
      let frame: FrameRequestCallback | undefined
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frame = callback; return 1 })
      const user = userEvent.setup()
      render(<CommonsEconomyMap envelope={envelope} />)
      await screen.findByRole('heading', { level: 2, name: 'Synthetic local A' })
      const closed = document.querySelector<HTMLButtonElement>('[aria-labelledby="econ-map-caption"] button[aria-pressed="false"]')!
      await user.click(closed)
      expect(closed).toHaveAttribute('aria-pressed', 'true')
      expect(frame).toBeDefined()
      expect(document.activeElement).toBe(closed)
      frame!(0)
      expect(document.activeElement).toBe(document.getElementById('econ-detail-title'))
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
      expect(screen.getByRole('region', { name: /Synthetic walk, step 1 of 2/ })).toBeInTheDocument()
    })
  })

  it('rules a focused entry in ink, a mark the open ring never uses', () => {
    const focused = outline(declared(flat, '.entry:focus-visible'))
    const open = outline(declared(flat, '.nodeOpen'))
    expect(focused).toBe('3px solid var(--ink)')
    expect(open).toBe('3px solid var(--signal)')
    expect(focused).not.toBe(open)
    expect(declared(flat, '.nodeOpen:focus-visible')).toMatch(/box-shadow:[^;]*var\(--signal\)/)
  })

  it('rules the clipping heading where narrow-sheet keyboard focus lands', () => {
    expect(outline(declared(flat, '.clippingTitle:focus-visible'))).toBe('3px solid var(--ink)')
    expect(css).not.toMatch(/\.(entry|clippingTitle|nodeOpen)[^{]*:focus(-visible)?[^{]*\{[^}]*outline:\s*(none|0)\b/)
  })

  it('keeps focus and open apart in forced colours', () => {
    expect(outline(declared(forced, '.entry:focus-visible'))).toBe('3px solid CanvasText')
    expect(outline(declared(forced, '.clippingTitle:focus-visible'))).toBe('3px solid CanvasText')
    expect(outline(declared(forced, '.nodeOpen:focus-visible'))).toMatch(/double Highlight/)
  })

  it('leaves focus on a visibly ruled element when a node is opened from the keyboard', async () => {
    const { default: styles } = await import('./CommonsEconomyMap.module.css')
    const user = userEvent.setup()
    render(<CommonsEconomyMap envelope={envelope} />)
    await screen.findByRole('heading', { level: 2, name: 'Synthetic local A' })
    const figure = document.querySelector('[aria-labelledby="econ-map-caption"]')!
    const closed = figure.querySelector<HTMLButtonElement>('button[aria-pressed="false"]')!
    closed.focus()
    await user.keyboard('{Enter}')
    const landed = document.activeElement as HTMLElement
    const classes = landed.className.split(/\s+/)
    expect(classes.includes(styles.entry) || classes.includes(styles.clippingTitle)).toBe(true)
  })
})
