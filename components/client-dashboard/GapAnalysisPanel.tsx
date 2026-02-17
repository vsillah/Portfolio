'use client'

import type { GapAnalysis } from '@/lib/assessment-scoring'

interface GapAnalysisPanelProps {
  gaps: GapAnalysis[]
}

export default function GapAnalysisPanel({ gaps }: GapAnalysisPanelProps) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
        Gap Analysis: Current vs Dream Outcome
      </h3>
      <div className="space-y-4">
        {gaps.map((gap) => (
          <div key={gap.category}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-gray-300">{gap.label}</span>
              <span className="text-xs text-gray-500">
                {gap.currentScore} / {gap.dreamScore}
              </span>
            </div>
            <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
              {/* Dream target marker */}
              <div
                className="absolute top-0 h-full w-0.5 bg-indigo-500 z-10"
                style={{ left: `${gap.dreamScore}%` }}
              />
              {/* Current score bar */}
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  gap.gap <= 15
                    ? 'bg-green-500'
                    : gap.gap <= 35
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                }`}
                style={{ width: `${gap.currentScore}%` }}
              />
            </div>
            {gap.gap > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {gap.gap} points to close ({gap.gapPercentage}% remaining)
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
