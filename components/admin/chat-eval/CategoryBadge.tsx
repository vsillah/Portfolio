'use client'

import { motion } from 'framer-motion'

interface CategoryBadgeProps {
  name: string
  count?: number
  color?: string
  onClick?: () => void
  isSelected?: boolean
}

export function CategoryBadge({ 
  name, 
  count, 
  color = '#6B7280',
  onClick,
  isSelected,
}: CategoryBadgeProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
        text-sm transition-all
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
        ${isSelected ? 'ring-2 ring-offset-2 ring-offset-imperial-navy' : ''}
      `}
      style={{
        backgroundColor: `${color}15`,
        borderColor: `${color}40`,
        borderWidth: 1,
        color: color,
        ...(isSelected && { ringColor: color }),
      }}
    >
      <span className="truncate max-w-[200px]">{name}</span>
      {count !== undefined && (
        <span 
          className="px-1.5 py-0.5 rounded text-xs font-bold"
          style={{
            backgroundColor: color,
            color: '#121E31', // imperial-navy
          }}
        >
          {count}
        </span>
      )}
    </motion.button>
  )
}

interface CategoryBadgeListProps {
  categories: Array<{
    id?: string
    name: string
    count?: number
    color?: string
  }>
  selectedId?: string
  onSelect?: (id: string) => void
}

export function CategoryBadgeList({ categories, selectedId, onSelect }: CategoryBadgeListProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat, index) => (
        <CategoryBadge
          key={cat.id || index}
          name={cat.name}
          count={cat.count}
          color={cat.color}
          onClick={cat.id && onSelect ? () => onSelect(cat.id!) : undefined}
          isSelected={cat.id === selectedId}
        />
      ))}
    </div>
  )
}
