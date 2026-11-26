import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
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
    expect(pressed('Synthetic local layer P')).toBe('true')
    expect(pressed('Synthetic local layer T')).toBe('false')
    expect(pressed('Synthetic local flow F')).toBe('false')
    expect(within(screen.getByRole('list', { name: 'What is and is not real on this map' })).getByText('Synthetic page stamp')).toBeInTheDocument()
    expect(screen.queryByText('Synthetic local old')).not.toBeInTheDocument()
  })

  it('follows altitude, label, layer and flow toggles', async () => {
    render(<CommonsEconomyMap envelope={envelope} />)
    await screen.findByRole('heading', { level: 2, name: 'Synthetic local A' })
    fireEvent.click(screen.getByRole('button', { name: 'Synthetic altitude household' }))
    expect(screen.getByText('Synthetic caption A household')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Synthetic mode book' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Synthetic book A' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Synthetic book layer T' }))
    expect(screen.getByText('Synthetic pending line')).toBeInTheDocument()
    expect(screen.getByText('Synthetic book old').closest('button')).toBeNull()
    expect(screen.queryAllByText('Synthetic book funding edge')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Synthetic book flow F' }))
    expect(screen.getAllByText('Synthetic book funding edge').length).toBeGreaterThan(0)
  })

  it('walks step by step with buttons and arrow keys, including the derived correction line', async () => {
    render(<CommonsEconomyMap envelope={envelope} />)
    await screen.findByRole('heading', { level: 2, name: 'Synthetic local A' })
    fireEvent.click(screen.getByRole('button', { name: 'Synthetic walk' }))
    const region = screen.getByRole('region', { name: /Synthetic walk, step 1 of 2/ })
    expect(within(region).getByText('Synthetic undecided correction')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous step' })).toBeDisabled()
    fireEvent.keyDown(region, { key: 'ArrowRight' })
    const next = screen.getByRole('region', { name: /step 2 of 2/ })
    expect(within(next).getByRole('heading', { name: 'Synthetic step two' })).toBeInTheDocument()
    expect(within(next).getAllByText('Synthetic reviewer who corrects')).toHaveLength(2)
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
  ])('opens the exact focused closed node with %s after label and altitude changes', async (_name, keys) => {
    const user = userEvent.setup()
    render(<CommonsEconomyMap envelope={envelope} />)
    await screen.findByRole('heading', { level: 2, name: 'Synthetic local A' })
    await user.click(screen.getByRole('button', { name: 'Synthetic mode book' }))
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

  it('opens a node from the keyboard and shows the empty state when every layer is off', async () => {
    render(<CommonsEconomyMap envelope={envelope} />)
    await screen.findByRole('heading', { level: 2, name: 'Synthetic local A' })
    const centre = screen.getByRole('button', { name: /^Synthetic local centre/ })
    centre.focus()
    fireEvent.click(centre)
    expect(centre).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { level: 2, name: 'Synthetic local centre' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Synthetic local layer P' }))
    fireEvent.click(screen.getByRole('button', { name: 'Synthetic local layer R' }))
    expect(screen.getByText(/Every layer is off/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'No node selected' })).toBeInTheDocument()
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
