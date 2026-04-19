'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Search, User } from 'lucide-react'

export interface LeadSearchOption {
  id: number
  name: string
  email: string | null
}

const ACCENT = {
  violet: {
    summary: 'text-violet-300',
    change: 'text-violet-400 hover:text-violet-300',
    currentBadge: 'text-violet-400',
    currentRow: 'border-violet-500 bg-violet-950/45',
    currentRowKb: 'bg-violet-900/55',
    currentRowHover: 'hover:bg-violet-900/50',
  },
  emerald: {
    summary: 'text-emerald-300',
    change: 'text-emerald-400 hover:text-emerald-300',
    currentBadge: 'text-emerald-400',
    currentRow: 'border-emerald-600/60 bg-emerald-950/35',
    currentRowKb: 'bg-emerald-900/45',
    currentRowHover: 'hover:bg-emerald-900/40',
  },
} as const

export default function LeadSearchCombobox({
  options,
  value,
  onChange,
  currentContactId = null,
  accent = 'violet',
  placeholder = 'Search leads...',
  className = '',
  listZClass = 'z-[60]',
  onEscape,
  footer,
  disabled = false,
  fallbackName,
  fallbackEmail = null,
}: {
  options: LeadSearchOption[]
  value: string
  onChange: (id: string) => void
  currentContactId?: number | null
  accent?: keyof typeof ACCENT
  placeholder?: string
  className?: string
  /** e.g. z-[60] so the list stacks above modals (z-50). */
  listZClass?: string
  onEscape?: () => void
  footer?: ReactNode
  disabled?: boolean
  /** When the selected id is not yet in `options` (e.g. row display name from meeting). */
  fallbackName?: string
  fallbackEmail?: string | null
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const a = ACCENT[accent]

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (l) =>
        (l.name?.toLowerCase().includes(q)) ||
        (l.email?.toLowerCase().includes(q)),
    )
  }, [options, searchQuery])

  useEffect(() => {
    if (!value) {
      setSearchQuery('')
      setHighlightIdx(-1)
    }
  }, [value])

  const selected = value
    ? options.find((l) => String(l.id) === value)
    : undefined
  const displayName = selected?.name ?? fallbackName ?? value
  const displayEmail = selected?.email ?? fallbackEmail

  const clearAndFocus = useCallback(() => {
    onChange('')
    setSearchQuery('')
    setHighlightIdx(-1)
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [onChange])

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((prev) => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter' && highlightIdx >= 0) {
      e.preventDefault()
      const lead = filtered[highlightIdx]
      if (lead) onChange(String(lead.id))
    } else if (e.key === 'Escape') {
      onEscape?.()
    }
  }

  if (value) {
    return (
      <div className={className}>
        <div className="rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-2 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className={`flex items-center gap-1 text-xs ${a.summary}`}>
              <User size={12} className="shrink-0" aria-hidden />
              <span className="font-medium truncate">{displayName}</span>
            </div>
            {displayEmail ? (
              <p className="text-[11px] text-gray-500 truncate mt-0.5 pl-4">{displayEmail}</p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={clearAndFocus}
            className={`text-xs ${a.change} shrink-0 disabled:opacity-50`}
          >
            Change
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`.trim()}>
      <div className="flex items-center gap-1 rounded bg-gray-800 border border-gray-700 px-2 py-1">
        <Search size={12} className="text-gray-500 shrink-0" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setHighlightIdx(-1)
          }}
          onKeyDown={onSearchKeyDown}
          placeholder={placeholder}
          className="bg-transparent text-xs text-gray-200 placeholder-gray-500 outline-none w-full disabled:opacity-50"
          autoFocus
        />
      </div>
      <div
        className={`absolute ${listZClass} mt-1 w-full rounded bg-gray-800 border border-gray-700 shadow-lg flex flex-col max-h-56`}
      >
        <ul className="overflow-y-auto flex-1 py-1">
          {filtered.length === 0 ? (
            <li className="px-2 py-2 text-xs text-gray-500">
              No leads match &ldquo;{searchQuery}&rdquo;
            </li>
          ) : (
            filtered.map((l, idx) => {
              const isCurrentAttributed =
                currentContactId != null && l.id === currentContactId
              const isKbHighlight = highlightIdx === idx
              return (
                <li
                  key={l.id}
                  onClick={() => !disabled && onChange(String(l.id))}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  className={`px-2 py-1.5 text-xs text-gray-200 cursor-pointer border-l-2 flex items-center justify-between gap-2 ${
                    isCurrentAttributed
                      ? a.currentRow
                      : 'border-transparent'
                  } ${
                    isKbHighlight
                      ? isCurrentAttributed
                        ? a.currentRowKb
                        : 'bg-gray-700'
                      : ''
                  } ${
                    !isKbHighlight && !isCurrentAttributed ? 'hover:bg-gray-700' : ''
                  } ${
                    !isKbHighlight && isCurrentAttributed ? a.currentRowHover : ''
                  } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
                >
                  <span className="min-w-0">
                    <span className="font-medium">{l.name}</span>
                    {l.email ? (
                      <span className="text-gray-500 ml-1">({l.email})</span>
                    ) : null}
                  </span>
                  {isCurrentAttributed ? (
                    <span
                      className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide ${a.currentBadge}`}
                    >
                      Current
                    </span>
                  ) : null}
                </li>
              )
            })
          )}
        </ul>
        {footer ? <div className="px-2 py-1.5 border-t border-gray-700 shrink-0">{footer}</div> : null}
      </div>
    </div>
  )
}
