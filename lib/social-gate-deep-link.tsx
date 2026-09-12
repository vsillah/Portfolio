'use client'

import { useEffect, type MutableRefObject } from 'react'

/** Resolve a selected gate only after its asynchronous page content is mounted. */
export function SocialGateDeepLinkLanding({
  routeId, itemId, gateId, completed,
}: {
  routeId: string
  itemId: string
  gateId: string
  completed: MutableRefObject<Set<string>>
}) {
  useEffect(() => {
    const path = `/admin/social-content/${encodeURIComponent(routeId)}`
    const hash = `#${gateId}`
    const key = `${path}${hash}`
    if (itemId !== routeId || window.location.pathname !== path || window.location.hash !== hash || completed.current.has(key)) return

    let cancelled = false
    let frame = 0
    // A gesture after rendering takes priority over the pending initial landing.
    const cancel = () => { cancelled = true; completed.current.add(key) }
    const keydown = (event: KeyboardEvent) => {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ', 'Tab'].includes(event.key)) cancel()
    }
    window.addEventListener('wheel', cancel, { passive: true })
    window.addEventListener('touchmove', cancel, { passive: true })
    window.addEventListener('keydown', keydown)
    frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        if (cancelled || window.location.pathname !== path || window.location.hash !== hash || completed.current.has(key)) return
        const gate = document.getElementById(gateId)
        if (!gate) return
        completed.current.add(key)
        // Instant overrides the site's global smooth scrolling for initial landing.
        gate.scrollIntoView({ behavior: 'instant', block: 'start' })
        const header = document.querySelector<HTMLElement>('[data-social-detail-header]')
        const headerRect = header?.getBoundingClientRect()
        const overlap = headerRect && headerRect.height > 0 ? headerRect.bottom + 12 - gate.getBoundingClientRect().top : 0
        if (overlap > 0) window.scrollBy({ top: -overlap, behavior: 'instant' })
        if (!gate.hasAttribute('tabindex')) gate.setAttribute('tabindex', '-1')
        gate.focus({ preventScroll: true })
      })
    })
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('wheel', cancel)
      window.removeEventListener('touchmove', cancel)
      window.removeEventListener('keydown', keydown)
    }
  }, [routeId, itemId, gateId, completed])
  return null
}
