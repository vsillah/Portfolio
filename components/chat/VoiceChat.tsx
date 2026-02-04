'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Phone, PhoneOff, Volume2, Loader2, AlertCircle } from 'lucide-react'
import type { VapiMessage, VoiceChatMessage, VoiceSessionState, VapiEventHandlers } from '@/lib/vapi'
import { isVapiConfigured, getVapiConfig } from '@/lib/vapi'

interface VoiceChatProps {
  sessionId: string
  onMessage?: (message: VoiceChatMessage) => void
  onCallStart?: () => void
  onCallEnd?: () => void
  visitorName?: string
  visitorEmail?: string
}

export function VoiceChat({
  sessionId,
  onMessage,
  onCallStart,
  onCallEnd,
  visitorName,
  visitorEmail,
}: VoiceChatProps) {
  const [state, setState] = useState<VoiceSessionState>({
    isConnected: false,
    isListening: false,
    isSpeaking: false,
    volumeLevel: 0,
    error: null,
  })
  const [isInitializing, setIsInitializing] = useState(false)
  const [partialTranscript, setPartialTranscript] = useState('')
  
  const vapiRef = useRef<any>(null)
  const isConfigured = isVapiConfigured()

  // Initialize VAPI SDK
  const initializeVapi = useCallback(async () => {
    if (!isConfigured) {
      setState(prev => ({ ...prev, error: 'Voice chat is not configured' }))
      return
    }

    if (vapiRef.current) {
      return // Already initialized
    }

    setIsInitializing(true)
    setState(prev => ({ ...prev, error: null }))

    try {
      // Dynamically import VAPI SDK (client-side only)
      const { default: Vapi } = await import('@vapi-ai/web')
      
      const config = getVapiConfig()
      const vapi = new Vapi(config.publicKey)
      vapiRef.current = vapi

      // Set up event handlers
      vapi.on('call-start', () => {
        console.log('[VoiceChat] Call started')
        setState(prev => ({ ...prev, isConnected: true, error: null }))
        onCallStart?.()
      })

      vapi.on('call-end', () => {
        console.log('[VoiceChat] Call ended')
        setState(prev => ({ 
          ...prev, 
          isConnected: false, 
          isListening: false, 
          isSpeaking: false,
          volumeLevel: 0,
        }))
        setPartialTranscript('')
        onCallEnd?.()
      })

      vapi.on('speech-start', () => {
        setState(prev => ({ ...prev, isSpeaking: true }))
      })

      vapi.on('speech-end', () => {
        setState(prev => ({ ...prev, isSpeaking: false }))
      })

      vapi.on('volume-level', (volume: number) => {
        setState(prev => ({ ...prev, volumeLevel: volume, isListening: volume > 0.1 }))
      })

      vapi.on('message', (message: VapiMessage) => {
        handleVapiMessage(message)
      })

      vapi.on('error', (error: Error) => {
        console.error('[VoiceChat] Error:', error)
        setState(prev => ({ ...prev, error: error.message }))
      })

      setIsInitializing(false)
    } catch (error) {
      console.error('[VoiceChat] Failed to initialize:', error)
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to initialize voice chat. Please try again.' 
      }))
      setIsInitializing(false)
    }
  }, [isConfigured, onCallStart, onCallEnd])

  // Handle VAPI messages
  const handleVapiMessage = useCallback((message: VapiMessage) => {
    if (message.type === 'transcript') {
      const isPartial = message.transcriptType === 'partial'
      const isFinal = message.transcriptType === 'final'
      
      if (isPartial && message.transcript) {
        setPartialTranscript(message.transcript)
      }
      
      if (isFinal && message.transcript) {
        setPartialTranscript('')
        
        const chatMessage: VoiceChatMessage = {
          id: `voice-${Date.now()}-${message.role}`,
          role: message.role === 'user' ? 'user' : 'assistant',
          content: message.transcript,
          timestamp: new Date().toISOString(),
          isVoice: true,
          transcriptType: 'final',
        }
        
        onMessage?.(chatMessage)
      }
    }
  }, [onMessage])

  // Start voice call
  const startCall = useCallback(async () => {
    if (!vapiRef.current) {
      await initializeVapi()
    }

    if (!vapiRef.current) {
      setState(prev => ({ ...prev, error: 'Voice chat not available' }))
      return
    }

    try {
      setState(prev => ({ ...prev, error: null }))
      
      // Start the call with assistant overrides
      const config = getVapiConfig()
      await vapiRef.current.start(config.assistantId, {
        metadata: {
          sessionId,
          visitorName,
          visitorEmail,
          source: 'web',
        },
        // Optional: customize first message based on context
        variableValues: {
          visitorName: visitorName || 'there',
        },
      })
    } catch (error) {
      console.error('[VoiceChat] Failed to start call:', error)
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to start voice call. Please check microphone permissions.' 
      }))
    }
  }, [sessionId, visitorName, visitorEmail, initializeVapi])

  // End voice call
  const endCall = useCallback(() => {
    if (vapiRef.current) {
      vapiRef.current.stop()
    }
  }, [])

  // Toggle call
  const toggleCall = useCallback(() => {
    if (state.isConnected) {
      endCall()
    } else {
      startCall()
    }
  }, [state.isConnected, startCall, endCall])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (vapiRef.current) {
        vapiRef.current.stop()
        vapiRef.current = null
      }
    }
  }, [])

  // Initialize on mount
  useEffect(() => {
    if (isConfigured && !vapiRef.current) {
      initializeVapi()
    }
  }, [isConfigured, initializeVapi])

  if (!isConfigured) {
    return (
      <div className="flex items-center gap-2 text-platinum-white/50 text-sm">
        <AlertCircle size={16} />
        <span>Voice chat not configured</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Voice Status Indicator */}
      <AnimatePresence>
        {state.isConnected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full"
          >
            {/* Volume Visualizer */}
            <div className="flex items-center justify-center gap-1 mb-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-radiant-gold rounded-full"
                  animate={{
                    height: state.isListening 
                      ? Math.max(4, state.volumeLevel * 32 * (1 + Math.sin(i * 0.5)))
                      : 4,
                  }}
                  transition={{ duration: 0.05 }}
                />
              ))}
            </div>

            {/* Status Text */}
            <div className="text-center text-xs text-platinum-white/70">
              {state.isSpeaking ? (
                <span className="flex items-center justify-center gap-1">
                  <Volume2 size={12} className="text-radiant-gold animate-pulse" />
                  Assistant speaking...
                </span>
              ) : state.isListening ? (
                <span className="flex items-center justify-center gap-1">
                  <Mic size={12} className="text-emerald-500 animate-pulse" />
                  Listening...
                </span>
              ) : (
                <span>Connected - speak to interact</span>
              )}
            </div>

            {/* Partial Transcript */}
            {partialTranscript && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2 text-sm text-platinum-white/50 italic text-center"
              >
                "{partialTranscript}..."
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call Control Button */}
      <motion.button
        onClick={toggleCall}
        disabled={isInitializing}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`
          relative flex items-center justify-center w-14 h-14 rounded-full
          transition-all duration-300 shadow-lg
          ${state.isConnected 
            ? 'bg-red-500 hover:bg-red-600' 
            : 'bg-radiant-gold hover:bg-radiant-gold/90'
          }
          ${isInitializing ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {isInitializing ? (
          <Loader2 size={24} className="text-deep-obsidian animate-spin" />
        ) : state.isConnected ? (
          <PhoneOff size={24} className="text-white" />
        ) : (
          <Phone size={24} className="text-deep-obsidian" />
        )}

        {/* Pulse Animation when connected */}
        {state.isConnected && (
          <motion.span
            className="absolute inset-0 rounded-full bg-red-500"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </motion.button>

      {/* Call Button Label */}
      <span className="text-xs text-platinum-white/70">
        {isInitializing 
          ? 'Initializing...' 
          : state.isConnected 
            ? 'End Call' 
            : 'Start Voice Call'
        }
      </span>

      {/* Error Display */}
      <AnimatePresence>
        {state.error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 text-red-400 text-xs mt-2"
          >
            <AlertCircle size={14} />
            <span>{state.error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
