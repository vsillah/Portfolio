'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, AtSign, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { startXReconnect } from '@/lib/x-reconnect-client'

type ReconnectState =
  | { status: 'loading'; message: string }
  | { status: 'error'; message: string }

export default function XReconnectPage() {
  const [state, setState] = useState<ReconnectState>({
    status: 'loading',
    message: 'Preparing the secure X reconnect flow...',
  })

  useEffect(() => {
    let mounted = true

    startXReconnect({
      getSession: () => supabase.auth.getSession(),
      fetchAuthUrl: (accessToken) => fetch('/api/auth/x', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }),
      redirect: (url) => window.location.assign(url),
    }).then((result) => {
      if (!mounted || result.status !== 'error') return
      setState({ status: 'error', message: result.message })
    }).catch(() => {
      if (!mounted) return
      setState({ status: 'error', message: 'X connection could not start.' })
    })

    return () => {
      mounted = false
    }
  }, [])

  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <section className="admin-console-card mx-auto max-w-2xl rounded-xl p-8">
        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg border border-radiant-gold/35 bg-radiant-gold/10 text-radiant-gold">
          <AtSign size={24} aria-hidden="true" />
        </div>
        <div className="admin-console-eyebrow mb-3">X Provider</div>
        <h1 className="text-2xl font-semibold">Reconnect X</h1>
        {state.status === 'loading' ? (
          <div className="mt-6 flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-radiant-gold" aria-hidden="true" />
            <p>{state.message}</p>
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">Reconnect could not start.</p>
                <p className="mt-2 text-sm text-red-100/85">{state.message}</p>
              </div>
            </div>
          </div>
        )}
        <a
          href="/admin/social-content"
          className="admin-console-button-secondary mt-8 inline-flex"
        >
          Back to Social Content
        </a>
      </section>
    </main>
  )
}
