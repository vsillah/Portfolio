'use client'

import { useEffect, useRef } from 'react'

const ELEVENLABS_SCRIPT_URL = 'https://elevenlabs.io/player/audioNativeHelper.js'
let scriptLoaded = false

function loadScript(): void {
  if (typeof document === 'undefined' || scriptLoaded) return
  if (document.querySelector(`script[src="${ELEVENLABS_SCRIPT_URL}"]`)) {
    scriptLoaded = true
    return
  }
  const script = document.createElement('script')
  script.src = ELEVENLABS_SCRIPT_URL
  script.async = true
  script.type = 'text/javascript'
  document.body.appendChild(script)
  scriptLoaded = true
}

export interface PublicationCardAudioProps {
  publicationId: number
  publicationTitle: string
  /** Optional: official embed snippet often has only publicUserId */
  projectId?: string | null
  publicUserId: string
  playerUrl?: string | null
}

/**
 * Renders the ElevenLabs Audio Native embed inside a publication card.
 * Loads the helper script once. Official embed uses data-publicuserid (required)
 * and optionally data-projectid; we support both formats.
 */
export default function PublicationCardAudio({
  publicationId,
  publicationTitle,
  projectId,
  publicUserId,
  playerUrl,
}: PublicationCardAudioProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadScript()
  }, [])

  const widgetId = `elevenlabs-audionative-widget-${publicationId}`

  return (
    <div
      className="rounded-xl border border-radiant-gold/10 bg-silicon-slate/30 p-3"
      aria-label={`Listen to ${publicationTitle}`}
    >
      <div className="text-[10px] font-heading tracking-widest text-platinum-white/60 uppercase mb-2">
        Listen
      </div>
      <div
        ref={containerRef}
        id={widgetId}
        data-publicuserid={publicUserId}
        {...(projectId ? { 'data-projectid': projectId } : {})}
        data-playerurl={playerUrl || 'https://elevenlabs.io/player/index.html'}
        data-height="90"
        data-width="100%"
        data-frameborder="no"
        data-scrolling="no"
        className="min-h-[90px] w-full"
      />
    </div>
  )
}
