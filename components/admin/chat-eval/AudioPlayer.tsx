'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, RotateCcw, Download, Volume2, VolumeX } from 'lucide-react'

interface AudioPlayerProps {
  src: string
  title?: string
}

export function AudioPlayer({ src, title }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
      setIsLoading(false)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    const handleError = () => {
      setError('Failed to load audio')
      setIsLoading(false)
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return

    const time = parseFloat(e.target.value)
    audio.currentTime = time
    setCurrentTime(time)
  }

  const handleRestart = () => {
    const audio = audioRef.current
    if (!audio) return

    audio.currentTime = 0
    setCurrentTime(0)
  }

  const handlePlaybackRateChange = () => {
    const audio = audioRef.current
    if (!audio) return

    const rates = [0.5, 1, 1.5, 2]
    const currentIndex = rates.indexOf(playbackRate)
    const nextRate = rates[(currentIndex + 1) % rates.length]
    audio.playbackRate = nextRate
    setPlaybackRate(nextRate)
  }

  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return

    audio.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="p-4 bg-silicon-slate/30 border border-radiant-gold/10 rounded-xl">
      <audio ref={audioRef} src={src} preload="metadata" />
      
      {title && (
        <div className="text-sm text-platinum-white mb-3 truncate">
          {title}
        </div>
      )}
      
      {/* Progress bar */}
      <div className="mb-3">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          disabled={isLoading}
          className="w-full h-2 bg-silicon-slate rounded-lg appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-3
            [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-radiant-gold
            [&::-webkit-slider-thumb]:cursor-pointer"
          style={{
            background: `linear-gradient(to right, #D4AF37 0%, #D4AF37 ${(currentTime / duration) * 100}%, #2C3E50 ${(currentTime / duration) * 100}%, #2C3E50 100%)`,
          }}
        />
        <div className="flex justify-between text-xs text-platinum-white/50 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{isLoading ? '--:--' : formatTime(duration)}</span>
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={togglePlay}
            disabled={isLoading}
            className="w-10 h-10 rounded-full bg-radiant-gold flex items-center justify-center
              text-imperial-navy hover:bg-radiant-gold/90 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </motion.button>
          
          {/* Restart */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleRestart}
            className="w-8 h-8 rounded-full bg-silicon-slate/50 flex items-center justify-center
              text-platinum-white/70 hover:text-platinum-white transition-colors"
          >
            <RotateCcw size={14} />
          </motion.button>
          
          {/* Mute */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleMute}
            className="w-8 h-8 rounded-full bg-silicon-slate/50 flex items-center justify-center
              text-platinum-white/70 hover:text-platinum-white transition-colors"
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </motion.button>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Playback Rate */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handlePlaybackRateChange}
            className="px-2 py-1 rounded bg-silicon-slate/50 text-xs text-platinum-white/70
              hover:text-platinum-white transition-colors font-mono"
          >
            {playbackRate}x
          </motion.button>
          
          {/* Download */}
          <motion.a
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            href={src}
            download
            className="w-8 h-8 rounded-full bg-silicon-slate/50 flex items-center justify-center
              text-platinum-white/70 hover:text-platinum-white transition-colors"
          >
            <Download size={14} />
          </motion.a>
        </div>
      </div>
    </div>
  )
}
