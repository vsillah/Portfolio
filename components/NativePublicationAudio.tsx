'use client'

export interface NativePublicationAudioProps {
  publicationTitle: string
  /** Playable audio URL (from API: audio_preview_playable_url or direct URL) */
  src: string
}

/**
 * Renders a native HTML5 audio player for a publication's self-hosted preview.
 * Use when you have your own audio file (uploaded or pasted URL) instead of ElevenLabs embed.
 */
export default function NativePublicationAudio({
  publicationTitle,
  src,
}: NativePublicationAudioProps) {
  return (
    <div
      className="rounded-xl border border-radiant-gold/10 bg-silicon-slate/30 p-3"
      aria-label={`Listen to ${publicationTitle}`}
    >
      <div className="text-[10px] font-heading tracking-widest text-platinum-white/60 uppercase mb-2">
        Listen
      </div>
      <audio
        controls
        src={src}
        preload="metadata"
        className="w-full h-9 min-h-[36px] accent-radiant-gold"
      >
        Your browser does not support the audio element.
      </audio>
    </div>
  )
}
