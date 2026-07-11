'use client'

import { BarChart3, CheckCircle2, FileText, Layers3, LineChart, ShieldCheck, Workflow } from 'lucide-react'

type VisualMockupKind = 'product' | 'service'

interface PortfolioVisualMockupProps {
  kind: VisualMockupKind
  title: string
  eyebrow: string
  primaryLabel: string
  secondaryLabel: string
  items: string[]
  focusCodes?: string[]
}

function cleanItems(items: string[]) {
  const cleaned = items
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5)

  if (cleaned.length >= 3) return cleaned
  return [
    ...cleaned,
    'Discovery map',
    'Implementation plan',
    'Operator handoff',
  ].slice(0, 5)
}

function shortTitle(title: string) {
  return title.length > 54 ? `${title.slice(0, 51).trim()}...` : title
}

function buildSignalLabels(kind: VisualMockupKind, focusCodes: string[] = []) {
  const labels = kind === 'product'
    ? ['Asset map', 'Workflow', 'Launch kit']
    : ['Discovery', 'Delivery', 'Handoff']

  if (focusCodes.includes('weak_feature_signal')) labels[1] = 'Feature proof'
  if (focusCodes.includes('high_blank_space_ratio')) labels[2] = 'Dense frame'
  if (focusCodes.includes('wrong_aspect_ratio')) labels[0] = 'Homepage crop'
  return labels
}

export default function PortfolioVisualMockup({
  kind,
  title,
  eyebrow,
  primaryLabel,
  secondaryLabel,
  items,
  focusCodes = [],
}: PortfolioVisualMockupProps) {
  const artifactItems = cleanItems(items)
  const signalLabels = buildSignalLabels(kind, focusCodes)
  const metricOne = kind === 'product' ? 'Ready' : 'Scoped'
  const metricTwo = kind === 'product' ? '3 steps' : '90 days'
  const metricThree = kind === 'product' ? 'Reusable' : 'Handoff'

  return (
    <div className="relative h-full overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(212,175,55,0.16),rgba(44,62,80,0.08)_38%,rgba(234,236,238,0.18))] dark:bg-[linear-gradient(145deg,rgba(212,175,55,0.18),rgba(18,30,49,0.88)_40%,rgba(44,62,80,0.74))]" />
      <div className="relative grid h-full grid-cols-[132px_1fr]">
        <aside className="flex min-h-0 flex-col border-r border-border bg-card/80 p-3">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-radiant-gold" />
            <span className="text-[9px] font-bold uppercase text-muted-foreground">AmaduTown</span>
          </div>
          <div className="space-y-2">
            {signalLabels.map((label, index) => (
              <div
                key={label}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-semibold ${
                  index === 1
                    ? 'border-radiant-gold/50 bg-radiant-gold/15 text-radiant-gold'
                    : 'border-border bg-background/60 text-muted-foreground'
                }`}
              >
                {index === 0 && <Layers3 className="h-3.5 w-3.5" />}
                {index === 1 && <Workflow className="h-3.5 w-3.5" />}
                {index === 2 && <ShieldCheck className="h-3.5 w-3.5" />}
                {label}
              </div>
            ))}
          </div>
          <div className="mt-auto rounded-lg border border-radiant-gold/30 bg-radiant-gold/10 p-2">
            <p className="text-[8px] font-bold uppercase text-muted-foreground">{kind === 'product' ? 'Artifact' : 'Engagement'}</p>
            <p className="mt-0.5 text-base font-bold text-radiant-gold">{metricOne}</p>
          </div>
        </aside>

        <div className="min-w-0 p-3">
          <header className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[8px] font-bold uppercase text-radiant-gold">{eyebrow}</p>
              <h3 className="mt-0.5 text-lg font-bold leading-tight text-foreground">{shortTitle(title)}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right">
              <div className="rounded-md border border-border bg-card/85 px-2 py-1.5">
                <p className="text-[8px] uppercase text-muted-foreground">Mode</p>
                <p className="text-[11px] font-bold leading-tight text-foreground">{primaryLabel}</p>
              </div>
              <div className="rounded-md border border-border bg-card/85 px-2 py-1.5">
                <p className="text-[8px] uppercase text-muted-foreground">Signal</p>
                <p className="text-[11px] font-bold leading-tight text-foreground">{secondaryLabel}</p>
              </div>
            </div>
          </header>

          <div className="grid h-[calc(100%-50px)] grid-cols-[1.08fr_0.92fr] gap-3">
            <section className="min-w-0 rounded-lg border border-border bg-card/85 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-[8px] font-bold uppercase text-muted-foreground">Implementation board</p>
                  <p className="text-xs font-semibold text-foreground">What the buyer gets</p>
                </div>
                <LineChart className="h-4 w-4 text-radiant-gold" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['Capture', 'Build', 'Operate'].map((lane, laneIndex) => (
                  <div key={lane} className="rounded-md border border-border bg-background/70 p-2">
                    <p className="mb-1.5 text-[8px] font-bold uppercase text-muted-foreground">{lane}</p>
                    <div className="space-y-1.5">
                      {artifactItems.slice(0, 3).map((item, itemIndex) => (
                        <div
                          key={`${lane}-${item}`}
                          className={`line-clamp-2 rounded border px-1.5 py-1 text-[9px] font-semibold leading-tight ${
                            itemIndex === laneIndex
                              ? 'border-radiant-gold/50 bg-radiant-gold/15 text-foreground'
                              : 'border-border bg-card text-muted-foreground'
                          }`}
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[metricOne, metricTwo, metricThree].map((metric, index) => (
                  <div key={metric} className="rounded-md border border-border bg-background/70 p-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[8px] uppercase text-muted-foreground">Proof {index + 1}</span>
                      <BarChart3 className="h-3.5 w-3.5 text-radiant-gold" />
                    </div>
                    <p className="text-xs font-bold text-foreground">{metric}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="flex min-w-0 flex-col gap-3">
              <div className="rounded-lg border border-border bg-card/85 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[8px] font-bold uppercase text-muted-foreground">Handoff checklist</p>
                  <FileText className="h-4 w-4 text-radiant-gold" />
                </div>
                <div className="space-y-1.5">
                  {artifactItems.slice(0, 4).map((item) => (
                    <div key={item} className="flex items-start gap-1.5 rounded-md border border-border bg-background/70 px-2 py-1.5">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-none text-radiant-gold" />
                      <span className="line-clamp-1 text-[10px] font-semibold leading-tight text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-2">
                {[
                  { label: kind === 'product' ? 'Install' : 'Intake', value: '01' },
                  { label: kind === 'product' ? 'Adapt' : 'Session', value: '02' },
                  { label: kind === 'product' ? 'Ship' : 'Next step', value: '03' },
                  { label: 'Review gate', value: 'HITL' },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-radiant-gold/30 bg-radiant-gold/10 p-2">
                    <p className="text-[8px] font-bold uppercase text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-base font-bold text-radiant-gold">{item.value}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
