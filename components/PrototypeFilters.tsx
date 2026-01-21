'use client'

import { motion } from 'framer-motion'
import { Filter, X } from 'lucide-react'

interface PrototypeFiltersProps {
  stageFilter: string | null
  channelFilter: string | null
  typeFilter: string | null
  onStageChange: (value: string | null) => void
  onChannelChange: (value: string | null) => void
  onTypeChange: (value: string | null) => void
}

export default function PrototypeFilters({
  stageFilter,
  channelFilter,
  typeFilter,
  onStageChange,
  onChannelChange,
  onTypeChange,
}: PrototypeFiltersProps) {
  const stages = ['Dev', 'QA', 'Pilot', 'Production']
  const channels = ['Web', 'Mobile']
  const types = ['Utility', 'Experience']

  const hasActiveFilters = stageFilter || channelFilter || typeFilter

  const clearAllFilters = () => {
    onStageChange(null)
    onChannelChange(null)
    onTypeChange(null)
  }

  const FilterGroup = ({ label, items, active, onChange }: any) => (
    <div className="space-y-3">
      <p className="text-[10px] font-heading tracking-[0.2em] uppercase text-platinum-white/30">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item: string) => (
          <button
            key={item}
            onClick={() => onChange(active === item ? null : item)}
            className={`px-4 py-1.5 rounded-full text-[10px] font-heading tracking-wider uppercase transition-all duration-300 border ${
              active === item
                ? 'bg-radiant-gold text-imperial-navy border-radiant-gold shadow-lg shadow-radiant-gold/20'
                : 'bg-transparent text-platinum-white/60 border-platinum-white/10 hover:border-platinum-white/30'
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-8 border-radiant-gold/5"
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Filter className="text-radiant-gold w-3 h-3" />
          <h3 className="text-[10px] font-heading tracking-[0.3em] uppercase text-platinum-white/80">Refine Selection</h3>
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-2 text-[10px] font-heading tracking-widest uppercase text-platinum-white/40 hover:text-radiant-gold transition-colors"
          >
            <X size={12} />
            <span>Reset</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        <FilterGroup label="Production Stage" items={stages} active={stageFilter} onChange={onStageChange} />
        <FilterGroup label="Channel" items={channels} active={channelFilter} onChange={onChannelChange} />
        <FilterGroup label="Product Type" items={types} active={typeFilter} onChange={onTypeChange} />
      </div>
    </motion.div>
  )
}
