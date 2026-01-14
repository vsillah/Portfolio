// Exit intent detection utilities

export function detectExitIntent(callback: () => void) {
  if (typeof window === 'undefined') return () => {}

  let mouseY = 0

  const handleMouseMove = (e: MouseEvent) => {
    mouseY = e.clientY
  }

  const handleMouseLeave = (e: MouseEvent) => {
    // Only trigger if mouse is moving upward (toward top of viewport)
    if (mouseY < 10 && e.clientY < 10) {
      callback()
    }
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseleave', handleMouseLeave)

  return () => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseleave', handleMouseLeave)
  }
}

export function detectScrollPercentage(callback: (percentage: number) => void) {
  if (typeof window === 'undefined') return () => {}

  const handleScroll = () => {
    const windowHeight = window.innerHeight
    const documentHeight = document.documentElement.scrollHeight
    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const scrollPercentage = (scrollTop / (documentHeight - windowHeight)) * 100
    callback(scrollPercentage)
  }

  window.addEventListener('scroll', handleScroll, { passive: true })

  return () => {
    window.removeEventListener('scroll', handleScroll)
  }
}

export function createTimer(callback: () => void, delay: number) {
  if (typeof window === 'undefined') return () => {}

  const timeoutId = setTimeout(callback, delay)

  return () => {
    clearTimeout(timeoutId)
  }
}
