'use client'

import { useMemo, useState } from 'react'
import { projectReleaseAutomation, type ReleaseAutomationRow } from '@/lib/release-calendar-automation'
import styles from './release-calendar-layout.module.css'

const ZONE = 'America/New_York'
const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const dateParts = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
const timeFormat = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, hour: 'numeric', minute: '2-digit' })

export type MonthRelease = ReleaseAutomationRow & {
  title: string
  attraction_campaigns?: { name: string } | null
}

export function releaseDay(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  const parts = dateParts.formatToParts(date)
  const part = (name: string) => parts.find((entry) => entry.type === name)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function releaseTime(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? timeFormat.format(date) : null
}

export function validMonth(value: string | null): value is string {
  return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value))
}

export function currentMonth() { return releaseDay(new Date().toISOString())!.slice(0, 7) }

export function shiftMonth(month: string, delta: number) {
  const [year, number] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, number - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthDays(month: string) {
  const [year, number] = month.split('-').map(Number)
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate()
  return Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`)
}

function releaseState(item: MonthRelease) {
  const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata as Record<string, unknown> : {}
  if (['completed', 'cancelled'].includes(item.due_status.toLowerCase())) return item.due_status
  if (item.social_content_queue?.status?.toLowerCase() === 'published') return 'published'
  if (metadata.superseded_by_agentified_packet === true || metadata.superseded_at) return 'superseded'
  const preparation = projectReleaseAutomation(item).state
  return item.due_status === 'planned' ? preparation : `${preparation} · ${item.due_status.replace(/_/g, ' ')}`
}

function eventLabel(item: MonthRelease) {
  return `${releaseTime(item.scheduled_for) ? `${releaseTime(item.scheduled_for)} · ` : ''}${item.channel.replace(/_/g, ' ')} · ${item.title} · ${releaseState(item)} · ${item.authorization_status.replace(/_/g, ' ')}`
}

export function ReleaseMonthView({ items, month, onMonthChange, onOpen, onClearFilters }: {
  items: MonthRelease[]
  month: string
  onMonthChange: (month: string) => void
  onOpen: (id: string) => void
  onClearFilters: () => void
}) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [expandedDays, setExpandedDays] = useState<string[]>([])
  const days = useMemo(() => monthDays(month), [month])
  const byDay = useMemo(() => {
    const map = new Map<string, MonthRelease[]>()
    for (const item of items) {
      const day = releaseDay(item.scheduled_for)
      if (!day?.startsWith(`${month}-`)) continue
      map.set(day, [...(map.get(day) ?? []), item])
    }
    for (const rows of map.values()) rows.sort((a, b) => Date.parse(a.scheduled_for) - Date.parse(b.scheduled_for) || a.id.localeCompare(b.id))
    return map
  }, [items, month])
  const activeDay = selectedDay?.startsWith(`${month}-`) ? selectedDay
    : byDay.keys().next().value ?? `${month}-01`
  const [year, number] = month.split('-').map(Number)
  const monthName = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, month: 'long', year: 'numeric' }).format(new Date(Date.UTC(year, number - 1, 15)))
  const monthCount = [...byDay.values()].reduce((sum, rows) => sum + rows.length, 0)
  const firstWeekday = new Date(Date.UTC(year, number - 1, 1)).getUTCDay()
  const selectMonth = (next: string) => { setSelectedDay(null); setExpandedDays([]); onMonthChange(next) }
  const event = (item: MonthRelease) => <button key={item.id} type="button" onClick={() => onOpen(item.id)}
    aria-label={`Open details: ${eventLabel(item)}`}
    className={`${styles.monthEvent} w-full rounded-md border border-blue-400/30 bg-blue-500/10 px-2 py-1.5 text-left text-xs text-foreground hover:bg-blue-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400`}>
    <span className="block font-semibold">{releaseTime(item.scheduled_for) ? `${releaseTime(item.scheduled_for)} · ` : ''}{item.channel.replace(/_/g, ' ')}</span>
    <span className="block break-words">{item.title}</span>
    <span className="block text-muted-foreground">{releaseState(item)} · {item.authorization_status.replace(/_/g, ' ')}</span>
  </button>
  return <section aria-label="Release month calendar" className="min-w-0">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 id="release-month-heading" className="text-base font-semibold" aria-live="polite">{monthName}</h3>
      <div className="flex flex-wrap gap-2" aria-label="Month navigation">
        <button type="button" onClick={() => selectMonth(shiftMonth(month, -1))} className={styles.monthControl} aria-label="Previous month">Previous month</button>
        <button type="button" onClick={() => selectMonth(currentMonth())} className={styles.monthControl}>Today</button>
        <button type="button" onClick={() => selectMonth(shiftMonth(month, 1))} className={styles.monthControl} aria-label="Next month">Next month</button>
      </div>
    </div>
    <p className="mb-3 text-xs text-muted-foreground">{monthCount} release {monthCount === 1 ? 'row' : 'rows'} in {monthName}. Times shown in America/New_York.</p>
    {monthCount === 0 ? <div className="rounded-lg border border-border p-5 text-sm">
      <p>No releases match this month and the current filters.</p>
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={onClearFilters} className={styles.monthControl}>Clear filters</button><button type="button" onClick={() => selectMonth(currentMonth())} className={styles.monthControl}>Go to current month</button></div>
    </div> : null}
    <div className={styles.monthGrid} aria-labelledby="release-month-heading">
      {weekDays.map(day => <div key={day} className="border-b border-border p-2 text-center text-xs font-semibold text-muted-foreground">{day}</div>)}
      {Array.from({ length: firstWeekday }, (_, index) => <div key={`pad-${index}`} aria-hidden="true" className="border-b border-r border-border/60" />)}
      {days.map(day => {
        const rows = byDay.get(day) ?? []
        const open = expandedDays.includes(day)
        return <div key={day} className="min-w-0 border-b border-r border-border/60 p-1.5">
          <span className="mb-1 block text-xs font-semibold">{Number(day.slice(-2))}</span>
          <div className="grid min-w-0 gap-1">{(open ? rows : rows.slice(0, 2)).map(event)}</div>
          {rows.length > 2 ? <button type="button" className="mt-1 min-h-9 rounded px-1.5 text-xs font-semibold text-blue-700 underline dark:text-blue-200" aria-expanded={open} aria-label={`${open ? 'Show fewer' : `Show ${rows.length - 2} more`} releases on ${day}`} onClick={() => setExpandedDays(current => open ? current.filter(value => value !== day) : [...current, day])}>{open ? 'Show fewer' : `+${rows.length - 2} more`}</button> : null}
        </div>
      })}
    </div>
    <div className={styles.monthMobile}>
      <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="release-day-select">Day in {monthName}</label>
      <select id="release-day-select" className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm" value={activeDay} onChange={event => setSelectedDay(event.target.value)}>
        {days.map(day => <option key={day} value={day}>{new Intl.DateTimeFormat('en-US', { timeZone: ZONE, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${day}T12:00:00Z`))} · {(byDay.get(day) ?? []).length} releases</option>)}
      </select>
      <div className="mt-3 grid gap-2" aria-live="polite">{(byDay.get(activeDay) ?? []).length ? (byDay.get(activeDay) ?? []).map(event) : <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">No releases on this day. Choose another day above.</p>}</div>
    </div>
  </section>
}
