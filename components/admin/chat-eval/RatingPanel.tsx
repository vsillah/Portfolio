'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ThumbsUp, ThumbsDown, Save, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

interface Category {
  id: string
  name: string
  color: string
}

interface RatingPanelProps {
  sessionId: string
  currentRating?: 'good' | 'bad' | null
  currentNotes?: string
  currentTags?: string[]
  currentCategoryId?: string | null
  currentOpenCode?: string | null
  categories: Category[]
  onSave: (data: {
    rating: 'good' | 'bad' | null
    notes: string
    tags: string[]
    category_id: string | null
    open_code: string | null
  }) => Promise<void>
  onNavigate?: (direction: 'prev' | 'next') => void
  canNavigatePrev?: boolean
  canNavigateNext?: boolean
}

export function RatingPanel({
  sessionId,
  currentRating,
  currentNotes = '',
  currentTags = [],
  currentCategoryId,
  currentOpenCode,
  categories,
  onSave,
  onNavigate,
  canNavigatePrev = false,
  canNavigateNext = false,
}: RatingPanelProps) {
  const [rating, setRating] = useState<'good' | 'bad' | null>(currentRating || null)
  const [notes, setNotes] = useState(currentNotes)
  const [tags, setTags] = useState<string[]>(currentTags)
  const [tagInput, setTagInput] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(currentCategoryId || null)
  const [openCode, setOpenCode] = useState(currentOpenCode || '')
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const handleSave = async () => {
    setIsSaving(true)
    setSaveStatus('idle')
    
    try {
      await onSave({
        rating,
        notes,
        tags,
        category_id: categoryId,
        open_code: openCode || null,
      })
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      setSaveStatus('error')
      console.error('Error saving evaluation:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  return (
    <div className="bg-silicon-slate/20 border border-radiant-gold/10 rounded-xl p-4 space-y-4">
      {/* Rating Buttons */}
      <div>
        <label className="text-xs font-heading text-platinum-white/60 uppercase tracking-wider mb-2 block">
          Rate Conversation
        </label>
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setRating('good')}
            className={`
              flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg
              font-heading text-sm uppercase tracking-wider transition-all
              ${rating === 'good' 
                ? 'bg-emerald-500 text-white' 
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
              }
            `}
          >
            <ThumbsUp size={16} />
            Good
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setRating('bad')}
            className={`
              flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg
              font-heading text-sm uppercase tracking-wider transition-all
              ${rating === 'bad' 
                ? 'bg-red-500 text-white' 
                : 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20'
              }
            `}
          >
            <ThumbsDown size={16} />
            Bad
          </motion.button>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs font-heading text-platinum-white/60 uppercase tracking-wider mb-2 block">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add your notes here..."
          className="w-full h-24 p-3 bg-silicon-slate/30 border border-radiant-gold/10 rounded-lg
            text-sm text-platinum-white placeholder-platinum-white/30
            focus:outline-none focus:border-radiant-gold/30 resize-none"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="text-xs font-heading text-platinum-white/60 uppercase tracking-wider mb-2 block">
          Add Tags
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            placeholder="Type and press Enter"
            className="flex-1 px-3 py-2 bg-silicon-slate/30 border border-radiant-gold/10 rounded-lg
              text-sm text-platinum-white placeholder-platinum-white/30
              focus:outline-none focus:border-radiant-gold/30"
          />
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map(tag => (
              <span
                key={tag}
                className="px-2 py-1 bg-radiant-gold/10 border border-radiant-gold/20 rounded text-xs text-radiant-gold
                  cursor-pointer hover:bg-radiant-gold/20"
                onClick={() => handleRemoveTag(tag)}
              >
                {tag} ×
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Category (shown when rating is 'bad') */}
      {rating === 'bad' && (
        <div>
          <label className="text-xs font-heading text-platinum-white/60 uppercase tracking-wider mb-2 block">
            Issue Category
          </label>
          <select
            value={categoryId || ''}
            onChange={(e) => setCategoryId(e.target.value || null)}
            className="w-full px-3 py-2 bg-silicon-slate/30 border border-radiant-gold/10 rounded-lg
              text-sm text-platinum-white focus:outline-none focus:border-radiant-gold/30"
          >
            <option value="">Select a category...</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Open Code (shown when rating is 'bad') */}
      {rating === 'bad' && (
        <div>
          <label className="text-xs font-heading text-platinum-white/60 uppercase tracking-wider mb-2 block">
            Open Code
          </label>
          <input
            type="text"
            value={openCode}
            onChange={(e) => setOpenCode(e.target.value)}
            placeholder="Enter custom issue code..."
            className="w-full px-3 py-2 bg-silicon-slate/30 border border-radiant-gold/10 rounded-lg
              text-sm text-platinum-white placeholder-platinum-white/30
              focus:outline-none focus:border-radiant-gold/30"
          />
          <p className="text-xs text-platinum-white/40 mt-1">
            Use for issues that don't fit existing categories
          </p>
        </div>
      )}

      {/* Save Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleSave}
        disabled={isSaving}
        className={`
          w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg
          font-heading text-sm uppercase tracking-wider transition-all
          ${saveStatus === 'success' 
            ? 'bg-emerald-500 text-white' 
            : saveStatus === 'error'
              ? 'bg-red-500 text-white'
              : 'bg-radiant-gold text-imperial-navy hover:bg-radiant-gold/90'
          }
          ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {isSaving ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Save size={16} />
        )}
        {saveStatus === 'success' ? 'Saved!' : saveStatus === 'error' ? 'Error' : 'Update Annotation'}
      </motion.button>

      {/* Navigation */}
      {onNavigate && (
        <div className="flex gap-2 pt-2 border-t border-radiant-gold/10">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onNavigate('prev')}
            disabled={!canNavigatePrev}
            className={`
              flex-1 flex items-center justify-center gap-1 py-2 px-3 rounded-lg
              border border-radiant-gold/20 text-sm
              ${canNavigatePrev 
                ? 'text-platinum-white hover:bg-radiant-gold/10' 
                : 'text-platinum-white/30 cursor-not-allowed'
              }
            `}
          >
            <ChevronLeft size={16} />
            Back
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onNavigate('next')}
            disabled={!canNavigateNext}
            className={`
              flex-1 flex items-center justify-center gap-1 py-2 px-3 rounded-lg
              border border-radiant-gold/20 text-sm
              ${canNavigateNext 
                ? 'text-platinum-white hover:bg-radiant-gold/10' 
                : 'text-platinum-white/30 cursor-not-allowed'
              }
            `}
          >
            Next
            <ChevronRight size={16} />
          </motion.button>
        </div>
      )}
    </div>
  )
}
