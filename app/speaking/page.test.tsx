import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { agentifiedPublication } from '@/lib/agentified-publication'
import SpeakingPage from './page'

// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ fill, priority, ...props }: Record<string, unknown>) => <img {...props} alt={String(props.alt || '')} /> }))
vi.mock('next/link', () => ({ default: (props: { href: string; children: React.ReactNode; className?: string }) => <a {...props}>{props.children}</a> }))

describe('speaking page', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows all three authored works with the canonical Agentified cover', () => {
    render(<SpeakingPage />)

    expect(screen.getByText('The Equity Code', { selector: 'figcaption' })).toBeInTheDocument()
    expect(screen.getByText('Accelerated', { selector: 'figcaption' })).toBeInTheDocument()
    expect(screen.getByText(agentifiedPublication.title, { selector: 'figcaption' })).toBeInTheDocument()
    expect(screen.getByAltText(`Cover of ${agentifiedPublication.title}`)).toHaveAttribute('src', agentifiedPublication.coverImage)
  })

  it('keeps the brief local, handles incomplete input, and routes a complete fit to the catalog service', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    render(<SpeakingPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Build my brief' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Choose one answer in each section')
    expect(screen.queryByRole('region', { name: 'Your speaker fit brief' })).not.toBeInTheDocument()

    for (const name of [
      'Community & nonprofit leaders',
      'A practical first move',
      'Fireside conversation',
      'Systems that reduce burden',
    ]) fireEvent.click(screen.getByRole('radio', { name }))

    fireEvent.click(screen.getByRole('button', { name: 'Build my brief' }))
    const result = screen.getByRole('region', { name: 'Your speaker fit brief' })
    expect(result).toHaveTextContent('Make the work lighter for the people doing it.')
    expect(result.querySelector('ul li')).toHaveTextContent('Name the decision')
    expect(result.querySelector('a')).toHaveAttribute('href', '/services/a278e803-9328-490b-bf57-8fbee7d129ee?speakerAudience=community&speakerOutcome=action&speakerFormat=fireside&speakerTopic=burden')
    expect(fetchSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Clear choices' }))
    expect(screen.queryByRole('region', { name: 'Your speaker fit brief' })).not.toBeInTheDocument()
    expect(screen.queryAllByRole('radio', { checked: true })).toHaveLength(0)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
