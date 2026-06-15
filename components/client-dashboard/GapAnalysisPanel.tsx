'use client'

import type { GapAnalysis } from '@/lib/assessment-scoring'

interface GapAnalysisPanelProps {
  gaps: GapAnalysis[]
}

export default function GapAnalysisPanel({ gaps }: GapAnalysisPanelProps) {
  return (
    <div className="rounded-lg border border-radiant-gold/15 bg-silicon-slate/35 p-5">
      <h3 className="text-sm font-medium text-radiant-gold uppercase tracking-wider mb-4">
        Gap Analysis: Current vs Dream Outcome
      </h3>
      <div className="space-y-4">
        {gaps.map((gap) => (
          <div key={gap.category}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-platinum-white/85">{gap.label}</span>
              <span className="text-xs text-platinum-white/50">
                {gap.currentScore} / {gap.dreamScore}
              </span>
            </div>
            <div className="relative h-3 bg-imperial-navy/70 rounded-full overflow-hidden border border-radiant-gold/10">
              {/* Dream target marker */}
              <div
                className="absolute top-0 h-full w-0.5 bg-gold-light z-10"
                style={{ left: `${gap.dreamScore}%` }}
              />
              {/* Current score bar */}
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  gap.gap <= 15
                    ? 'bg-gold-light'
                    : gap.gap <= 35
                      ? 'bg-radiant-gold'
                      : 'bg-bronze'
                }`}
                style={{ width: `${gap.currentScore}%` }}
              />
            </div>
            {gap.gap > 0 && (
              <p className="text-xs text-platinum-white/50 mt-1">
                {gap.gap} points to close ({gap.gapPercentage}% remaining)
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
