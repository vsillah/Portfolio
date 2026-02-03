'use client'

import { motion } from 'framer-motion'
import { Clock, Phone, FileText, AlertCircle } from 'lucide-react'
import { AudioPlayer } from './AudioPlayer'

interface VoiceSessionMetaProps {
  voiceData: {
    vapi_call_id?: string
    recording_url?: string
    duration_seconds?: number
    started_at?: string
    ended_at?: string
    ended_reason?: string
    summary?: string
    full_transcript?: string
  }
}

export function VoiceSessionMeta({ voiceData }: VoiceSessionMetaProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  return (
    <div className="space-y-4">
      {/* Recording Player */}
      {voiceData.recording_url && (
        <div>
          <h4 className="text-xs font-heading text-platinum-white/60 uppercase tracking-wider mb-2">
            Call Recording
          </h4>
          <AudioPlayer 
            src={voiceData.recording_url} 
            title="Voice Call Recording"
          />
        </div>
      )}

      {/* Call Details */}
      <div className="p-4 bg-silicon-slate/20 border border-radiant-gold/10 rounded-xl space-y-3">
        <h4 className="text-xs font-heading text-platinum-white/60 uppercase tracking-wider">
          Call Details
        </h4>
        
        <div className="grid grid-cols-2 gap-3">
          {/* Duration */}
          {voiceData.duration_seconds !== undefined && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Clock size={14} className="text-purple-400" />
              </div>
              <div>
                <div className="text-xs text-platinum-white/50">Duration</div>
                <div className="text-sm text-platinum-white font-mono">
                  {formatDuration(voiceData.duration_seconds)}
                </div>
              </div>
            </div>
          )}
          
          {/* End Reason */}
          {voiceData.ended_reason && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Phone size={14} className="text-orange-400" />
              </div>
              <div>
                <div className="text-xs text-platinum-white/50">End Reason</div>
                <div className="text-sm text-platinum-white capitalize">
                  {voiceData.ended_reason.replace(/-/g, ' ')}
                </div>
              </div>
            </div>
          )}
          
          {/* Started At */}
          {voiceData.started_at && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Clock size={14} className="text-emerald-400" />
              </div>
              <div>
                <div className="text-xs text-platinum-white/50">Started</div>
                <div className="text-xs text-platinum-white">
                  {formatDateTime(voiceData.started_at)}
                </div>
              </div>
            </div>
          )}
          
          {/* Ended At */}
          {voiceData.ended_at && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                <Clock size={14} className="text-red-400" />
              </div>
              <div>
                <div className="text-xs text-platinum-white/50">Ended</div>
                <div className="text-xs text-platinum-white">
                  {formatDateTime(voiceData.ended_at)}
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* VAPI Call ID */}
        {voiceData.vapi_call_id && (
          <div className="pt-2 border-t border-platinum-white/10">
            <div className="text-xs text-platinum-white/50 mb-1">VAPI Call ID</div>
            <div className="text-xs text-platinum-white/70 font-mono truncate">
              {voiceData.vapi_call_id}
            </div>
          </div>
        )}
      </div>

      {/* AI Summary */}
      {voiceData.summary && (
        <div className="p-4 bg-silicon-slate/20 border border-radiant-gold/10 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={14} className="text-radiant-gold" />
            <h4 className="text-xs font-heading text-platinum-white/60 uppercase tracking-wider">
              AI Summary
            </h4>
          </div>
          <p className="text-sm text-platinum-white/80 leading-relaxed">
            {voiceData.summary}
          </p>
        </div>
      )}

      {/* Full Transcript (collapsible) */}
      {voiceData.full_transcript && (
        <details className="group">
          <summary className="flex items-center gap-2 p-4 bg-silicon-slate/20 border border-radiant-gold/10 rounded-xl cursor-pointer hover:bg-silicon-slate/30 transition-colors">
            <FileText size={14} className="text-blue-400" />
            <span className="text-xs font-heading text-platinum-white/60 uppercase tracking-wider">
              Full Transcript
            </span>
            <span className="ml-auto text-xs text-platinum-white/40 group-open:hidden">
              Click to expand
            </span>
          </summary>
          <div className="mt-2 p-4 bg-silicon-slate/10 border border-radiant-gold/5 rounded-xl">
            <p className="text-sm text-platinum-white/70 whitespace-pre-wrap leading-relaxed">
              {voiceData.full_transcript}
            </p>
          </div>
        </details>
      )}

      {/* No recording warning */}
      {!voiceData.recording_url && (
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <AlertCircle size={14} className="text-yellow-400" />
          <span className="text-xs text-yellow-400">
            No recording available for this call
          </span>
        </div>
      )}
    </div>
  )
}
