'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react'
import type { ShowcaseFrame } from '@/lib/showcase-preview'

interface ShowcaseCarouselProps {
  frames: readonly ShowcaseFrame[]
  title: string
  fallbackUrl?: string | null
  imageHref?: string
}

export default function ShowcaseCarousel({ frames, title, fallbackUrl, imageHref }: ShowcaseCarouselProps) {
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState<string[]>([])
  const touchStart = useRef<number | null>(null)
  const swallowedClick = useRef(false)
  const current = frames[index]
  const hasControls = frames.length > 1
  const imageUrl = failed.includes(current?.imageUrl) ? fallbackUrl : current?.imageUrl
  const showImage = Boolean(imageUrl) && !failed.includes(imageUrl!)

  const select = (next: number) => setIndex((next + frames.length) % frames.length)
  const control = (event: React.MouseEvent, next: number) => {
    event.preventDefault()
    event.stopPropagation()
    select(next)
  }

  return (
    <div
      className="relative z-20"
      data-testid="showcase-carousel"
      onClickCapture={(event) => {
        if (swallowedClick.current) {
          event.preventDefault()
          event.stopPropagation()
          swallowedClick.current = false
        }
      }}
      onKeyDown={(event) => {
        if (!hasControls || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
        event.preventDefault()
        event.stopPropagation()
        select(index + (event.key === 'ArrowRight' ? 1 : -1))
      }}
      onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null }}
      onTouchEnd={(event) => {
        if (!hasControls || touchStart.current === null) return
        const difference = touchStart.current - (event.changedTouches[0]?.clientX ?? touchStart.current)
        touchStart.current = null
        if (Math.abs(difference) < 45) return
        swallowedClick.current = true
        window.setTimeout(() => { swallowedClick.current = false }, 350)
        select(index + (difference > 0 ? 1 : -1))
      }}
      tabIndex={hasControls ? 0 : undefined}
      role={hasControls ? 'group' : undefined}
      aria-label={hasControls ? `${title} image gallery` : undefined}
    >
      <div className="relative aspect-[5/3] w-full overflow-hidden bg-[#101c2d]">
        {showImage ? (
          <Image
            key={imageUrl}
            src={imageUrl!}
            alt={current?.alt || title}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 400px"
            onError={() => setFailed((previous) => previous.includes(imageUrl!) ? previous : [...previous, imageUrl!])}
          />
        ) : (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-white/70" role="img" aria-label={`${title} image unavailable`}>
            <ImageOff size={20} aria-hidden="true" /> Image unavailable
          </div>
        )}
        {imageHref && <Link href={imageHref} aria-label={`View ${title}`} className="absolute inset-0 focus-visible:outline-2 focus-visible:outline-radiant-gold" />}
      </div>
      {hasControls && (
        <div className="relative z-20 flex min-h-12 items-center justify-between gap-2 border-b border-[#121E31]/10 bg-white px-3 dark:border-radiant-gold/10 dark:bg-[#17263d]">
          <button type="button" onClick={(event) => control(event, index - 1)} title="Previous image" aria-label={`Previous image for ${title}`} className="rounded-full p-2 text-[#263d59] hover:bg-[#e9eef5] focus-visible:outline-2 focus-visible:outline-radiant-gold dark:text-white dark:hover:bg-white/10">
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <div className="flex items-center gap-2" aria-label={`Image ${index + 1} of ${frames.length}`}>
            {frames.map((frame, dot) => (
              <button key={`${frame.role}-${dot}`} type="button" onClick={(event) => control(event, dot)} title={`Show ${frame.role}`} aria-label={`Show ${frame.role} image for ${title}`} aria-current={dot === index ? 'true' : undefined} className={`h-2.5 rounded-full transition-[width,background-color] motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-radiant-gold ${dot === index ? 'w-7 bg-[#9c7720]' : 'w-2.5 bg-[#8796a8] hover:bg-[#6b7c91]'}`} />
            ))}
          </div>
          <button type="button" onClick={(event) => control(event, index + 1)} title="Next image" aria-label={`Next image for ${title}`} className="rounded-full p-2 text-[#263d59] hover:bg-[#e9eef5] focus-visible:outline-2 focus-visible:outline-radiant-gold dark:text-white dark:hover:bg-white/10">
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      )}
      {hasControls && <p className="sr-only" aria-live="polite">{current.role}, image {index + 1} of {frames.length}</p>}
      {current && <p className="border-b border-radiant-gold/10 bg-[#17263d] px-3 py-2 text-xs text-white/80" aria-live="polite">{current.label ? `${current.label} · ` : ''}{current.role} · {current.status}</p>}
    </div>
  )
}
