'use client'

import { motion } from 'framer-motion'
import { useRef, useState } from 'react'

interface MagneticButtonProps {
  children: React.ReactNode
  className?: string
}

export const MagneticButton = ({ children, className = "" }: MagneticButtonProps) => {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const handleMouse = (e: React.MouseEvent) => {
    if (!ref.current) return
    const { clientX, clientY } = e
    const { height, width, left, top } = ref.current.getBoundingClientRect()
    const middleX = clientX - (left + width / 2)
    const middleY = clientY - (top + height / 2)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MagneticButton.tsx:handleMouse',message:'Mouse move calc',data:{clientX,clientY,rect:{height,width,left,top},middleX,middleY,newX:middleX*0.1,newY:middleY*0.1},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    // Clamp movement to prevent excessive drift (max 8px in any direction)
    const clampedX = Math.max(-8, Math.min(8, middleX * 0.1))
    const clampedY = Math.max(-8, Math.min(8, middleY * 0.1))
    setPosition({ x: clampedX, y: clampedY })
  }

  const reset = () => setPosition({ x: 0, y: 0 })

  // #region agent log
  if (typeof window !== 'undefined' && ref.current) {
    const rect = ref.current.getBoundingClientRect();
    fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MagneticButton.tsx:render',message:'Component dimensions',data:{className,width:rect.width,height:rect.height,position},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
  }
  // #endregion

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
      className={`block ${className}`}
      style={{ position: 'relative' }}
    >
      {children}
    </motion.div>
  )
}
