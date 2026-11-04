import { fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { AcceleratedLearningPlan, l01Media, l02Media, lessons } from './AcceleratedLearningPlan'

vi.mock('next/image', () => ({
  default: ({ unoptimized: _unoptimized, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ''} />
  ),
}))

describe('Accelerated learning plan', () => {
  it('keeps state and filter colors readable in both themes', () => {
    const css = readFileSync('app/service-prototypes/[slug]/learning-plan.module.css', 'utf8')
    const blocks = [...css.matchAll(/(?:^|\n)(:global\(html\.dark\) )?\.plan\{([^}]+)\}/g)]
    const light = blocks.find((match) => !match[1] && match[2].includes('--lp-ready'))?.[2]
    const dark = blocks.find((match) => match[1] && match[2].includes('--lp-ready'))?.[2]
    expect(light).toBeTruthy()
    expect(dark).toBeTruthy()
    const token = (block: string, name: string) => block.match(new RegExp(`--lp-${name}:(#[0-9a-f]{6})`, 'i'))?.[1] ?? ''
    const luminance = (hex: string) => {
      const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
      const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
    }
    const contrast = (foreground: string, background: string) => {
      const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
      return (values[0] + 0.05) / (values[1] + 0.05)
    }
    for (const [block, surface] of [[light!, '#ffffff'], [dark!, '#1b2a3f']] as const) {
      for (const name of ['ready', 'current', 'complete', 'filter-text']) {
        expect(contrast(token(block, name), surface), `${name} on ${surface}`).toBeGreaterThanOrEqual(4.5)
      }
      expect(contrast(token(block, 'filter-selected-text'), token(block, 'filter-selected'))).toBeGreaterThanOrEqual(4.5)
    }
    expect(css).toContain('.plan .catalogTools .filters button:focus-visible')
    expect(css).toContain('.plan .catalogTools .filters button:hover:not(:disabled)')
    expect(css).toContain('.state[data-state=complete],.detailState[data-state=complete]')
  })

  it('keeps all approved lesson identities, order, durations, and four acts', () => {
    expect(lessons.map(({ id }) => id)).toEqual(Array.from({ length: 16 }, (_, index) => `L${String(index + 1).padStart(2, '0')}`))
    expect(lessons.reduce((total, lesson) => total + lesson.minutes, 0)).toBe(161)
    expect([...new Set(lessons.map(({ act }) => act))]).toEqual(['Signals', 'Alignment', 'Momentum', 'Synthesis'])
  })

  it('preserves L01 approved composite and captions byte-for-byte', () => {
    const asset = (url: string) => readFileSync(`public${url}`)
    expect(createHash('sha256').update(asset(l01Media.video)).digest('hex')).toBe('ee09bf72887ca7507229b86f89c4b81b21ba4f97f3290b3451ca704506e7991a')
    expect(createHash('sha256').update(asset(l01Media.captions)).digest('hex')).toBe('ceb998e79c84eb564548d155602a83b7cc1725d5b764a723ab6cd931b093184f')
    expect(asset(l01Media.captions).toString().match(/-->/g)).toHaveLength(84)
    expect(l01Media.duration).toBe('09:00')
  })

  it('shows a learner brief, playable L01, L05 ready, later locks, storyboard, and truthful preview progress', () => {
    render(<AcceleratedLearningPlan />)
    expect(screen.getByRole('heading', { name: 'Sixteen lessons. One decision file.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /L01: Build smarter, stay human/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /L09: Map the decision theater/ }).querySelector('[data-state]')).toHaveAttribute('data-state', 'locked')
    fireEvent.click(screen.getByRole('button', { name: /Watch L01 guided video/ }))
    expect(screen.getByLabelText('L01 Build smarter, stay human guided video')).toHaveAttribute('controls')
    expect(document.querySelector('video source')).toHaveAttribute('src', l01Media.video)
    expect(document.querySelector('video track')).toHaveAttribute('src', l01Media.captions)
    expect(screen.getByRole('button', { name: 'English captions on' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByText('Read along with L01 transcript'))
    expect(screen.getByText('The document is open. At the top it says, Q3 Innovation Plan.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Return to Learning plan/ }))
    expect(screen.queryByLabelText('L01 Build smarter, stay human guided video')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /L05: From feedback to signal/ }))
    expect(screen.getByText('Code six synthetic comments, name one pattern, and flag what contradicts it.')).toBeInTheDocument()
    expect(screen.getByAltText('Representative storyboard frame for L05')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Watch L05 guided video/ })).toBeEnabled()
    for (const item of lessons.filter((lesson) => Number(lesson.id.slice(1)) >= 9)) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${item.id}:`) }))
      expect(screen.getByRole('button', { name: new RegExp(`Watch ${item.id} guided video`) })).toBeDisabled()
    }
    expect(screen.queryByText(/production packet|source hash|provider instruction/i)).not.toBeInTheDocument()
  })

  it('handles filtering, empty results, completion, reversal, and next navigation', () => {
    render(<AcceleratedLearningPlan />)
    fireEvent.click(screen.getByRole('button', { name: 'Synthesis' }))
    expect(screen.getByRole('button', { name: 'Synthesis' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByRole('region', { name: 'Synthesis lessons' })).getAllByRole('button')).toHaveLength(2)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a lesson' }), { target: { value: 'unlikely phrase' } })
    expect(screen.getByText('No lessons found.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show all lessons' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mark lesson complete' }))
    expect(screen.getByRole('progressbar', { name: 'Lessons complete' })).toHaveAttribute('value', '1')
    expect(screen.getByRole('button', { name: /L01: Build smarter, stay human/ })).toHaveTextContent('Complete')
    expect(screen.getByRole('button', { name: /L01: Build smarter, stay human/ }).querySelector('[data-state]')).toHaveAttribute('data-state', 'complete')
    expect(screen.getByRole('button', { name: /L02: Prioritize before generating/ }).querySelector('[data-state]')).toHaveAttribute('data-state', 'current')
    fireEvent.click(screen.getByRole('button', { name: 'Mark as incomplete' }))
    expect(screen.getByRole('progressbar', { name: 'Lessons complete' })).toHaveAttribute('value', '0')
    fireEvent.click(screen.getByRole('button', { name: 'Next lesson · L02' }))
    expect(screen.getByRole('heading', { name: 'Prioritize before generating' })).toBeInTheDocument()
  })

  it('searches identity, title, and summary, and ignores exercise-only words', () => {
    render(<AcceleratedLearningPlan />)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a lesson' }), { target: { value: '  ThEaTeR  ' } })
    expect(screen.getByRole('button', { name: /L09: Map the decision theater/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /L01: Build smarter, stay human/ })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a lesson' }), { target: { value: 'counterexample' } })
    expect(screen.getByRole('button', { name: /L05: From feedback to signal/ })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a lesson' }), { target: { value: 'synthetic' } })
    expect(screen.getByRole('button', { name: /L12: Jobs and synthetic signals/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /L05: From feedback to signal/ })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a lesson' }), { target: { value: 'falsifiable' } })
    expect(screen.getByText('No lessons found.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Signals' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show all lessons' }))
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('searchbox', { name: 'Find a lesson' })).toHaveValue('')
    expect(screen.getByRole('button', { name: /L01: Build smarter, stay human/ })).toBeInTheDocument()
  })

  it('keeps current on the first incomplete lesson and clears a filter when moving ahead', () => {
    render(<AcceleratedLearningPlan />)
    fireEvent.click(screen.getByRole('button', { name: /L02: Prioritize before generating/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Mark lesson complete' }))
    expect(screen.getByRole('progressbar', { name: 'Lessons complete' })).toHaveAttribute('value', '1')
    expect(screen.getByRole('button', { name: /L01: Build smarter, stay human/ }).querySelector('[data-state]')).toHaveAttribute('data-state', 'current')
    expect(screen.getByRole('button', { name: /L02: Prioritize before generating/ }).querySelector('[data-state]')).toHaveAttribute('data-state', 'complete')
    fireEvent.click(screen.getByRole('button', { name: 'Signals' }))
    fireEvent.click(screen.getByRole('button', { name: /L04: Build small; keep personas alive/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Next lesson · L05' }))
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'From feedback to signal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /L05: From feedback to signal/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /L16: What comes next/ }))
    expect(screen.queryByRole('button', { name: /Next lesson/ })).not.toBeInTheDocument()
  })

  it('closes the L01 player when L02 is selected and opens exact L02 media', () => {
    render(<AcceleratedLearningPlan />)
    fireEvent.click(screen.getByRole('button', { name: /Watch L01 guided video/ }))
    const video = screen.getByLabelText('L01 Build smarter, stay human guided video')
    const track = { mode: 'hidden' }
    Object.defineProperty(video, 'textTracks', { configurable: true, value: [track] })
    fireEvent.loadedMetadata(video)
    expect(track.mode).toBe('showing')
    fireEvent.click(screen.getByRole('button', { name: 'English captions on' }))
    expect(track.mode).toBe('disabled')
    expect(screen.getByRole('button', { name: 'English captions off' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: /L02: Prioritize before generating/ }))
    expect(screen.queryByLabelText('L01 Build smarter, stay human guided video')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Watch L02 guided video/ }))
    expect(screen.getByLabelText('L02 Prioritize before generating guided video')).toHaveAttribute('controls')
    expect(document.querySelector('video source')).toHaveAttribute('src', l02Media.video)
    expect(document.querySelector('video track')).toHaveAttribute('src', l02Media.captions)
    fireEvent.click(screen.getByRole('button', { name: /L03: Answer-driven discovery, ready/ }))
    expect(screen.getByRole('button', { name: /Watch L03 guided video/ })).toBeEnabled()
  })
})
