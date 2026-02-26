'use client'

import { ArrowUp } from 'lucide-react'

interface BackToTopLinkProps {
  anchorId: string
  className?: string
}

export default function BackToTopLink({ anchorId, className = '' }: BackToTopLinkProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth' })
  }
  return (
    <a
      href={`#${anchorId}`}
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 text-sm font-heading text-radiant-gold hover:text-gold-light transition-colors uppercase tracking-widest ${className}`}
    >
      <ArrowUp size={14} />
      Back to top
    </a>
  )
}
