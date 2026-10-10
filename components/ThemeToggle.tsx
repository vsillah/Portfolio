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
            aria-label={`${itemLabel} theme`}
            aria-pressed={selected}
            onClick={() => {
              setTheme(value)
              onSelect?.()
            }}
            className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors rounded-lg ${
              selected
                ? 'bg-radiant-gold/15 text-bronze dark:text-radiant-gold'
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

export default function ThemeToggle({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
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
        className={`flex shrink-0 items-center justify-center border border-border bg-card ${
          variant === 'compact' ? 'h-9 w-9 rounded-lg' : 'h-11 w-11 rounded-full'
        }`}
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
        className={`flex shrink-0 items-center justify-center border border-radiant-gold/30 bg-card text-foreground transition-all duration-300 hover:border-radiant-gold/60 hover:text-bronze active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-radiant-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:text-radiant-gold ${
          variant === 'compact'
            ? 'h-9 w-9 rounded-lg'
            : 'glass-card h-11 w-11 rounded-full hover:scale-105'
        }`}
        aria-label={`Theme: ${label}. Change theme`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <TriggerIcon size={18} aria-hidden />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-[70] mt-2 min-w-[11rem] rounded-xl glass-card border border-radiant-gold/25 py-1 shadow-2xl"
          role="dialog"
          aria-label="Theme preferences"
        >
          <ThemePreferenceList
            showLabel={false}
            onSelect={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
