'use client'

import { useEffect } from 'react'
import { analytics } from '@/lib/analytics'

const TRACKED_SECTIONS = [
  'home', 'campaigns', 'products', 'services',
  'merchandise', 'publications', 'about', 'contact',
]

export default function HomeAnalytics() {
  useEffect(() => {
    analytics.pageView()
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.target.id) {
            analytics.sectionView(entry.target.id as Parameters<typeof analytics.sectionView>[0])
          }
        })
      },
      { root: null, rootMargin: '0px', threshold: 0.5 },
    )

    TRACKED_SECTIONS.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  return null
}
