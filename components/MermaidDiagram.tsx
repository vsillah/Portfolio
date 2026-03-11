'use client'

import { useEffect, useRef, useId, useState, useCallback } from 'react'
import mermaid from 'mermaid'

const MERMAID_THEME_VARS = {
  background: '#0f172a',
  primaryColor: '#1e3a5f',
  primaryTextColor: '#f5f5f5',
  primaryBorderColor: '#c9a84c',
  secondaryColor: '#1a2744',
  secondaryTextColor: '#f5f5f5',
  secondaryBorderColor: '#c9a84c80',
  tertiaryColor: '#162033',
  tertiaryTextColor: '#f5f5f5',
  tertiaryBorderColor: '#c9a84c60',
  lineColor: '#c9a84c',
  textColor: '#f5f5f5',
  mainBkg: '#1e3a5f',
  nodeBorder: '#c9a84c',
  clusterBkg: '#0f172a',
  clusterBorder: '#c9a84c60',
  titleColor: '#f5f5f5',
  edgeLabelBackground: '#0f172a',
  nodeTextColor: '#f5f5f5',
}

function makeFullscreenSvg(svgHtml: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgHtml, 'image/svg+xml')
  const svg = doc.querySelector('svg')
  if (!svg) return svgHtml

  const origWidth = svg.getAttribute('width')
  const origHeight = svg.getAttribute('height')

  if (!svg.getAttribute('viewBox') && origWidth && origHeight) {
    const w = parseFloat(origWidth)
    const h = parseFloat(origHeight)
    if (w && h) svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
  }

  svg.removeAttribute('width')
  svg.removeAttribute('height')
  svg.removeAttribute('style')
  svg.setAttribute('width', '90vw')
  svg.setAttribute('height', '85vh')
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')

  return svg.outerHTML
}

interface MermaidDiagramProps {
  code: string
}

export default function MermaidDiagram({ code }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const id = useId().replace(/:/g, '-')
  const [svgHtml, setSvgHtml] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (!containerRef.current || !code.trim()) return

    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      securityLevel: 'loose',
      themeVariables: MERMAID_THEME_VARS,
    })

    const run = async () => {
      try {
        const { svg } = await mermaid.render(`mermaid-${id}`, code.trim())
        setSvgHtml(svg)
        if (containerRef.current) {
          containerRef.current.innerHTML = svg
        }
      } catch (err) {
        console.error('Mermaid render error:', err)
        if (containerRef.current) {
          containerRef.current.innerHTML = `<pre class="text-red-400 text-sm p-4 bg-red-950/30 rounded">Mermaid diagram failed to render.</pre>`
        }
      }
    }

    run()
  }, [code, id])

  const openFullscreen = useCallback(() => setIsFullscreen(true), [])
  const closeFullscreen = useCallback(() => setIsFullscreen(false), [])

  useEffect(() => {
    if (!isFullscreen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeFullscreen()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [isFullscreen, closeFullscreen])

  return (
    <>
      <div className="group relative my-6 rounded-lg bg-[#0f172a] border border-[#c9a84c]/20 p-4">
        <div
          ref={containerRef}
          className="flex justify-center overflow-x-auto [&>svg]:max-w-full"
          suppressHydrationWarning
        />
        {svgHtml && (
          <button
            onClick={openFullscreen}
            className="absolute top-3 right-3 rounded-md bg-[#1e3a5f] border border-[#c9a84c]/40 px-2.5 py-1.5 text-xs text-platinum-white/80 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[#2a4d7a] hover:text-white"
            title="View fullscreen"
          >
            <span className="mr-1">⛶</span> Expand
          </button>
        )}
      </div>

      {isFullscreen && svgHtml && (
        <div
          className="fixed inset-0 z-50 bg-[#0f172a] overflow-auto"
          onClick={closeFullscreen}
        >
          <button
            onClick={closeFullscreen}
            className="fixed top-4 right-4 z-[60] rounded-md bg-[#1e3a5f] border border-[#c9a84c]/40 px-3 py-1.5 text-sm text-platinum-white hover:bg-[#2a4d7a] transition-colors"
          >
            ✕ Close <span className="ml-1 text-platinum-white/50 text-xs">Esc</span>
          </button>
          <div
            className="min-h-full min-w-full flex items-center justify-center p-8"
            onClick={(e) => e.stopPropagation()}
            dangerouslySetInnerHTML={{ __html: makeFullscreenSvg(svgHtml) }}
          />
        </div>
      )}
    </>
  )
}
