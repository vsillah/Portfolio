'use client'

import { useState } from 'react'
import { Code, MessageSquare, CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'

interface FixRecommendationProps {
  recommendation: {
    id: string
    type: 'prompt' | 'code'
    priority: 'high' | 'medium' | 'low'
    description: string
    changes: {
      target: string
      old_value?: string
      new_value: string
      can_auto_apply: boolean
    }
    application_instructions?: string
    approved?: boolean
  }
  isSelected?: boolean
  onSelect?: (selected: boolean) => void
  showCheckbox?: boolean
}

export function FixRecommendation({ 
  recommendation, 
  isSelected, 
  onSelect, 
  showCheckbox = false 
}: FixRecommendationProps) {
  const [showDiff, setShowDiff] = useState(false)

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-400 bg-red-500/20 border-red-500/30'
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30'
      case 'low':
        return 'text-blue-400 bg-blue-500/20 border-blue-500/30'
      default:
        return 'text-gray-400 bg-gray-500/20 border-gray-500/30'
    }
  }

  return (
    <div className={`p-5 rounded-xl border transition-all ${
      isSelected
        ? 'bg-radiant-gold/10 border-radiant-gold/50'
        : 'bg-silicon-slate/20 border-radiant-gold/10'
    }`}>
      <div className="flex items-start gap-4">
        {/* Checkbox for selection */}
        {showCheckbox && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect?.(e.target.checked)}
            className="mt-1 w-5 h-5 rounded border-radiant-gold/30 bg-silicon-slate/50"
          />
        )}

        <div className="flex-1">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              {recommendation.type === 'prompt' ? (
                <MessageSquare size={18} className="text-cyan-400" />
              ) : (
                <Code size={18} className="text-orange-400" />
              )}
              <h3 className="text-lg font-semibold">{recommendation.description}</h3>
              <span className={`px-2 py-0.5 rounded text-xs border ${getPriorityColor(recommendation.priority)}`}>
                {recommendation.priority}
              </span>
              {recommendation.approved && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs">
                  <CheckCircle size={12} />
                  Approved
                </span>
              )}
            </div>
          </div>

          {/* Target */}
          <div className="mb-3 text-sm">
            <span className="text-platinum-white/50">Target: </span>
            <span className="text-platinum-white font-mono">{recommendation.changes.target}</span>
          </div>

          {/* Diff view */}
          <div className="mb-3">
            <button
              onClick={() => setShowDiff(!showDiff)}
              className="text-sm text-radiant-gold hover:underline flex items-center gap-1"
            >
              {showDiff ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showDiff ? 'Hide' : 'Show'} Changes
            </button>
            {showDiff && (
              <div className="mt-2 p-3 bg-imperial-navy rounded border border-radiant-gold/20">
                {recommendation.changes.old_value && (
                  <div className="mb-2">
                    <div className="text-xs text-red-400 mb-1">Old Value:</div>
                    <pre className="text-xs text-platinum-white/70 bg-red-500/10 p-2 rounded overflow-x-auto">
                      {recommendation.changes.old_value}
                    </pre>
                  </div>
                )}
                <div>
                  <div className="text-xs text-emerald-400 mb-1">New Value:</div>
                  <pre className="text-xs text-platinum-white/70 bg-emerald-500/10 p-2 rounded overflow-x-auto">
                    {recommendation.changes.new_value}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Auto-apply indicator */}
          {recommendation.changes.can_auto_apply && (
            <div className="mb-3 flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle size={12} />
              Can be auto-applied
            </div>
          )}

          {/* Manual instructions */}
          {recommendation.application_instructions && (
            <div className="mt-3 p-3 bg-silicon-slate/30 rounded border border-radiant-gold/10">
              <div className="flex items-center gap-1 text-xs text-platinum-white/50 mb-1">
                <AlertTriangle size={12} />
                Manual Instructions:
              </div>
              <div className="text-sm text-platinum-white/80 whitespace-pre-wrap">
                {recommendation.application_instructions}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
