import Link from 'next/link'
import type { ComponentType, ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'

type MetricIcon = ComponentType<{ className?: string }>

interface AdminMetricCardProps {
  label: string
  value: ReactNode
  icon?: MetricIcon
  href?: string
  description?: string
  labelClassName?: string
  className?: string
  testId?: string
}

export default function AdminMetricCard({
  label,
  value,
  icon: Icon,
  href,
  description,
  labelClassName = 'text-muted-foreground',
  className = '',
  testId,
}: AdminMetricCardProps) {
  const content = (
    <>
      <div className={`flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] ${labelClassName}`}>
        {Icon ? <Icon className="h-3.5 w-3.5 text-accent" /> : null}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>{description ?? (href ? 'Open details' : 'Summary only')}</span>
        {href ? <ArrowRight className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" /> : null}
      </div>
    </>
  )

  const classes = `admin-console-metric rounded-lg border border-border bg-muted/40 p-3 text-left ${href ? 'admin-console-interactive block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background' : ''} ${className}`

  if (href) {
    if (href.startsWith('#')) {
      return (
        <a href={href} className={classes} aria-label={`${label}: ${String(value)}. ${description ?? 'Open details'}`} data-testid={testId}>
          {content}
        </a>
      )
    }
    return (
      <Link href={href} className={classes} aria-label={`${label}: ${String(value)}. ${description ?? 'Open details'}`} data-testid={testId}>
        {content}
      </Link>
    )
  }

  return <div className={classes} aria-label={`${label}: ${String(value)}. Summary only`} data-interactive="false" data-testid={testId}>{content}</div>
}
