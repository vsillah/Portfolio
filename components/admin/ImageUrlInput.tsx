'use client'

import { useState, useEffect } from 'react'

export interface ImageUrlInputProps {
  /** Current value: local path (e.g. /foo.png) or full URL (e.g. https://...) */
  value: string
  /** Called when value changes */
  onChange: (value: string) => void
  /** Field label (default: "Image") */
  label?: string
  /** Placeholder when Local is selected (default: "Chatbot_N8N_img.png") */
  placeholderLocal?: string
  /** Placeholder when External is selected (default: "example.com/path/to/image.jpg") */
  placeholderExternal?: string
  /** Optional className for the wrapper */
  className?: string
  /** Optional variant: 'brand' uses radiant-gold/silicon-slate, 'neutral' uses gray-800/gray-700 */
  variant?: 'brand' | 'neutral'
}

/**
 * Reusable image/URL input with Local (/public/) vs External URL toggle.
 * Use anywhere a filename or path in public is needed.
 */
export function ImageUrlInput({
  value,
  onChange,
  label = 'Image',
  placeholderLocal = 'Chatbot_N8N_img.png',
  placeholderExternal = 'example.com/path/to/image.jpg',
  className = '',
  variant = 'brand',
}: ImageUrlInputProps) {
  const safeValue = value ?? ''
  const [source, setSource] = useState<'local' | 'external'>(() =>
    safeValue.startsWith('http') ? 'external' : 'local'
  )

  // Sync source when value prop changes (e.g. loading existing data)
  useEffect(() => {
    if (safeValue.startsWith('http')) setSource('external')
    else if (safeValue) setSource('local')
  }, [safeValue])

  const isBrand = variant === 'brand'
  const btnActive = isBrand
    ? 'bg-radiant-gold/20 text-radiant-gold border border-radiant-gold/50'
    : 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
  const btnInactive = isBrand
    ? 'bg-silicon-slate/50 text-platinum-white/80 border border-silicon-slate/80 hover:border-silicon-slate'
    : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
  const inputWrapper = isBrand
    ? 'border-silicon-slate/80 focus-within:border-radiant-gold/50 focus-within:ring-1 focus-within:ring-radiant-gold/30'
    : 'border-gray-700 focus-within:border-purple-500'
  const prefixBg = isBrand ? 'bg-silicon-slate/50 border-silicon-slate/80' : 'bg-gray-800 border-gray-700'
  const inputClass = isBrand
    ? 'flex-1 px-4 py-2 input-brand border-0 focus:ring-0'
    : 'flex-1 px-4 py-2 bg-gray-800 border-0 focus:ring-0 text-white placeholder-gray-500 focus:outline-none'
  const helperClass = isBrand ? 'text-platinum-white/60' : 'text-gray-500'

  const displayValue =
    source === 'local'
      ? safeValue.startsWith('/') ? safeValue.slice(1) : safeValue
      : safeValue.replace(/^https?:\/\//, '').replace(/^\//, '')

  const handleChange = (v: string) => {
    const trimmed = v.trim()
    const newValue =
      source === 'local'
        ? trimmed ? `/${trimmed}` : ''
        : trimmed ? `https://${trimmed.replace(/^https?:\/\//, '')}` : ''
    onChange(newValue)
  }

  return (
    <div className={className}>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => setSource('local')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            source === 'local' ? btnActive : btnInactive
          }`}
        >
          Local (/public/)
        </button>
        <button
          type="button"
          onClick={() => setSource('external')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            source === 'external' ? btnActive : btnInactive
          }`}
        >
          External URL
        </button>
      </div>
      <div
        className={`flex items-center rounded-lg overflow-hidden border ${inputWrapper} bg-transparent`}
      >
        <span
          className={`pl-4 py-2 min-w-[4rem] border-r ${prefixBg} ${
            isBrand ? 'text-platinum-white/80' : 'text-gray-400'
          }`}
        >
          {source === 'local' ? '/' : 'https://'}
        </span>
        <input
          type="text"
          value={displayValue}
          onChange={(e) => handleChange(e.target.value)}
          className={inputClass}
          placeholder={source === 'local' ? placeholderLocal : placeholderExternal}
        />
      </div>
      <p className={`mt-1 text-xs ${helperClass}`}>
        {source === 'local'
          ? 'Filename or path in /public/ (e.g. Chatbot_N8N_img.png)'
          : 'Domain and path only (https:// is added automatically)'}
      </p>
    </div>
  )
}
