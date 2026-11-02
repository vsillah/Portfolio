import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { agentifiedPublication } from '@/lib/agentified-publication'
import SpeakingPage from './page'

// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ fill, priority, ...props }: Record<string, unknown>) => <img {...props} alt={String(props.alt || '')} /> }))
vi.mock('next/link', () => ({ default: (props: { href: string; children: React.ReactNode; className?: string }) => <a {...props}>{props.children}</a> }))

describe('speaking page', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows sourced publication details and only verified Amazon actions', () => {
    render(<SpeakingPage />)

    const equity = within(screen.getByAltText('Cover of The Equity Code').closest('figure')!)
    expect(equity.getByText('The Equity Code')).toBeInTheDocument()
    expect(equity.getByText(/five barriers to digital opportunity/)).toBeInTheDocument()
    expect(equity.getByRole('link', { name: 'View The Equity Code on Amazon (opens in a new tab)' })).toHaveAttribute('href', 'https://www.amazon.com/dp/B0G3J98KY8')

    const accelerated = within(screen.getByAltText('Cover of Accelerated').closest('figure')!)
    expect(accelerated.getByText('Accelerated')).toBeInTheDocument()
    expect(accelerated.getByText(/building smarter products with AI/)).toBeInTheDocument()
    expect(accelerated.getByRole('link', { name: 'View Accelerated on Amazon (opens in a new tab)' })).toHaveAttribute('href', 'https://www.amazon.com/Accelerated-Building-Smarter-Products-AI/dp/B0GQPK27TH')

    const agentified = within(screen.getByAltText(`Cover of ${agentifiedPublication.title}`).closest('figure')!)
    expect(agentified.getByText(agentifiedPublication.title)).toBeInTheDocument()
    expect(agentified.getByText(agentifiedPublication.description)).toBeInTheDocument()
    expect(screen.getByAltText(`Cover of ${agentifiedPublication.title}`)).toHaveAttribute('src', agentifiedPublication.coverImage)
    expect(agentified.getByRole('link', { name: `View ${agentifiedPublication.title} on Amazon (opens in a new tab)` })).toHaveAttribute('href', agentifiedPublication.amazonPaperbackUrl)

    for (const link of screen.getAllByRole('link', { name: /opens in a new tab/ })) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
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
