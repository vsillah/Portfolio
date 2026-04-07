/**
 * In-memory sliding-window rate limiter per IP + bucket (serverless: per-instance).
 * Aligns with scorecard submit: 5 requests / 15 minutes per bucket key.
 */

import type { NextRequest } from 'next/server'

const WINDOW_MS = 15 * 60 * 1000
const MAX_HITS = 5

const buckets = new Map<string, Map<string, number[]>>()

function getList(bucket: string, ip: string): number[] {
  let m = buckets.get(bucket)
  if (!m) {
    m = new Map()
    buckets.set(bucket, m)
  }
  return m.get(ip) ?? []
}

function setList(bucket: string, ip: string, list: number[]): void {
  const m = buckets.get(bucket)!
  m.set(ip, list)
}

/** @returns true if this request should be blocked (429). */
export function isIpRateLimited(bucket: string, ip: string): boolean {
  const now = Date.now()
  const cut = now - WINDOW_MS
  let list = getList(bucket, ip).filter((t) => t > cut)
  if (list.length >= MAX_HITS) {
    setList(bucket, ip, list)
    return true
  }
  list.push(now)
  setList(bucket, ip, list)
  return false
}

export function getClientIpFromRequest(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}
