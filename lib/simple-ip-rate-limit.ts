/**
 * In-memory sliding-window rate limiter per IP + bucket (serverless: per-instance).
 *
 * Default: 5 requests / 15 minutes (legacy scorecard behaviour).
 * Per-bucket overrides allow tighter limits for high-cost paths (e.g. chat_message).
 */

import type { NextRequest } from 'next/server'

const DEFAULT_WINDOW_MS = 15 * 60 * 1000
const DEFAULT_MAX_HITS = 5

interface BucketConfig {
  windowMs: number
  maxHits: number
}

const BUCKET_OVERRIDES: Record<string, BucketConfig> = {
  chat_message: { windowMs: 60 * 1000, maxHits: 20 },
}

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
  const cfg = BUCKET_OVERRIDES[bucket]
  const windowMs = cfg?.windowMs ?? DEFAULT_WINDOW_MS
  const maxHits = cfg?.maxHits ?? DEFAULT_MAX_HITS

  const now = Date.now()
  const cut = now - windowMs
  let list = getList(bucket, ip).filter((t) => t > cut)
  if (list.length >= maxHits) {
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
