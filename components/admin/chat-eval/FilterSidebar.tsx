'use client'

import { motion } from 'framer-motion'
import { Mic, Mail, MessageCircle, Bot, RotateCcw, Plus } from 'lucide-react'

export interface FilterCounts {
  channel: { voice: number; text: number; email: number; chatbot: number }
  annotated: number
  unannotated: number
  good: number
  bad: number
}

interface FilterSidebarProps {
  selectedChannel: string | null
  selectedRating: string | null
  onChannelChange: (channel: string | null) => void
  onRatingChange: (rating: string | null) => void
  onReset: () => void
  onAddToQueue?: () => void
  stats?: {
    total_sessions: number
    success_rate: number
  }
  /** Counts per filter option (from GET /api/admin/chat-eval/counts). When set, each filter shows its count. */
  filterCounts?: FilterCounts | null
}

export function FilterSidebar({
  selectedChannel,
  selectedRating,
  onChannelChange,
  onRatingChange,
  onReset,
  onAddToQueue,
  stats,
  filterCounts,
}: FilterSidebarProps) {
  const channelFilters = [
    { id: 'voice', label: 'Voice', icon: Mic, color: 'purple', title: 'Website voice component' },
    { id: 'email', label: 'Email', icon: Mail, color: 'blue', title: 'Email channel' },
    { id: 'text', label: 'Text (SMS)', icon: MessageCircle, color: 'emerald', title: 'Reserved for future SMS channel' },
    { id: 'chatbot', label: 'Chatbot', icon: Bot, color: 'orange', title: 'Website chat component' },
  ]
  const getChannelCount = (id: string) => filterCounts?.channel?.[id as keyof typeof filterCounts.channel] ?? null

  const statusFilters = [
    { id: 'annotated', label: 'Already Annotated' },
    { id: 'unannotated', label: 'Not Yet Annotated' },
  ]

  const ratingFilters = [
    { id: 'good', label: 'Good', color: 'emerald' },
    { id: 'bad', label: 'Bad', color: 'red' },
  ]

  return (
    <div className="space-y-6">
      {/* Add to Queue Button */}
      {onAddToQueue && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onAddToQueue}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 
            bg-radiant-gold text-imperial-navy rounded-lg
            font-heading text-sm uppercase tracking-wider
            hover:bg-radiant-gold/90 transition-colors"
        >
          <Plus size={16} />
          Add To Queue
        </motion.button>
      )}

      {/* Required Filters - Channel */}
      <div>
        <h3 className="text-xs font-heading text-platinum-white/60 uppercase tracking-wider mb-2">
          Required Filters
        </h3>
        <p className="text-xs text-platinum-white/40 mb-3">
          Select a required filter to load Runs. Chatbot = website chat; Text = SMS (reserved).
        </p>
        <div className="space-y-2">
          {channelFilters.map(filter => {
            const Icon = filter.icon
            const isSelected = selectedChannel === filter.id
            return (
              <motion.button
                key={filter.id}
                title={filter.title}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onChannelChange(isSelected ? null : filter.id)}
                className={`
                  w-full flex items-center justify-between gap-3 py-2.5 px-4 rounded-lg
                  border transition-all text-sm
                  ${isSelected 
                    ? 'bg-silicon-slate border-radiant-gold/50 text-platinum-white' 
                    : 'bg-silicon-slate/20 border-radiant-gold/10 text-platinum-white/70 hover:border-radiant-gold/30'
                  }
                `}
              >
                <span className="flex items-center gap-3">
                  <Icon size={16} />
                  {filter.label}
                </span>
                {getChannelCount(filter.id) != null && (
                  <span className="text-platinum-white/50 tabular-nums">{getChannelCount(filter.id)}</span>
                )}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Status Filters */}
      <div>
        <h3 className="text-xs font-heading text-platinum-white/60 uppercase tracking-wider mb-3">
          Filters
        </h3>
        <div className="space-y-2">
          {statusFilters.map(filter => {
            const isSelected = selectedRating === filter.id
            const count = filter.id === 'annotated' ? filterCounts?.annotated : filterCounts?.unannotated
            return (
              <motion.button
                key={filter.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onRatingChange(isSelected ? null : filter.id)}
                className={`
                  w-full flex items-center justify-between py-2.5 px-4 rounded-lg border transition-all text-sm text-left
                  ${isSelected 
                    ? 'bg-silicon-slate border-radiant-gold/50 text-platinum-white' 
                    : 'bg-silicon-slate/20 border-radiant-gold/10 text-platinum-white/70 hover:border-radiant-gold/30'
                  }
                `}
              >
                {filter.label}
                {count != null && <span className="text-platinum-white/50 tabular-nums">{count}</span>}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Rating Filters */}
      <div className="space-y-2">
        {ratingFilters.map(filter => {
          const isSelected = selectedRating === filter.id
          const colorClass = filter.color === 'emerald' 
            ? 'border-emerald-500/50 text-emerald-400' 
            : 'border-red-500/50 text-red-400'
          const selectedColorClass = filter.color === 'emerald'
            ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
            : 'bg-red-500/10 border-red-500/50 text-red-400'
          
          return (
            <motion.button
              key={filter.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onRatingChange(isSelected ? null : filter.id)}
              className={`
                w-full flex items-center justify-between py-2.5 px-4 rounded-lg border transition-all text-sm
                ${isSelected 
                  ? selectedColorClass
                  : `bg-transparent ${colorClass} hover:bg-${filter.color}-500/5`
                }
              `}
            >
              {filter.label}
              {filter.id === 'good' && filterCounts?.good != null && (
                <span className="opacity-80 tabular-nums">{filterCounts.good}</span>
              )}
              {filter.id === 'bad' && filterCounts?.bad != null && (
                <span className="opacity-80 tabular-nums">{filterCounts.bad}</span>
              )}
            </motion.button>
          )
        })}
      </div>

      {/* Reset Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onReset}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 
          bg-blue-500 text-white rounded-lg
          font-heading text-sm uppercase tracking-wider
          hover:bg-blue-600 transition-colors"
      >
        <RotateCcw size={16} />
        Reset
      </motion.button>
    </div>
  )
}
