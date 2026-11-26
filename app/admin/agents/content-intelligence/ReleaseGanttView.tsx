'use client'

import { useMemo } from 'react'
import { projectReleaseAutomation } from '@/lib/release-calendar-automation'
import { currentMonth, releaseDay, releaseTime, shiftMonth, type MonthRelease } from './ReleaseMonthView'
import styles from './release-calendar-layout.module.css'

type CampaignLane = { key: string; name: string; rows: MonthRelease[]; first: string; last: string }

const dayNumber = (day: string) => Date.parse(`${day}T12:00:00Z`) / 86_400_000
const prettyDay = (day: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${day}T12:00:00Z`))
const monthName = (month: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', year: 'numeric' }).format(new Date(`${month}-15T12:00:00Z`))

export function groupCampaignLanes(items: MonthRelease[]): CampaignLane[] {
  const lanes = new Map<string, CampaignLane>()
  for (const item of items) {
    const day = releaseDay(item.scheduled_for)
    if (!day) continue
    const key = item.campaign_id ?? 'unassigned'
    const lane = lanes.get(key) ?? { key, name: key === 'unassigned' ? 'Unassigned' : item.attraction_campaigns?.name ?? 'Campaign', rows: [], first: day, last: day }
    lane.rows.push(item)
    if (day < lane.first) lane.first = day
    if (day > lane.last) lane.last = day
    lanes.set(key, lane)
  }
  return [...lanes.values()].map(lane => ({ ...lane, rows: lane.rows.sort((a, b) => Date.parse(a.scheduled_for) - Date.parse(b.scheduled_for) || a.id.localeCompare(b.id)) }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key))
}

function milestoneState(item: MonthRelease) {
  const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata as Record<string, unknown> : {}
  if (['completed', 'cancelled'].includes(item.due_status.toLowerCase())) return item.due_status
  if (item.social_content_queue?.status?.toLowerCase() === 'published') return 'published'
  if (metadata.superseded_at || metadata.superseded_by_agentified_packet === true) return 'superseded'
  return projectReleaseAutomation(item).state
}

export function ReleaseGanttView({ items, month, onMonthChange, onOpen, onClearFilters }: {
  items: MonthRelease[]
  month: string
  onMonthChange: (month: string) => void
  onOpen: (id: string) => void
  onClearFilters: () => void
}) {
  const lanes = useMemo(() => groupCampaignLanes(items), [items])
  const months = [shiftMonth(month, -1), month, shiftMonth(month, 1)]
  const windowStart = `${months[0]}-01`
  const windowEnd = `${shiftMonth(months[2], 1)}-01`
  const startNumber = dayNumber(windowStart)
  const windowLength = dayNumber(windowEnd) - startNumber
  const inWindow = (day: string) => day >= windowStart && day < windowEnd
  const windowCount = lanes.reduce((count, lane) => count + lane.rows.filter(item => inWindow(releaseDay(item.scheduled_for) ?? '')).length, 0)
  const navigate = (delta: number) => onMonthChange(shiftMonth(month, delta))

  const milestone = (item: MonthRelease) => {
    const day = releaseDay(item.scheduled_for)!
    const label = `${prettyDay(day)}${releaseTime(item.scheduled_for) ? `, ${releaseTime(item.scheduled_for)}` : ''} · ${item.channel.replace(/_/g, ' ')} · ${item.title} · ${milestoneState(item)}`
    return <button key={item.id} type="button" onClick={() => onOpen(item.id)} aria-label={`Open details: ${label}`}
      className="min-h-11 min-w-0 w-full rounded-md border border-blue-400/30 bg-blue-500/10 px-2 py-1.5 text-left text-xs text-foreground hover:bg-blue-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400">
      <span className="block font-semibold">{prettyDay(day)}{releaseTime(item.scheduled_for) ? ` · ${releaseTime(item.scheduled_for)}` : ''} · {item.channel.replace(/_/g, ' ')}</span>
      <span className="block break-words">{item.title}</span>
      <span className="block text-muted-foreground">{item.campaign_phase} · {milestoneState(item)}</span>
    </button>
  }

  return <section aria-label="Release Gantt" className="min-w-0">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-base font-semibold" aria-live="polite">Campaign timeline · {monthName(month)}</h3>
      <div className="flex flex-wrap gap-2" aria-label="Timeline navigation">
        <button type="button" onClick={() => navigate(-1)} className={styles.monthControl}>Previous window</button>
        <button type="button" onClick={() => onMonthChange(currentMonth())} className={styles.monthControl}>Today</button>
        <button type="button" onClick={() => navigate(1)} className={styles.monthControl}>Next window</button>
      </div>
    </div>
    <p className="mb-3 text-xs text-muted-foreground">{windowCount} of {items.length} filtered releases in this three-month window · America/New_York.</p>
    {windowCount === 0 ? <div className="mb-3 rounded-lg border border-border p-4 text-sm">
      <p>No releases match this window and the current filters.</p>
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={onClearFilters} className={styles.monthControl}>Clear filters</button><button type="button" onClick={() => onMonthChange(currentMonth())} className={styles.monthControl}>Go to current window</button></div>
    </div> : null}
    <div className={styles.ganttDesktop}>
      <div className={styles.ganttAxis}><span>Campaign</span><div className={styles.ganttMonths}>{months.map(value => <span key={value}>{monthName(value)}</span>)}</div></div>
      {lanes.map(lane => {
        const visible = lane.rows.filter(item => inWindow(releaseDay(item.scheduled_for) ?? ''))
        const channels = [...new Set(lane.rows.map(item => item.channel.replace(/_/g, ' ')))].join(', ')
        const phases = [...new Set(lane.rows.map(item => item.campaign_phase))].join(', ')
        const clippedStart = Math.max(0, dayNumber(lane.first) - startNumber)
        const clippedEnd = Math.min(windowLength, dayNumber(lane.last) - startNumber + 1)
        const intersects = clippedEnd > clippedStart
        return <div key={lane.key} className={styles.ganttLane}>
          <div className="min-w-0 p-3"><h4 className="break-words text-sm font-semibold">{lane.name}</h4><p className="mt-1 text-xs text-muted-foreground">{prettyDay(lane.first)}–{prettyDay(lane.last)} · {lane.rows.length} {lane.rows.length === 1 ? 'item' : 'items'}</p><p className="mt-1 break-words text-xs text-muted-foreground">{channels} · {phases}</p></div>
          <div className={styles.ganttTrack}>
            {intersects ? <div aria-hidden="true" className={styles.ganttSpan} style={{ left: `${100 * clippedStart / windowLength}%`, width: `${Math.max(2, 100 * (clippedEnd - clippedStart) / windowLength)}%` }} /> : null}
            {visible.length ? <div className={styles.ganttMilestones}>{months.map(value => <div key={value} className="grid min-w-0 content-start gap-1.5 p-1.5">{visible.filter(item => releaseDay(item.scheduled_for)?.startsWith(`${value}-`)).map(milestone)}</div>)}</div> : <p className="relative p-3 text-xs text-muted-foreground">No milestones in this window. Use timeline navigation to find this campaign’s dates.</p>}
          </div>
        </div>
      })}
    </div>
    <div className={styles.ganttMobile}>
      {lanes.map(lane => {
        const visible = lane.rows.filter(item => inWindow(releaseDay(item.scheduled_for) ?? ''))
        return <article key={lane.key} className="min-w-0 rounded-lg border border-border p-3">
          <h4 className="break-words text-sm font-semibold">{lane.name}</h4>
          <p className="mt-1 text-xs text-muted-foreground">{prettyDay(lane.first)}–{prettyDay(lane.last)} · {lane.rows.length} {lane.rows.length === 1 ? 'item' : 'items'}</p>
          <p className="mt-1 break-words text-xs text-muted-foreground">{[...new Set(lane.rows.map(item => item.channel.replace(/_/g, ' ')))].join(', ')} · {[...new Set(lane.rows.map(item => item.campaign_phase))].join(', ')}</p>
          <div className="mt-3 grid gap-2">{visible.length ? visible.map(milestone) : <p className="text-xs text-muted-foreground">No milestones in this window. Use timeline navigation to find this campaign’s dates.</p>}</div>
        </article>
      })}
    </div>
  </section>
}
