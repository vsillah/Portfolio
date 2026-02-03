'use client'

import { motion } from 'framer-motion'
import { Mic, Mail, MessageCircle, Bot, RotateCcw, Plus } from 'lucide-react'

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
}

export function FilterSidebar({
  selectedChannel,
  selectedRating,
  onChannelChange,
  onRatingChange,
  onReset,
  onAddToQueue,
  stats,
}: FilterSidebarProps) {
  const channelFilters = [
    { id: 'voice', label: 'Voice', icon: Mic, color: 'purple' },
    { id: 'email', label: 'Email', icon: Mail, color: 'blue' },
    { id: 'text', label: 'Text', icon: MessageCircle, color: 'emerald' },
    { id: 'chatbot', label: 'Chatbot', icon: Bot, color: 'orange' },
  ]

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
          Select a required filter to load Runs
        </p>
        <div className="space-y-2">
          {channelFilters.map(filter => {
            const Icon = filter.icon
            const isSelected = selectedChannel === filter.id
            return (
              <motion.button
                key={filter.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onChannelChange(isSelected ? null : filter.id)}
                className={`
                  w-full flex items-center gap-3 py-2.5 px-4 rounded-lg
                  border transition-all text-sm
                  ${isSelected 
                    ? 'bg-silicon-slate border-radiant-gold/50 text-platinum-white' 
                    : 'bg-silicon-slate/20 border-radiant-gold/10 text-platinum-white/70 hover:border-radiant-gold/30'
                  }
                `}
              >
                <Icon size={16} />
                {filter.label}
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
            return (
              <motion.button
                key={filter.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onRatingChange(isSelected ? null : filter.id)}
                className={`
                  w-full py-2.5 px-4 rounded-lg border transition-all text-sm text-left
                  ${isSelected 
                    ? 'bg-silicon-slate border-radiant-gold/50 text-platinum-white' 
                    : 'bg-silicon-slate/20 border-radiant-gold/10 text-platinum-white/70 hover:border-radiant-gold/30'
                  }
                `}
              >
                {filter.label}
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
                w-full py-2.5 px-4 rounded-lg border transition-all text-sm
                ${isSelected 
                  ? selectedColorClass
                  : `bg-transparent ${colorClass} hover:bg-${filter.color}-500/5`
                }
              `}
            >
              {filter.label}
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
