'use client'

import { useTheme } from 'next-themes'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const options = [
  { value: 'light' as const, label: 'Light', Icon: Sun },
  { value: 'dark' as const, label: 'Dark', Icon: Moon },
  { value: 'system' as const, label: 'System', Icon: Monitor },
]

/** Inline Light / Dark / System rows for menus (Navigation/UserMenu). */
export function ThemePreferenceList({
  onSelect,
  className = '',
  showLabel = true,
}: {
  onSelect?: () => void
  className?: string
  showLabel?: boolean
}) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div
        className={`h-24 animate-pulse rounded-lg bg-muted/30 ${className}`}
        aria-hidden
      />
    )
  }

  return (
    <div
      role="group"
      aria-label="Theme"
      className={className}
    >
      {showLabel && (
        <p className="px-3 py-1.5 text-[10px] font-heading uppercase tracking-wider text-muted-foreground">
          Appearance
        </p>
      )}
      {options.map(({ value, label: itemLabel, Icon }) => {
        const selected =
          value === 'system' ? theme === 'system' : theme === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTheme(value)
              onSelect?.()
            }}
            className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors rounded-lg ${
              selected
                ? 'bg-radiant-gold/15 text-radiant-gold'
                : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            <Icon size={16} aria-hidden />
            {itemLabel}
            {selected && (
              <span className="ml-auto text-xs opacity-80" aria-hidden>
                ✓
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function ThemeToggle() {
  const { theme, resolvedTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!mounted) {
    return (
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card/50"
        aria-hidden
      />
    )
  }

  const active = theme === 'system' ? 'system' : theme
  const TriggerIcon =
    active === 'light' ? Sun : active === 'dark' ? Moon : Monitor

  const label =
    active === 'light'
      ? 'Light theme'
      : active === 'dark'
        ? 'Dark theme'
        : `System (${resolvedTheme === 'dark' ? 'dark' : 'light'})`

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full glass-card border border-radiant-gold/30 text-foreground hover:border-radiant-gold/60 hover:text-radiant-gold transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-radiant-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`Theme: ${label}. Change theme`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <TriggerIcon size={18} aria-hidden />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[70] mt-2 min-w-[11rem] rounded-xl glass-card border border-radiant-gold/25 py-1 shadow-2xl">
          <ThemePreferenceList
            showLabel={false}
            onSelect={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
