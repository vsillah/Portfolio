import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SocialGateDeepLinkLanding } from './social-gate-deep-link'

describe('async selected gate deep link', () => {
  let frames: Map<number, FrameRequestCallback>
  let nextFrame: number
  let scroll: ReturnType<typeof vi.fn>
  const completed = { current: new Set<string>() }
  function flushFrames() {
    act(() => {
      for (let pass = 0; pass < 2; pass++) {
        const pending = [...frames.values()]; frames.clear()
        pending.forEach(callback => callback(0))
      }
    })
  }
  function view(ready: boolean, gateId = 'social-copy-gate', itemId = 'one') {
    return ready ? <><SocialGateDeepLinkLanding routeId="one" itemId={itemId} gateId={gateId} completed={completed} /><section id={gateId}><button>Edit final copy</button></section></> : <p>Loading</p>
  }
  beforeEach(() => {
    completed.current.clear(); frames = new Map(); nextFrame = 0
    scroll = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll })
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++nextFrame, callback); return nextFrame })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id) })
    window.history.replaceState({}, '', '/admin/social-content/one?step=copy#social-copy-gate')
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks(); window.history.replaceState({}, '', '/') })

  it('waits for delayed content, focuses once, and does not jump after refresh or user scrolling', () => {
    const page = render(view(false))
    flushFrames(); expect(scroll).not.toHaveBeenCalled()
    page.rerender(view(true)); flushFrames()
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ behavior: 'instant', block: 'start' })
    expect(document.activeElement).toBe(document.getElementById('social-copy-gate'))
    window.dispatchEvent(new Event('wheel'))
    page.rerender(view(false)); page.rerender(view(true)); flushFrames()
    expect(scroll).toHaveBeenCalledTimes(1)
  })
  it.each(['social-supporting-context-gate','social-copy-gate','social-visual-assets-gate','social-draft-approval-gate','social-platform-submission-gate','social-publication-status-gate'])('supports existing selected gate %s', gateId => {
    window.history.replaceState({}, '', `/admin/social-content/one#${gateId}`)
    render(view(true, gateId)); flushFrames(); expect(scroll).toHaveBeenCalledTimes(1)
  })
  it.each(['/admin/social-content/one#unrelated','/admin/social-content/other#social-copy-gate','/admin/social-content/one#social-platform-submission-gate'])('ignores wrong route or unselected hash %s', url => {
    window.history.replaceState({}, '', url); render(view(true)); flushFrames(); expect(scroll).not.toHaveBeenCalled()
  })
  it('ignores stale item data and a hash changed while landing is queued', () => {
    const page=render(view(true,'social-copy-gate','old'));flushFrames();expect(scroll).not.toHaveBeenCalled()
    page.rerender(view(true));window.history.replaceState({}, '', '/admin/social-content/one#unrelated');flushFrames();expect(scroll).not.toHaveBeenCalled()
  })
  it('yields to a user gesture before the scheduled landing', () => {
    render(view(true));window.dispatchEvent(new Event('wheel'));flushFrames();expect(scroll).not.toHaveBeenCalled()
  })
})
