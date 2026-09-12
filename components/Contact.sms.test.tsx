import userEvent from '@testing-library/user-event'
import { analytics } from '@/lib/analytics'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ImgHTMLAttributes, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Contact from './Contact'

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      animate,
      children,
      exit,
      initial,
      transition,
      ...props
    }: {
      animate?: unknown
      children?: ReactNode
      exit?: unknown
      initial?: unknown
      transition?: unknown
    }) => <div {...props}>{children}</div>,
    form: ({
      animate,
      children,
      exit,
      initial,
      transition,
      ...props
    }: {
      animate?: unknown
      children?: ReactNode
      exit?: unknown
      initial?: unknown
      transition?: unknown
    }) => <form {...props}>{children}</form>,
  },
}))

vi.mock('next/image', () => ({
  default: ({
    alt,
    fill,
    src,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} {...props} />
  ),
}))

vi.mock('@/lib/analytics', () => ({
  analytics: {
    contactFormSubmit: vi.fn(),
    contactFormView: vi.fn(),
  },
}))

vi.mock('./chat', () => ({
  Chat: () => <div data-testid="mock-chat" />,
}))


afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })
async function openForm() {
  const user = userEvent.setup()
  render(<Contact />)
  await user.click(screen.getByRole('button', { name: /send message/i }))
  await user.type(screen.getByLabelText('Name'), 'Synthetic Visitor')
  await user.type(screen.getByLabelText('Email'), 'visitor@example.test')
  await user.type(screen.getByLabelText('Message', { exact: true }), 'Synthetic inquiry')
  return user
}
const consent = () => screen.getByRole('checkbox', { name: /I agree to receive/ })
const submit = () => screen.getAllByRole('button', { name: /send message/i }).at(-1)!
describe('optional SMS form', () => {
  it('starts unchecked, permits no phone, and sends no mobile data without selection', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    vi.stubGlobal('fetch', fetcher)
    const user = await openForm()
    expect(consent()).not.toBeChecked()
    await user.type(screen.getByLabelText('Mobile phone (optional)'), 'invalid optional input')
    await user.click(submit())
    const body = JSON.parse(fetcher.mock.calls[0][1].body)
    expect(body.smsConsent).toBe(false)
    expect(body).not.toHaveProperty('mobilePhone')
    expect(body).not.toHaveProperty('smsDisclosureVersion')
    expect(await screen.findByRole('status')).toHaveTextContent('Message sent successfully')
    await user.type(screen.getByLabelText('Name'), 'Synthetic Visitor')
    await user.type(screen.getByLabelText('Email'), 'visitor@example.test')
    await user.type(screen.getByLabelText('Message', { exact: true }), 'Retry inquiry')
    await user.click(consent())
    await user.click(submit())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid mobile number')
  })
  it('shows inline error and focuses the phone; unchecking recovers normal inquiry', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    vi.stubGlobal('fetch', fetcher)
    const user = await openForm()
    await user.click(consent())
    await user.click(submit())
    expect(fetcher).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid mobile number')
    expect(screen.getByLabelText('Mobile phone (optional)')).toHaveFocus()
    await user.click(consent())
    await user.click(submit())
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
  })
  it('retains fields after save failure and retries; success does not claim enrollment', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Your inquiry was saved, but SMS consent could not be recorded. Please retry.' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
    vi.stubGlobal('fetch', fetcher)
    const user = await openForm()
    await user.type(screen.getByLabelText('Mobile phone (optional)'), '+1 202 555 0123')
    await user.click(consent())
    await user.click(submit())
    expect(await screen.findByRole('status')).toHaveTextContent('Please retry')
    expect(consent()).toBeChecked()
    await user.click(submit())
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('does not start text messages'))
    expect(consent()).not.toBeChecked()
    expect(screen.getByLabelText('Mobile phone (optional)')).toHaveValue('')
    expect(analytics.contactFormSubmit).toHaveBeenCalledWith()
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/legal/privacy')
    expect(screen.getByRole('link', { name: 'SMS Terms' })).toHaveAttribute('href', '/legal/terms#sms')
  })
})
