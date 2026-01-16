'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface ExpandableTextProps {
  text: string
  maxHeight?: number // Default 80px (~4 lines)
  className?: string
  expandButtonColor?: string // Tailwind color class for the expand button
}

export default function ExpandableText({
  text,
  maxHeight = 80,
  className = 'text-gray-400 text-sm',
  expandButtonColor = 'text-blue-400 hover:text-blue-300',
}: ExpandableTextProps) {
  const textRef = useRef<HTMLParagraphElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    const checkOverflow = () => {
      if (textRef.current) {
        setIsOverflowing(textRef.current.scrollHeight > maxHeight)
      }
    }

    checkOverflow()

    // Re-check on resize
    const resizeObserver = new ResizeObserver(checkOverflow)
    if (textRef.current) {
      resizeObserver.observe(textRef.current)
    }

    return () => resizeObserver.disconnect()
  }, [text, maxHeight])

  return (
    <div className="mb-4">
      <div className="relative">
        <motion.div
          initial={false}
          animate={{ 
            height: isExpanded ? 'auto' : maxHeight,
          }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <p 
            ref={textRef}
            className={className}
          >
            {text}
          </p>
        </motion.div>
        
        {/* Gradient fade overlay when collapsed and overflowing */}
        <AnimatePresence>
          {!isExpanded && isOverflowing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-900/90 to-transparent pointer-events-none"
            />
          )}
        </AnimatePresence>
      </div>
      
      {/* Read more / Show less button */}
      {isOverflowing && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center gap-1 mt-2 text-xs font-medium transition-colors ${expandButtonColor}`}
        >
          {isExpanded ? (
            <>
              <span>Show less</span>
              <ChevronUp size={14} />
            </>
          ) : (
            <>
              <span>Read more</span>
              <ChevronDown size={14} />
            </>
          )}
        </button>
      )}
    </div>
  )
}
