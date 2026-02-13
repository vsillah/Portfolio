'use client'

import { useEffect, useRef, useId } from 'react'
import mermaid from 'mermaid'

interface MermaidDiagramProps {
  code: string
}

export default function MermaidDiagram({ code }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const id = useId().replace(/:/g, '-')

  useEffect(() => {
    if (!containerRef.current || !code.trim()) return

    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
    })

    const run = async () => {
      try {
        const { svg } = await mermaid.render(`mermaid-${id}`, code.trim())
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

  return (
    <div
      ref={containerRef}
      className="my-6 flex justify-center overflow-x-auto rounded-lg bg-gray-900/50 p-4 [&>svg]:max-w-full"
      suppressHydrationWarning
    />
  )
}
