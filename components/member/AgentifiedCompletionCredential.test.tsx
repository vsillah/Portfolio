import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import AgentifiedCompletionCredential from './AgentifiedCompletionCredential'
import { agentifiedCertificateSvg, certificateRecordId } from './agentified-certificate-artwork'
import { COURSE_CERTIFICATE_FRAME } from './course-certificate-template'
import { AGENTIFIED_SHARE_LINKS, AGENTIFIED_SHARE_MESSAGE, AGENTIFIED_SHARE_TEXT, AGENTIFIED_SHARE_URL, AGENTIFIED_X_TEXT } from './agentified-certificate-share'

const demoDate = '2026-11-05T12:00:00.000Z'
const { getSession } = vi.hoisted(() => ({ getSession: vi.fn(async () => ({ data: { session: null as null | { access_token: string } } })) }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession } } }))

beforeEach(() => { window.history.pushState({}, '', '/member/dashboard?qa=agentified-credential'); getSession.mockResolvedValue({ data: { session: null } }); Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); window.history.pushState({}, '', '/') })

describe('Agentified certificate', () => {
  it('previews the named certificate and claims with the existing preview path', async () => {
    render(<AgentifiedCompletionCredential profileName="Course Learner" preview />)
    const preview = await screen.findByRole('img', { name: 'Unclaimed Agentified completion certificate preview' })
    expect(preview).toHaveTextContent(/certificate of completion/i)
    expect(preview).toHaveTextContent('Course Learner')
    expect(preview).toHaveTextContent('AGENTIFIED')
    fireEvent.change(screen.getByRole('textbox', { name: 'Name on certificate' }), { target: { value: 'Amina Example' } })
    fireEvent.click(screen.getByRole('button', { name: 'Claim certificate' }))
    await waitFor(() => expect(screen.getByRole('img', { name: 'Claimed Agentified completion certificate for Amina Example' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Download certificate' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /copy message|retry copying/i })).not.toBeInTheDocument()
    expect(screen.getAllByText(/AT-AGT-[0-9A-F]{16}/)).toHaveLength(2)
  })

  it('blocks claiming before all lessons and links to the learning plan', async () => {
    window.history.pushState({}, '', '/member/dashboard?qa=agentified-credential&certificate=blocked')
    render(<AgentifiedCompletionCredential profileName="Course Learner" preview />)
    await screen.findByText('15 / 16 lessons')
    expect(screen.queryByRole('button', { name: 'Claim certificate' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Share your achievement')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue lessons' })).toHaveAttribute('href', '/agentified/learningplan')
  })

  it('shows claimed, verified, revoked, and long-name synthetic states without live links', async () => {
    for (const scene of ['claimed', 'verified', 'revoked', 'long-name']) {
      window.history.pushState({}, '', `/member/dashboard?qa=agentified-credential&certificate=${scene}`)
      const view = render(<AgentifiedCompletionCredential preview />)
      const image = await screen.findByRole('img', { name: /Claimed Agentified completion certificate/ })
      expect(image).toHaveTextContent(scene === 'verified' ? 'Active · AT-AGT-' : 'Verification link off')
      expect(screen.queryByRole('link', { name: 'View verification' })).not.toBeInTheDocument()
      expect(screen.getByLabelText('Share your achievement')).toBeInTheDocument()
      view.unmount()
    }
  })

  it('updates preview verification state without touching the credential API', async () => {
    window.history.pushState({}, '', '/member/dashboard?qa=agentified-credential&certificate=claimed')
    render(<AgentifiedCompletionCredential preview />)
    await screen.findByRole('button', { name: 'Create verification link' })
    fireEvent.click(screen.getByRole('button', { name: 'Create verification link' }))
    expect(screen.getByRole('img', { name: /Claimed Agentified completion certificate/ })).toHaveTextContent('Active · AT-AGT-')
    fireEvent.click(screen.getByRole('button', { name: 'Turn off verification link' }))
    expect(screen.getByRole('img', { name: /Claimed Agentified completion certificate/ })).toHaveTextContent('Verification link off')
  })

  it('keeps token and markup out of the vector artifact', () => {
    const credential = { learner_name: '<Amina & Team>', completed_at: '2026-11-05T12:00:00.000Z', verification_token: 'f'.repeat(64) }
    const svg = agentifiedCertificateSvg(credential, '')
    expect(svg).toContain('&lt;Amina &amp; Team&gt;')
    expect(svg).not.toContain(credential.verification_token)
    expect(svg).toContain('width="1424" height="1104"')
    expect(svg).toContain(`href="${COURSE_CERTIFICATE_FRAME}"`)
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"')
    expect(certificateRecordId(credential)).toEqual(certificateRecordId({ ...credential, verification_token: null }))
    expect(svg).toContain('CREDENTIAL RECORD ID')
    expect(svg).toContain('VERIFICATION REFERENCE')
  })

  it('keeps the end of a long learner name visible in the framed artwork', () => {
    const learner = 'Alexandria Nia Okafor-Washington Mensah-Diop Adeyemi Johnson-McKenzie Rivera Marie Adedayo Nwosu Zeta'
    const svg = agentifiedCertificateSvg({ learner_name: learner, completed_at: demoDate, verification_token: null }, '')
    expect(svg).toContain('Zeta')
    expect(svg.match(/<text x="712" y="(486|523|560|597)"/g)?.length).toBe(4)
  })

  it('copies the existing verified link for an authenticated synthetic credential', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'synthetic-access' } } })
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ available: true, eligible: true, completedCount: 16, credential: { learner_name: 'Course Learner', completed_at: demoDate, verification_token: 'f'.repeat(64), revision: 1 } }), { status: 200 }))
    render(<AgentifiedCompletionCredential />)
    fireEvent.click(await screen.findByRole('button', { name: 'Copy verification link' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/agentified/verify/${'f'.repeat(64)}`))
  })

  it('keeps share actions gated and uses only public course copy and URL', async () => {
    render(<AgentifiedCompletionCredential profileName="Course Learner" preview />)
    await screen.findByRole('button', { name: 'Claim certificate' })
    expect(screen.queryByLabelText('Share your achievement')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Claim certificate' }))
    expect(screen.getByLabelText('Share your achievement')).toBeInTheDocument()
    expect(AGENTIFIED_SHARE_MESSAGE).toBe(`${AGENTIFIED_SHARE_TEXT} ${AGENTIFIED_SHARE_URL}`)
    expect(AGENTIFIED_SHARE_MESSAGE).not.toMatch(/Course Learner|AT-AGT|verify|f{64}|Operating File answers/i)
    for (const [platform, href] of Object.entries(AGENTIFIED_SHARE_LINKS)) {
      const label = platform === 'x' ? 'X' : platform === 'linkedin' ? 'LinkedIn' : 'Facebook'
      const link = screen.getByRole('link', { name: `Share on ${label}` })
      expect(link).toHaveAttribute('href', href)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      expect(link).toHaveAttribute('title', `Share on ${label} (opens a new tab)`)
      expect(link).toHaveAttribute('data-tooltip', `Share on ${label}`)
      expect(link.textContent).toBe('')
      expect(link.querySelector('svg[aria-hidden="true"] path')).toBeInTheDocument()
      expect(href).not.toMatch(/Course%20Learner|AT-AGT|verify|f{64}/i)
    }
    expect(new URL(AGENTIFIED_SHARE_LINKS.linkedin).searchParams.get('url')).toBe(AGENTIFIED_SHARE_URL)
    expect(new URL(AGENTIFIED_SHARE_LINKS.facebook).searchParams.get('u')).toBe(AGENTIFIED_SHARE_URL)
    const x = new URL(AGENTIFIED_SHARE_LINKS.x)
    expect(x.searchParams.get('url')).toBe(AGENTIFIED_SHARE_URL)
    expect(x.searchParams.get('text')).toBe(AGENTIFIED_X_TEXT)
    expect(AGENTIFIED_X_TEXT.length).toBeLessThan(256)
  })

  it('shares natively only on user action and reports cancellation', async () => {
    const share = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new DOMException('Canceled', 'AbortError'))
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
    window.history.pushState({}, '', '/member/dashboard?qa=agentified-credential&certificate=claimed')
    render(<AgentifiedCompletionCredential preview />)
    const button = await screen.findByRole('button', { name: 'Share achievement' })
    expect(share).not.toHaveBeenCalled()
    fireEvent.click(button)
    await waitFor(() => expect(share).toHaveBeenCalledWith({ title: 'Agentified workshop completion', text: AGENTIFIED_SHARE_TEXT, url: AGENTIFIED_SHARE_URL }))
    expect(await screen.findByText(/Share handoff completed/)).toBeInTheDocument()
    fireEvent.click(button)
    expect(await screen.findByText('Sharing canceled.')).toBeInTheDocument()
  })

  for (const platform of ['LinkedIn', 'Facebook'] as const) {
    it(`opens ${platform} with a same-gesture copy and reports success`, async () => {
      const writeText = vi.fn(async () => {})
      const open = vi.spyOn(window, 'open').mockImplementation(() => null)
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
      window.history.pushState({}, '', '/member/dashboard?qa=agentified-credential&certificate=claimed')
      render(<AgentifiedCompletionCredential preview />)
      const link = await screen.findByRole('link', { name: `Share on ${platform}` })
      const click = vi.fn()
      link.addEventListener('click', click)
      fireEvent.click(link)
      expect(click).toHaveBeenCalledTimes(1)
      expect(click.mock.calls[0][0].defaultPrevented).toBe(false)
      expect(writeText).toHaveBeenCalledTimes(1)
      expect(writeText).toHaveBeenCalledWith(AGENTIFIED_SHARE_MESSAGE)
      expect(open).not.toHaveBeenCalled()
      expect(await screen.findByRole('status')).toHaveTextContent(`Message copied. Paste and review it before posting on ${platform}.`)
      expect(screen.queryByRole('button', { name: 'Retry copying message' })).not.toBeInTheDocument()
    })

    it(`still opens ${platform} and explains a clipboard failure`, async () => {
      const writeText = vi.fn(async () => { throw new Error('Denied') })
      const open = vi.spyOn(window, 'open').mockImplementation(() => null)
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
      window.history.pushState({}, '', '/member/dashboard?qa=agentified-credential&certificate=claimed')
      render(<AgentifiedCompletionCredential preview />)
      const link = await screen.findByRole('link', { name: `Share on ${platform}` })
      const click = vi.fn()
      link.addEventListener('click', click)
      fireEvent.click(link)
      expect(click).toHaveBeenCalledTimes(1)
      expect(click.mock.calls[0][0].defaultPrevented).toBe(false)
      expect(writeText).toHaveBeenCalledTimes(1)
      expect(writeText).toHaveBeenCalledWith(AGENTIFIED_SHARE_MESSAGE)
      expect(open).not.toHaveBeenCalled()
      expect(await screen.findByRole('status')).toHaveTextContent(`Message could not be copied. ${platform} opened with the workshop link. Retry copying your message below.`)
      expect(screen.getByRole('button', { name: 'Retry copying message' })).toBeEnabled()
    })
  }

  it('opens the X intent without using the clipboard', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    window.history.pushState({}, '', '/member/dashboard?qa=agentified-credential&certificate=claimed')
    render(<AgentifiedCompletionCredential preview />)
    const link = await screen.findByRole('link', { name: 'Share on X' })
    fireEvent.click(link)
    expect(writeText).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('X opens with a shorter message and the workshop link. Review it before posting.')
  })

  it('does not let a delayed platform copy overwrite a later X handoff', async () => {
    let finishPlatformCopy: (() => void) | undefined
    const writeText = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { finishPlatformCopy = resolve }))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    window.history.pushState({}, '', '/member/dashboard?qa=agentified-credential&certificate=claimed')
    render(<AgentifiedCompletionCredential preview />)
    fireEvent.click(await screen.findByRole('link', { name: 'Share on LinkedIn' }))
    fireEvent.click(screen.getByRole('link', { name: 'Share on X' }))
    expect(await screen.findByRole('status')).toHaveTextContent('X opens with a shorter message and the workshop link. Review it before posting.')
    finishPlatformCopy?.()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('X opens with a shorter message and the workshop link. Review it before posting.'))
    expect(writeText).toHaveBeenCalledTimes(1)
  })

  it('shows one retry after automatic copy failure and hides it after success', async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error('Denied')).mockResolvedValueOnce(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    window.history.pushState({}, '', '/member/dashboard?qa=agentified-credential&certificate=claimed')
    render(<AgentifiedCompletionCredential preview />)
    expect(screen.queryByRole('button', { name: 'Retry copying message' })).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole('link', { name: 'Share on LinkedIn' }))
    const retry = await screen.findByRole('button', { name: 'Retry copying message' })
    fireEvent.click(retry)
    expect(await screen.findByRole('status')).toHaveTextContent('Message copied. Paste and review it before posting on LinkedIn.')
    expect(screen.queryByRole('button', { name: 'Retry copying message' })).not.toBeInTheDocument()
    expect(writeText).toHaveBeenCalledTimes(2)
    expect(writeText).toHaveBeenNthCalledWith(2, AGENTIFIED_SHARE_MESSAGE)
  })

  it('offers manual selection after the single retry also fails', async () => {
    const writeText = vi.fn(async () => { throw new Error('Denied') })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    window.history.pushState({}, '', '/member/dashboard?qa=agentified-credential&certificate=claimed')
    render(<AgentifiedCompletionCredential preview />)
    fireEvent.click(await screen.findByRole('link', { name: 'Share on Facebook' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Retry copying message' }))
    expect(await screen.findByRole('textbox', { name: 'Message to copy' })).toHaveValue(AGENTIFIED_SHARE_MESSAGE)
    expect(screen.getByRole('status')).toHaveTextContent('Automatic copy is still unavailable. Select the message below to copy it manually.')
    expect(screen.queryByRole('button', { name: 'Retry copying message' })).not.toBeInTheDocument()
    expect(writeText).toHaveBeenCalledTimes(2)
  })
})
