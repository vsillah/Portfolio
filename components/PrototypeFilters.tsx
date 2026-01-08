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

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 bg-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-gray-800"
    >
      <div className="flex items-center gap-4 mb-4">
        <Filter className="text-purple-400" size={20} />
        <h3 className="text-lg font-semibold text-white">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="ml-auto flex items-center gap-2 px-3 py-1 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <X size={16} />
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Production Stage Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Production Stage
          </label>
          <div className="flex flex-wrap gap-2">
            {stages.map((stage) => (
              <button
                key={stage}
                onClick={() => onStageChange(stageFilter === stage ? null : stage)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  stageFilter === stage
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {stage}
              </button>
            ))}
          </div>
        </div>

        {/* Channel Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Channel
          </label>
          <div className="flex flex-wrap gap-2">
            {channels.map((channel) => (
              <button
                key={channel}
                onClick={() => onChannelChange(channelFilter === channel ? null : channel)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  channelFilter === channel
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {channel}
              </button>
            ))}
          </div>
        </div>

        {/* Product Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Product Type
          </label>
          <div className="flex flex-wrap gap-2">
            {types.map((type) => (
              <button
                key={type}
                onClick={() => onTypeChange(typeFilter === type ? null : type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  typeFilter === type
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
