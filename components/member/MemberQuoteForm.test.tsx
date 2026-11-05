import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), addProduct: vi.fn(), addService: vi.fn(), getCartCount: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: mocks.getSession } } }))
vi.mock('@/lib/cart', () => ({ addToCart: mocks.addProduct, addServiceToCart: mocks.addService, getCartCount: mocks.getCartCount }))
vi.mock('@/components/ProductCard', () => ({ default: ({ product, onAddToCart, viewDetailsHref }: { product: {id:number;title:string}; onAddToCart:(id:number)=>void; viewDetailsHref:string }) =>
  <article><h3>{product.title}</h3><a href={viewDetailsHref}>View details</a><button onClick={() => onAddToCart(product.id)}>Add to cart</button></article> }))
vi.mock('@/components/ServiceCard', () => ({ default: ({ service, onAddToCart, onRequestQuote, viewDetailsHref, actionDisabledReason }: { service: {id:string;title:string;is_quote_based:boolean}; onAddToCart:(id:string)=>void; onRequestQuote:(id:string)=>void; viewDetailsHref:string; actionDisabledReason?:string }) =>
  <article><h3>{service.title}</h3><a href={viewDetailsHref}>View details</a><button disabled={!!actionDisabledReason} onClick={() => service.is_quote_based ? onRequestQuote(service.id) : onAddToCart(service.id)}>{service.is_quote_based ? 'Request Quote' : 'Add to cart'}</button>{actionDisabledReason && <p>{actionDisabledReason}</p>}</article> }))

import MemberQuoteForm, { synthetic } from './MemberQuoteForm'

describe('contextual member catalog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    window.history.replaceState({}, '', '/member/quote?orderId=1203')
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'test' } } })
    mocks.getCartCount.mockReturnValue(0)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => synthetic }))
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('renders native card integrations, filters actual cards, and keeps the reviewed offer pinned', async () => {
    render(<MemberQuoteForm />)
    await screen.findByRole('heading', { name: 'Active catalog' })
    expect((screen.getByText('Refine options · 5 questions').closest('details') as HTMLDetailsElement).open).toBe(false)
    expect(screen.getByText(/4 matching options/)).toBeTruthy()
    expect(within(screen.getByTestId('reviewed-offer')).getByText('Custom implementation plan')).toBeTruthy()
    expect(screen.getByTestId('catalog-grid').querySelectorAll('article')).toHaveLength(4)
    expect(screen.getAllByRole('link', { name: 'View details' }).some((link) => link.getAttribute('href') === '/store/903?fromQuote=1203')).toBe(true)
    expect(screen.getAllByRole('link', { name: 'View details' }).some((link) => link.getAttribute('href')?.startsWith('/services/22222222-2222-4222-8222-222222222222?fromQuote=1203'))).toBe(true)
    fireEvent.click(screen.getAllByRole('radio', { name: 'Remote' })[0])
    await waitFor(() => expect(screen.getByText(/2 matching options/)).toBeTruthy())
    await waitFor(() => expect(screen.getByTestId('catalog-grid').querySelectorAll('article')).toHaveLength(2))
    expect(screen.queryByText('In-person strategy workshop')).toBeNull()
    expect(within(screen.getByTestId('reviewed-offer')).getByText('Custom implementation plan')).toBeTruthy()
  })

  it('uses the existing cart callback for a fixed offer and keeps quote services out of cart', async () => {
    render(<MemberQuoteForm />)
    await screen.findByRole('heading', { name: 'Active catalog' })
    fireEvent.click(within(screen.getByTestId('catalog-grid')).getAllByRole('button', { name: 'Add to cart' })[0])
    expect(mocks.addService).toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222')
    fireEvent.click(within(screen.getByTestId('catalog-grid')).getAllByRole('button', { name: 'Request Quote' })[1])
    expect(mocks.addService).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/This alternative is a request for review/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send for operator review' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getAllByRole('link', { name: 'View details' })[0].getAttribute('href')).toMatch(/fromQuote=1203/)
  })

  it('restores draft answers and requested quote after a detail round trip', async () => {
    const view = render(<MemberQuoteForm />)
    await screen.findByRole('heading', { name: 'Active catalog' })
    fireEvent.click(screen.getAllByRole('radio', { name: 'Remote' })[0])
    fireEvent.click(within(screen.getByTestId('catalog-grid')).getAllByRole('button', { name: 'Request Quote' })[1])
    view.unmount()
    render(<MemberQuoteForm />)
    await screen.findByRole('heading', { name: 'Active catalog' })
    expect(screen.getByText(/2 matching options/)).toBeTruthy()
    expect(screen.getByText(/This alternative is a request for review/)).toBeTruthy()
  })

  it('keeps the reviewed card and a full-catalog recovery when filters match nothing', async () => {
    render(<MemberQuoteForm />)
    await screen.findByRole('heading', { name: 'Active catalog' })
    fireEvent.click(screen.getAllByRole('radio', { name: 'Self guided' })[0])
    fireEvent.click(screen.getAllByRole('radio', { name: 'One on one' })[0])
    await waitFor(() => expect(screen.getByText(/0 matching options/)).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Show all options' }))
    await waitFor(() => expect(screen.getByTestId('catalog-grid').querySelectorAll('article')).toHaveLength(4))
    expect(within(screen.getByTestId('reviewed-offer')).getByText('Custom implementation plan')).toBeTruthy()
  })

  it('locks the reviewed quote action after submission', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...synthetic, submitted: true }) }))
    render(<MemberQuoteForm />)
    await screen.findByText(/Your quote context is with an operator/)
    expect(within(screen.getByTestId('reviewed-offer')).getByRole('button', { name: 'Request Quote' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('Already sent for operator review')).toBeTruthy()
  })
})
