'use client'

import { useEffect, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

const FALLBACK_MIN_HEIGHT = 144
const FALLBACK_MAX_HEIGHT = 512

function pixelValue(value: string, fallback: number) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function syncScriptEditorHeight(element: HTMLTextAreaElement) {
  const styles = getComputedStyle(element)
  const minHeight = pixelValue(styles.minHeight, FALLBACK_MIN_HEIGHT)
  const maxHeight = pixelValue(styles.maxHeight, FALLBACK_MAX_HEIGHT)

  element.style.height = '0px'
  const contentHeight = element.scrollHeight
  const nextHeight = Math.min(maxHeight, Math.max(minHeight, contentHeight))

  element.style.height = `${nextHeight}px`
  element.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden'
}

type AutoSizingScriptTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'> & {
  value: string
}

export default function AutoSizingScriptTextarea({ className = '', value, ...props }: AutoSizingScriptTextareaProps) {
  const editorRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    if (editorRef.current) syncScriptEditorHeight(editorRef.current)
  }, [value])

  useEffect(() => {
    const resize = () => {
      if (editorRef.current) syncScriptEditorHeight(editorRef.current)
    }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  return (
    <textarea
      {...props}
      ref={editorRef}
      value={value}
      rows={6}
      className={`min-h-36 max-h-80 resize-y overflow-y-hidden sm:max-h-96 lg:max-h-[32rem] ${className}`}
    />
  )
}
