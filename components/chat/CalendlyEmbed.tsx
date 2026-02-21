'use client'

import { useEffect } from 'react'
import { InlineWidget, useCalendlyEventListener } from 'react-calendly'
import { motion } from 'framer-motion'
import { Calendar, X } from 'lucide-react'

interface CalendlyEmbedProps {
  url: string
  prefill?: {
    name?: string
    email?: string
  }
  onEventScheduled?: () => void
  onClose?: () => void
}

export function CalendlyEmbed({ url, prefill, onEventScheduled, onClose }: CalendlyEmbedProps) {
  useCalendlyEventListener({
    onEventScheduled: () => {
      onEventScheduled?.()
    },
  })

  const prefillData = {
    name: prefill?.name || '',
    email: prefill?.email || '',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex gap-3 flex-row"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-silicon-slate/50 border border-radiant-gold/20 text-radiant-gold">
        <Calendar size={14} />
      </div>

      <div className="flex flex-col w-full min-w-0 items-start">
        <span className="text-[10px] font-heading tracking-wider text-platinum-white/40 uppercase mb-1 px-1">
          Schedule a Meeting
        </span>

        <div className="w-full rounded-2xl rounded-tl-sm bg-silicon-slate/30 border border-platinum-white/10 overflow-hidden relative">
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-2 right-2 z-10 p-1 rounded-full bg-imperial-navy/80 hover:bg-imperial-navy text-platinum-white/60 hover:text-platinum-white transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <InlineWidget
            url={url}
            prefill={prefillData}
            styles={{
              height: '680px',
              minWidth: '320px',
              width: '100%',
            }}
            pageSettings={{
              backgroundColor: '0f1729',
              textColor: 'e8e6e3',
              primaryColor: 'd4a843',
              hideEventTypeDetails: false,
              hideLandingPageDetails: false,
              hideGdprBanner: true,
            }}
          />
        </div>
      </div>
    </motion.div>
  )
}
