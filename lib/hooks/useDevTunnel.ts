'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { getCurrentSession } from '@/lib/auth'

export type TunnelStatus = 'unknown' | 'checking' | 'connected' | 'connecting' | 'disconnected' | 'error'

const isDev = process.env.NODE_ENV === 'development'

export function useDevTunnel() {
  const [status, setStatus] = useState<TunnelStatus>(isDev ? 'unknown' : 'connected')
  const [message, setMessage] = useState<string>('')
  const checkingRef = useRef(false)

  const checkStatus = useCallback(async () => {
    if (!isDev || checkingRef.current) return
    checkingRef.current = true
    setStatus('checking')
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) { setStatus('error'); return }
      const res = await fetch('/api/admin/dev-tunnel', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) { setStatus('error'); return }
      const data = await res.json()
      setStatus(data.status as TunnelStatus)
    } catch {
      setStatus('error')
    } finally {
      checkingRef.current = false
    }
  }, [])

  const ensureTunnel = useCallback(async (): Promise<boolean> => {
    if (!isDev) return true

    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return false

      setStatus('connecting')
      setMessage('Starting tunnel...')

      const res = await fetch('/api/admin/dev-tunnel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'ensure' }),
      })

      const data = await res.json()
      setMessage(data.message || '')

      if (data.started) {
        setStatus('connected')
        return true
      } else {
        setStatus('error')
        return false
      }
    } catch {
      setStatus('error')
      setMessage('Failed to reach tunnel API')
      return false
    }
  }, [])

  const stopTunnel = useCallback(async () => {
    if (!isDev) return
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return
      await fetch('/api/admin/dev-tunnel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'stop' }),
      })
      setStatus('disconnected')
      setMessage('Tunnel stopped')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (isDev) checkStatus()
  }, [checkStatus])

  return {
    isDev,
    status,
    message,
    ensureTunnel,
    stopTunnel,
    checkStatus,
  }
}
