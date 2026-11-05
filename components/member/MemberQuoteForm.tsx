'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type QuoteOrder = { id: number; status: string; order_items?: Array<{ services?: { title?: string } | null }> }

export default function MemberQuoteForm() {
  const [order, setOrder] = useState<QuoteOrder | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'submitting' | 'sent' | 'error'>('loading')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (process.env.NODE_ENV === 'development' && params.get('qa') === 'quote') {
      setPreview(true)
      setOrder({ id: 1203, status: 'quote_pending', order_items: [{ services: { title: 'Custom implementation plan' } }] })
      setEmail('member@example.invalid')
      setStatus('ready')
      return
    }
    const orderId = Number(params.get('orderId'))
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      setError('Open a reviewed quote request from your member dashboard.')
      setStatus('error')
      return
    }
    let active = true
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      if (!session) {
        setError('Sign in to continue your quote request.')
        setStatus('error')
        return
      }
      setEmail(session.user.email ?? '')
      const response = await fetch('/api/accelerated/member', {
        headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store',
      })
      if (!active) return
      if (!response.ok) throw new Error('Your quote request could not be loaded.')
      const result = await response.json()
      const match = (result.orders as QuoteOrder[] | undefined)?.find((item) =>
        item.id === orderId && item.status === 'quote_pending')
      if (!match) throw new Error('This quote request is no longer pending. Return to your dashboard.')
      setOrder(match)
      setStatus('ready')
    })().catch((reason) => {
      if (active) { setError(reason instanceof Error ? reason.message : 'Quote request unavailable.'); setStatus('error') }
    })
    return () => { active = false }
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!order || preview) return
    setStatus('submitting')
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sign in again to send your quote request.')
      const response = await fetch('/api/accelerated/member/quotes/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ orderId: order.id, name, message }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Quote request could not be sent.')
      setStatus('sent')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Quote request could not be sent.')
      setStatus('ready')
    }
  }

  return <section className="mx-auto max-w-2xl px-6 py-12 text-platinum-white sm:py-16">
    <Link className="mb-8 inline-flex min-h-11 items-center text-sm text-radiant-gold underline" href="/member/dashboard">Back to member dashboard</Link>
    <p className="text-xs font-semibold uppercase tracking-widest text-radiant-gold">Accelerated · reviewed recommendation</p>
    <h1 className="mt-3 font-heading text-3xl font-bold sm:text-4xl">Request a quote</h1>
    <p className="mt-3 text-platinum-white/75">Tell us what the work needs to cover. Your request stays tied to the reviewed service in your member account.</p>
    {status === 'loading' && <p className="mt-8" role="status">Loading your quote request…</p>}
    {status === 'error' && <div className="mt-8 rounded-lg border border-amber-400/40 p-5" role="alert">
      <p>{error}</p><Link className="mt-3 inline-block text-radiant-gold underline" href="/member/dashboard">Open member dashboard</Link>
    </div>}
    {order && <div className="mt-8 rounded-lg border border-radiant-gold/30 bg-silicon-slate/40 p-5">
      <p className="text-sm text-platinum-white/65">Quote request #{order.id}</p>
      <p className="mt-1 font-semibold">{order.order_items?.[0]?.services?.title ?? 'Reviewed service'}</p>
      <p className="mt-2 text-sm text-platinum-white/75">Status: Quote pending. No payment is due now.</p>
    </div>}
    {status === 'sent' && <div className="mt-6 rounded-lg border border-green-400/40 p-5" role="status">
      <p>Your request is saved with quote order #{order?.id}. We’ll review the scope before sharing a price.</p>
      <Link className="mt-3 inline-block text-radiant-gold underline" href="/member/dashboard">Back to member dashboard</Link>
    </div>}
    {order && (status === 'ready' || status === 'submitting') && <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-5">
      <label className="block text-sm">Name
        <input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)}
          className="mt-2 block w-full rounded-md border border-radiant-gold/40 bg-imperial-navy px-3 py-3 text-platinum-white" />
      </label>
      <p className="text-sm text-platinum-white/75">Account email: <span className="text-platinum-white">{email}</span></p>
      <label className="block text-sm">What should this work cover?
        <textarea required maxLength={10000} rows={6} value={message} onChange={(event) => setMessage(event.target.value)}
          className="mt-2 block w-full rounded-md border border-radiant-gold/40 bg-imperial-navy px-3 py-3 text-platinum-white" />
      </label>
      {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
      <button type="submit" disabled={status === 'submitting' || preview}
        className="min-h-11 rounded-md bg-radiant-gold px-5 py-3 font-semibold text-imperial-navy disabled:opacity-50">
        {preview ? 'Preview only' : status === 'submitting' ? 'Saving request…' : 'Send quote request'}
      </button>
    </form>}
  </section>
}
