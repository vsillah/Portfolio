'use client'

import { useEffect, useRef } from 'react'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/**
 * Push-based tracking for the admin Outreach dashboard.
 *
 * Subscribes (via Supabase Realtime / Postgres logical replication) to:
 *   - UPDATEs on `contact_submissions` — so the pill flips the moment
 *     `last_n8n_outreach_status` transitions pending → success / failed
 *     (either from `/api/webhooks/n8n/outreach-generation-complete` or the
 *     `trg_outreach_queue_mark_n8n_success` INSERT trigger).
 *   - INSERTs on `outreach_queue` — so a new draft row makes it into the
 *     "Email — recent" list without a manual refresh.
 *
 * Both streams collapse into a single debounced `onEvent` callback that the
 * caller wires to its existing silent refetch (e.g. `fetchLeads({silent:true})`).
 *
 * Filtering happens client-side against `visibleContactIds`: Postgres Changes
 * filters are single-column-equality only and the outreach list is paginated,
 * so we let RLS gate the subscription and discard anything outside the page.
 *
 * Requirements (applied via migration `2026_04_23_realtime_outreach_publication`):
 *   - `contact_submissions` and `outreach_queue` are in `supabase_realtime`.
 *   - REPLICA IDENTITY FULL so we can read the old row to detect transitions.
 *   - RLS allows the signed-in admin to SELECT both tables (already true).
 */
export interface UseRealtimeOutreachOptions {
  /**
   * IDs of the leads currently rendered. Events for ids outside this set are
   * ignored (the Outreach page is paginated; we don't want every admin
   * in a tab to trigger a refetch on every update).
   *
   * Passing `null` disables the subscription (e.g. before the first fetch).
   */
  visibleContactIds: number[] | null
  /**
   * Fired (debounced) when a relevant event arrives. The caller usually wires
   * this to a silent refetch so the lead rows pick up the fresh server state.
   */
  onEvent: () => void
  /** Disable without tearing down the caller's data. Defaults to true. */
  enabled?: boolean
  /**
   * Coalesce bursts of events into a single `onEvent` call. Defaults to 600ms
   * (a CLG-002 run can fire multiple events in quick succession: insert into
   * outreach_queue + trigger-driven update of contact_submissions + webhook
   * update of contact_submissions).
   */
  debounceMs?: number
}

type ContactRow = {
  id: number
  last_n8n_outreach_status: string | null
}

type QueueRow = {
  id: string
  contact_submission_id: number | null
  channel: string | null
  status: string | null
}

export function useRealtimeOutreach({
  visibleContactIds,
  onEvent,
  enabled = true,
  debounceMs = 600,
}: UseRealtimeOutreachOptions): void {
  // Latest callback + id set without retriggering the subscribe effect.
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const idSetRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    idSetRef.current = new Set(visibleContactIds ?? [])
  }, [visibleContactIds])

  useEffect(() => {
    if (!enabled || !visibleContactIds || visibleContactIds.length === 0) return

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let unsubscribed = false

    const fire = () => {
      if (unsubscribed) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (unsubscribed) return
        onEventRef.current()
      }, debounceMs)
    }

    const channel: RealtimeChannel = supabase
      .channel('admin-outreach-dashboard')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contact_submissions' },
        (payload: RealtimePostgresChangesPayload<ContactRow>) => {
          const newRow = payload.new as ContactRow | null
          const oldRow = payload.old as Partial<ContactRow> | null
          if (!newRow || typeof newRow.id !== 'number') return
          if (!idSetRef.current.has(newRow.id)) return
          // Ignore no-op updates of unrelated columns; we care about the
          // CLG-002 status column specifically.
          if (
            oldRow &&
            'last_n8n_outreach_status' in oldRow &&
            oldRow.last_n8n_outreach_status === newRow.last_n8n_outreach_status
          ) {
            return
          }
          fire()
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'outreach_queue' },
        (payload: RealtimePostgresChangesPayload<QueueRow>) => {
          const row = payload.new as QueueRow | null
          if (!row || typeof row.contact_submission_id !== 'number') return
          if (!idSetRef.current.has(row.contact_submission_id)) return
          fire()
        },
      )
      .subscribe()

    return () => {
      unsubscribed = true
      if (debounceTimer) clearTimeout(debounceTimer)
      void supabase.removeChannel(channel)
    }
    // Intentionally depend on a stable key for the id list (length + first/last
    // ids) rather than the array reference. The ref holds the full live set so
    // we don't tear down the subscription on every fetchLeads round-trip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    debounceMs,
    visibleContactIds?.length ?? 0,
    visibleContactIds?.[0] ?? 0,
    visibleContactIds?.[visibleContactIds.length - 1] ?? 0,
  ])
}
