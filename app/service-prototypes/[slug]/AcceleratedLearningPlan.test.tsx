import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AcceleratedLearningPlan, l01Media, l02Media, lessons } from './AcceleratedLearningPlan'
import { DECISION_FILE_STORAGE_KEY } from '@/lib/accelerated-decision-file'
import { GUEST_PROGRESS_KEY } from '@/lib/accelerated-member-progress'
import { lessonPosters } from '@/lib/accelerated-lesson-posters'

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({ supabase: { auth: {
  getSession: authMocks.getSession,
  onAuthStateChange: authMocks.onAuthStateChange,
} } }))

vi.mock('next/image', () => ({
  default: ({ unoptimized: _unoptimized, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ''} />
  ),
}))

describe('Accelerated learning plan', () => {
  beforeEach(() => {
    localStorage.removeItem(DECISION_FILE_STORAGE_KEY)
    localStorage.removeItem(GUEST_PROGRESS_KEY)
    authMocks.getSession.mockResolvedValue({ data: { session: null } })
    authMocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  })
  it('restores one local worksheet across lessons and requires review, redaction, and consent', async () => {
    localStorage.removeItem(DECISION_FILE_STORAGE_KEY)
    const view = render(<AcceleratedLearningPlan />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Your response to this lesson' }), { target: { value: 'Synthetic decision with private detail' } })
    fireEvent.click(screen.getByRole('button', { name: /L02: Prioritize before generating/ }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Your response to this lesson' }), { target: { value: 'Compare three safe options' } })
    await waitFor(() => expect(JSON.parse(localStorage.getItem(DECISION_FILE_STORAGE_KEY) || '{}').answers.L02).toBe('Compare three safe options'))
    view.unmount()
    render(<AcceleratedLearningPlan />)
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Your response to this lesson' })).toHaveValue('Compare three safe options'))
    fireEvent.click(screen.getByRole('button', { name: /L01: Build smarter, stay human/ }))
    expect(screen.getByRole('textbox', { name: 'Your response to this lesson' })).toHaveValue('Synthetic decision with private detail')
    fireEvent.click(screen.getByRole('button', { name: 'Review and send' }))
    const preview = screen.getByRole('region', { name: 'Review before sharing' })
    expect(within(preview).getByRole('button', { name: 'Send to AmaduTown' })).toBeDisabled()
    fireEvent.change(within(preview).getByRole('textbox', { name: 'Edit L01 before sharing' }), { target: { value: 'Synthetic decision; sensitive detail removed' } })
    expect(within(preview).getByRole('textbox', { name: 'Edit L01 before sharing' })).toHaveValue('Synthetic decision; sensitive detail removed')
    expect(screen.getByRole('textbox', { name: 'Your response to this lesson' })).toHaveValue('Synthetic decision; sensitive detail removed')
    localStorage.removeItem(DECISION_FILE_STORAGE_KEY)
  })
  it('requires confirmation before clearing every saved answer', async () => {
    localStorage.removeItem(DECISION_FILE_STORAGE_KEY)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<AcceleratedLearningPlan />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Your response to this lesson' }), { target: { value: 'Keep this decision' } })
    fireEvent.click(screen.getByRole('button', { name: 'Clear worksheet' }))
    expect(screen.getByRole('textbox', { name: 'Your response to this lesson' })).toHaveValue('Keep this decision')
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Clear worksheet' }))
    expect(screen.getByRole('textbox', { name: 'Your response to this lesson' })).toHaveValue('')
    expect(screen.getByRole('status')).toHaveTextContent('The local worksheet has been cleared.')
    confirm.mockRestore()
    await waitFor(() => expect(JSON.parse(localStorage.getItem(DECISION_FILE_STORAGE_KEY) || '{}').answers).toEqual({}))
    localStorage.removeItem(DECISION_FILE_STORAGE_KEY)
  })
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
      expect(contrast(token(block, 'primary-action-text'), token(block, 'primary-action'))).toBeGreaterThanOrEqual(4.5)
    }
    expect(css).toContain('.plan .catalogTools .filters button:focus-visible')
    expect(css).toContain('.plan .catalogTools .filters button:hover:not(:disabled)')
    expect(css).toContain('.plan .mediaNotice button:not(:disabled)')
    expect(css).toContain('.plan .actions button:not(.secondary):not(:disabled)')
    expect(css).toContain('.plan .worksheetActions .primaryAction:not(:disabled)')
    expect(css).toContain('.worksheetActions button{')
    expect(css).toContain('background:var(--lp-primary-action);')
    expect(css).toContain('background-image:none;')
    expect(css).toContain('box-shadow:none;')
    expect(css).toContain('.state[data-state=complete],.detailState[data-state=complete]')
    expect(css).toContain('border-radius:999px')
    expect(css).toContain('.catalog[data-collapsed=true]')
    expect(css).toContain('.iconAction::after,.catalogToggle::after')
    expect(css).toContain('.detail>.player,.detail>.mediaNotice{grid-row:4}')
    expect(css).toContain('.detail>.worksheet{grid-row:5}')
    expect(css).toContain('.detail>.worksheet{grid-column:2;grid-row:4/span 3}')
  })

  it('renders the Decision File as a complete standalone workbook with flat scoped actions', () => {
    render(<AcceleratedLearningPlan mode="decision-file" />)
    expect(screen.getByRole('heading', { name: 'The Accelerated Decision File' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Decision File pages started' })).toHaveAttribute('value', '0')
    expect(screen.getAllByPlaceholderText('Add your working notes')).toHaveLength(16)
    expect(screen.getByRole('link', { name: 'Back to the Learning Plan' })).toHaveAttribute('href', '/accelerated/learningplan')
    expect(screen.getByRole('button', { name: 'Review and send' }).className).toContain('primaryAction')
    expect(screen.getByRole('button', { name: 'Clear worksheet' }).className).toContain('dangerAction')
    fireEvent.change(screen.getByLabelText(/Decision-file cover sheet and data-use boundary/), { target: { value: 'One bounded decision' } })
    expect(screen.getByRole('progressbar', { name: 'Decision File pages started' })).toHaveAttribute('value', '1')
  })

  it('uses compact accessible action controls and a collapsible lesson rail', () => {
    render(<AcceleratedLearningPlan />)
    const save = screen.getByRole('button', { name: 'Save on this device' })
    const review = screen.getByRole('button', { name: 'Review and send' })
    const complete = screen.getByRole('button', { name: 'Mark lesson complete' })
    const next = screen.getByRole('button', { name: 'Next lesson · L02' })
    for (const control of [save, review, complete, next]) {
      expect(control.className).toContain('iconAction')
      expect(control).toHaveAttribute('data-tooltip')
    }
    const toggle = screen.getByRole('button', { name: 'Expand lesson navigation' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Collapse lesson navigation' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /L02: Prioritize before generating/ }).querySelector('[data-state="ready"]')).toHaveTextContent('Ready')
  })

  it('loads a signed-in worksheet from the member profile and keeps assessment use consented', async () => {
    const worksheetId = '12345678-1234-4234-8234-123456789abc'
    authMocks.getSession.mockResolvedValue({ data: { session: {
      access_token: 'member-token',
      user: { id: 'member-1', email: 'member@example.com', user_metadata: { full_name: 'Synthetic Member' } },
    } } })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        enrollment: { revision: 2, current_lesson_id: 'L03' },
        lessons: [],
        worksheet: { worksheet_id: worksheetId, answers: { L03: 'Profile-bound decision' }, updated_at: '2026-11-05T12:00:00Z' },
      }) })
      .mockResolvedValue({ ok: true, json: async () => ({ revision: 3, replay: false }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<AcceleratedLearningPlan />)
    await waitFor(() => expect(screen.getByText('Saved to your AmaduTown profile')).toBeInTheDocument())
    expect(screen.getByRole('textbox', { name: 'Your response to this lesson' })).toHaveValue('Profile-bound decision')
    expect(screen.getByRole('button', { name: 'Save to profile' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Review for assessment' }))
    const review = screen.getByRole('region', { name: 'Review before sharing' })
    expect(review).toHaveTextContent('bound to your assessment intake')
    expect(within(review).getByLabelText('Name')).toHaveValue('Synthetic Member')
    expect(within(review).getByLabelText('Email')).toHaveValue('member@example.com')
    expect(within(review).getByRole('button', { name: 'Send for assessment review' })).toBeDisabled()
    vi.unstubAllGlobals()
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

  it('shows a learner brief, playable lessons, storyboard, and truthful preview progress', () => {
    render(<AcceleratedLearningPlan />)
    expect(screen.getByRole('heading', { name: 'Sixteen lessons. One decision file.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /L01: Build smarter, stay human/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /L09: Map the decision theater/ }).querySelector('[data-state]')).toHaveAttribute('data-state', 'ready')
    expect(screen.getByLabelText('L01 Build smarter, stay human guided video')).toHaveAttribute('controls')
    expect(document.querySelector('video source')).toHaveAttribute('src', l01Media.video)
    expect(screen.getByLabelText('L01 Build smarter, stay human guided video')).toHaveAttribute('poster', lessonPosters.L01)
    expect(document.querySelector('video track')).toHaveAttribute('src', l01Media.captions)
    expect(screen.getByRole('button', { name: 'English captions on' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByText('Read along with L01 transcript'))
    expect(screen.getByText('The document is open. At the top it says, Q3 Innovation Plan.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /L05: From feedback to signal/ }))
    expect(screen.getByText('Code six synthetic comments, name one pattern, and flag what contradicts it.')).toBeInTheDocument()
    expect(screen.getByAltText('Representative storyboard frame for L05')).toBeInTheDocument()
    expect(screen.getByLabelText('L05 From feedback to signal guided video')).toHaveAttribute('controls')
    for (const item of lessons.filter((lesson) => Number(lesson.id.slice(1)) >= 9)) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${item.id}:`) }))
      expect(screen.getByLabelText(`${item.id} ${item.title} guided video`)).toHaveAttribute('controls')
    }
    expect(screen.queryByText(/production packet|source hash|provider instruction/i)).not.toBeInTheDocument()
  })

  it('opens every lesson player with its approved cover and media', () => {
    render(<AcceleratedLearningPlan />)
    for (const item of lessons) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${item.id}:`) }))
      const video = screen.getByLabelText(`${item.id} ${item.title} guided video`)
      expect(video).toHaveAttribute('poster', lessonPosters[item.id as keyof typeof lessonPosters])
      expect(video).toHaveAttribute('aria-description', expect.stringContaining(`${item.id} ${item.title} cover`))
      expect(video).toHaveAttribute('preload', 'metadata')
      expect(video).toHaveAttribute('controls')
      expect(video.querySelector('source')).toHaveAttribute('src', expect.stringContaining(`/lessons/${item.id.toLowerCase()}/`))
      expect(video.querySelector('track')).toHaveAttribute('src', expect.stringContaining(`/lessons/${item.id.toLowerCase()}/`))
    }
  })

  it('reveals video once during playback and restores the poster after the player resets', () => {
    render(<AcceleratedLearningPlan />)
    const video = screen.getByLabelText('L01 Build smarter, stay human guided video')
    expect(video.className).not.toContain('videoReveal')
    expect(video.parentElement).toHaveStyle({ backgroundImage: `url(${lessonPosters.L01})` })
    fireEvent.playing(video)
    expect(video.className).toContain('videoReveal')
    fireEvent.pause(video)
    fireEvent.playing(video)
    expect(video.className).toContain('videoReveal')
    fireEvent.emptied(video)
    expect(video.className).not.toContain('videoReveal')
    fireEvent.click(screen.getByRole('button', { name: /L02: Prioritize before generating/ }))
    fireEvent.click(screen.getByRole('button', { name: /L01: Build smarter, stay human/ }))
    expect(screen.getByLabelText('L01 Build smarter, stay human guided video').className).not.toContain('videoReveal')
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

  it('switches directly from the open L01 player to exact L02 and L03 media', () => {
    render(<AcceleratedLearningPlan />)
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
    expect(screen.getByLabelText('L02 Prioritize before generating guided video')).toHaveAttribute('controls')
    expect(document.querySelector('video source')).toHaveAttribute('src', l02Media.video)
    expect(screen.getByLabelText('L02 Prioritize before generating guided video')).toHaveAttribute('poster', lessonPosters.L02)
    expect(document.querySelector('video track')).toHaveAttribute('src', l02Media.captions)
    fireEvent.click(screen.getByRole('button', { name: /L03: Answer-driven discovery, ready/ }))
    expect(screen.getByLabelText('L03 Answer-driven discovery guided video')).toHaveAttribute('controls')
  })
})
