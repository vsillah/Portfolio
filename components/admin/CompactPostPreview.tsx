'use client'

import { useId, useState } from 'react'

/** Presentation only: the full saved/editor copy remains available to the reader. */
export default function CompactPostPreview({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  const long = text.length > 480
  const excerpt = long ? `${text.slice(0, 480).trimEnd()}…` : text
  return <div className="mb-3 min-w-0">
    <p id={id} className="whitespace-pre-wrap text-sm leading-relaxed text-gray-200 [overflow-wrap:anywhere]">{expanded ? text : excerpt}</p>
    {long && <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)} className="mt-2 min-h-11 rounded-lg border border-gray-600 px-3 py-2 text-sm text-blue-200 hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-300">
      {expanded ? 'Collapse post preview' : 'Read complete post'}
    </button>}
  </div>
}
