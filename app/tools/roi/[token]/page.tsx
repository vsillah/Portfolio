'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type ValidateResult = { allowed: true; contactName?: string }
type CalculateResult = {
  annualValue: number
  formulaReadable: string
  roi?: number
  roiFormatted?: string
  paybackFormatted?: string
  netFirstYearValue?: number
}

export default function ROICalculatorPage() {
  const params = useParams()
  const token = typeof params?.token === 'string' ? params.token : ''
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading')
  const [contactName, setContactName] = useState<string | null>(null)

  const [hoursPerWeek, setHoursPerWeek] = useState(10)
  const [hourlyRate, setHourlyRate] = useState(75)
  const [weeksPerYear, setWeeksPerYear] = useState(52)
  const [offerPrice, setOfferPrice] = useState<number | ''>('')
  const [result, setResult] = useState<CalculateResult | null>(null)
  const [calculating, setCalculating] = useState(false)

  useEffect(() => {
    if (!token || token.length < 16) {
      setStatus('invalid')
      return
    }
    let cancelled = false
    fetch(`/api/tools/roi/validate?token=${encodeURIComponent(token)}`)
      .then((res) => {
        if (cancelled) return
        if (res.ok) return res.json() as Promise<ValidateResult>
        setStatus('invalid')
        return null
      })
      .then((data) => {
        if (cancelled || !data) return
        setStatus('valid')
        if (data.contactName) setContactName(data.contactName)
      })
      .catch(() => {
        if (!cancelled) setStatus('invalid')
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const runCalculation = useCallback(async () => {
    setCalculating(true)
    try {
      const body: Record<string, number | undefined> = {
        hoursPerWeek,
        hourlyRate,
        weeksPerYear,
      }
      if (typeof offerPrice === 'number' && offerPrice > 0) {
        body.offerPrice = offerPrice
      }
      const res = await fetch('/api/tools/roi/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Calculation failed')
      const data = (await res.json()) as CalculateResult
      setResult(data)
    } catch {
      setResult(null)
    } finally {
      setCalculating(false)
    }
  }, [hoursPerWeek, hourlyRate, weeksPerYear, offerPrice])

  useEffect(() => {
    if (status !== 'valid') return
    const t = setTimeout(runCalculation, 300)
    return () => clearTimeout(t)
  }, [status, runCalculation])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <p className="text-gray-400">Checking link…</p>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-white mb-2">Link invalid or expired</h1>
          <p className="text-gray-400 mb-6">
            This ROI calculator link is no longer valid. If you received it from us, please ask for a new link.
          </p>
          <Link
            href="/contact"
            className="inline-block px-4 py-2 rounded bg-amber-600 text-white hover:bg-amber-500 transition"
          >
            Contact us
          </Link>
        </div>
      </div>
    )
  }

  const offerNum = typeof offerPrice === 'number' ? offerPrice : Number(offerPrice) || 0

  return (
    <div className="min-h-screen bg-black text-white pt-12 pb-16 px-4">
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">ROI Calculator</h1>
        <p className="text-gray-400 text-sm mb-8">
          Estimate annual value of time saved and optional ROI vs. offer price.
        </p>

        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Hours saved per week</label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(Number(e.target.value) || 0)}
              className="w-full rounded bg-white/10 border border-white/20 px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Hourly rate ($)</label>
            <input
              type="number"
              min={0}
              step={5}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(Number(e.target.value) || 0)}
              className="w-full rounded bg-white/10 border border-white/20 px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Weeks per year</label>
            <input
              type="number"
              min={1}
              max={52}
              value={weeksPerYear}
              onChange={(e) => setWeeksPerYear(Number(e.target.value) || 52)}
              className="w-full rounded bg-white/10 border border-white/20 px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Offer price ($) — optional</label>
            <input
              type="number"
              min={0}
              step={100}
              value={offerPrice === '' ? '' : offerPrice}
              onChange={(e) => {
                const v = e.target.value
                setOfferPrice(v === '' ? '' : Number(v) || 0)
              }}
              placeholder="e.g. 5000"
              className="w-full rounded bg-white/10 border border-white/20 px-3 py-2 text-white placeholder:text-gray-500"
            />
          </div>
        </div>

        {calculating && !result && (
          <p className="text-gray-400 text-sm mb-4">Calculating…</p>
        )}
        {result && (
          <div className="rounded-lg border border-white/20 bg-white/5 p-6 mb-8">
            <p className="text-gray-400 text-sm mb-1">{result.formulaReadable}</p>
            <p className="text-2xl font-bold text-amber-400">
              Annual value: ${result.annualValue.toLocaleString()}
            </p>
            {result.roiFormatted != null && offerNum > 0 && (
              <p className="mt-2 text-white">
                ROI: {result.roiFormatted} · Payback: {result.paybackFormatted}
              </p>
            )}
            {result.netFirstYearValue != null && offerNum > 0 && (
              <p className="text-gray-400 text-sm mt-1">
                Net first-year value: ${result.netFirstYearValue.toLocaleString()}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Link
            href="/contact"
            className="inline-block px-4 py-2 rounded bg-amber-600 text-white hover:bg-amber-500 transition"
          >
            Schedule follow-up
          </Link>
          <a
            href={`/contact?subject=${encodeURIComponent('ROI Calculator results')}&body=${encodeURIComponent(
              result
                ? `Annual value: $${result.annualValue.toLocaleString()}\n${result.formulaReadable}${result.roiFormatted ? `\nROI: ${result.roiFormatted}\nPayback: ${result.paybackFormatted}` : ''}`
                : ''
            )}`}
            className="inline-block px-4 py-2 rounded border border-white/30 text-white hover:bg-white/10 transition"
          >
            Email my results
          </a>
        </div>
      </div>
    </div>
  )
}
