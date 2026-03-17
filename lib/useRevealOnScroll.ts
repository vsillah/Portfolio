'use client'

import { useEffect, useRef } from 'react'

/**
 * Lightweight replacement for framer-motion whileInView({ once: true }).
 * Adds 'is-visible' class when the element enters the viewport.
 * Pair with the `.reveal-on-scroll` CSS class in globals.css.
 */
export function useRevealOnScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible')
          observer.unobserve(el)
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return ref
}
