'use client'

import { useEffect, useState } from 'react'

export type CaptionSize = 'S' | 'M' | 'L'
export const CAPTION_SIZE_STORAGE_KEY = 'amadutown.caption-size.v1'
export const CAPTION_FONT_PX: Record<CaptionSize, number> = { S: 14, M: 17, L: 21 }

export const parseCaptionSize = (value: string | null): CaptionSize => value === 'S' || value === 'M' || value === 'L' ? value : 'M'

export function useCaptionSizePreference(): [CaptionSize, (size: CaptionSize) => void] {
  const [size, setSize] = useState<CaptionSize>('M')

  useEffect(() => {
    try { setSize(parseCaptionSize(localStorage.getItem(CAPTION_SIZE_STORAGE_KEY))) }
    catch { setSize('M') }
  }, [])

  const changeSize = (next: CaptionSize) => {
    setSize(next)
    try { localStorage.setItem(CAPTION_SIZE_STORAGE_KEY, next) }
    catch { /* Keep the selected size for this page when storage is unavailable. */ }
  }

  return [size, changeSize]
}
