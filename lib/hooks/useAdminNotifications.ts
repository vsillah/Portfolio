'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getCurrentSession } from '@/lib/auth'

interface AdminNotification {
  id: string
  type: string
  payload: Record<string, unknown>
  read: boolean
  created_at: string
}

const POLL_INTERVAL_MS = 30_000

export function useAdminNotifications() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchUnread = useCallback(async () => {
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return
      const res = await fetch('/api/admin/notifications?unread=true&limit=10', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications ?? [])
        setUnreadCount(data.unread_count ?? 0)
      }
    } catch {
      // silent
    }
  }, [])

  const markRead = useCallback(async (ids: string[]) => {
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return
      await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ ids }),
      })
      setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - ids.length))
    } catch {
      // silent
    }
  }, [])

  const markAllRead = useCallback(async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length > 0) await markRead(unreadIds)
  }, [notifications, markRead])

  useEffect(() => {
    fetchUnread()
    intervalRef.current = setInterval(fetchUnread, POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchUnread])

  return { unreadCount, notifications, fetchUnread, markRead, markAllRead }
}
