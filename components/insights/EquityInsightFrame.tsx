'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'

type EquityInsightFrameProps = {
  slug: 'compounding-graph' | 'home-front-ledger' | 'owning-the-block'
  title: string
}

export default function EquityInsightFrame({ slug, title }: EquityInsightFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const [height, setHeight] = useState(0)
  const { resolvedTheme } = useTheme()

  const syncFrame = useCallback(() => {
    const frame = frameRef.current
    const doc = frame?.contentDocument
    if (!frame || !doc?.body) return

    // The authored dashboards already support data-theme where a light design exists.
    // Owning the Block remains its original dark illustration in either site theme.
    if (resolvedTheme === 'light' || resolvedTheme === 'dark') {
      doc.documentElement.dataset.theme = resolvedTheme
    }
    const contentHeight = Math.max(
      doc.documentElement.scrollHeight,
      doc.body.scrollHeight,
      doc.documentElement.offsetHeight,
      doc.body.offsetHeight,
    )
    setHeight(contentHeight)
  }, [resolvedTheme])

  const handleLoad = useCallback(() => {
    observerRef.current?.disconnect()
    const doc = frameRef.current?.contentDocument
    if (!doc?.body) return
    syncFrame()
    const observer = new ResizeObserver(syncFrame)
    observer.observe(doc.documentElement)
    observer.observe(doc.body)
    observerRef.current = observer
  }, [syncFrame])

  useEffect(() => {
    syncFrame()
  }, [syncFrame])

  useEffect(() => () => observerRef.current?.disconnect(), [])

  return (
    <iframe
      ref={frameRef}
      title={title}
      src={`/insights/equity-code/${slug}.html`}
      onLoad={handleLoad}
      className="block w-full border-0"
      style={{ height: height ? `${height}px` : '100vh' }}
    />
  )
}
