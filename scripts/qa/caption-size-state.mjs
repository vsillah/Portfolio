export const captionSizes = { Small: ['S', '14px'], Medium: ['M', '17px'], Large: ['L', '21px'] }

export async function waitForCueFrame(page, time) {
  await page.waitForFunction((target) => {
    const video = document.querySelector('video')
    return video && Math.abs(video.currentTime - target) < .1 && !video.seeking && video.readyState >= 2
  }, time, { timeout: 15000 })
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

export async function waitForCaptionSize(page, { course, width, name }) {
  const [size, font] = captionSizes[name]
  const external = course === 'accelerated' || width <= 620 || size === 'L'
  await page.waitForFunction(({ size, font, external }) => {
    const video = document.querySelector('video')
    const selected = document.querySelector(`[aria-label="${{ S: 'Small', M: 'Medium', L: 'Large' }[size]} captions"]`)
    const pressed = [...document.querySelectorAll('[aria-label$=" captions"][aria-pressed="true"]')]
    const band = document.querySelector('[aria-label$=" caption"]')
    if (!video || video.dataset.captionSize !== size || selected?.getAttribute('aria-pressed') !== 'true' || pressed.length !== 1 || pressed[0] !== selected || localStorage.getItem('amadutown.caption-size.v1') !== size) return false
    if (video.textTracks[0]?.mode !== (external ? 'hidden' : 'showing')) return false
    if (external) return band?.dataset.captionSize === size && getComputedStyle(band).fontSize === font && band.textContent?.trim().length > 0
    const nativeFont = { S: '75%', M: '100%' }[size]
    const nativeRule = [...document.styleSheets].some((sheet) => {
      try { return [...sheet.cssRules].some((rule) => rule.selectorText?.includes('::cue') && rule.selectorText?.includes(`data-caption-size="${size}"`) && rule.style?.fontSize === nativeFont) }
      catch { return false }
    })
    return !band && nativeRule
  }, { size, font, external }, { timeout: 5000 })
  await page.mouse.move(5, 5)
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  // Check again after paint; a DOM update can otherwise outrun the screenshot compositor.
  const state = await page.evaluate(() => {
    const video = document.querySelector('video')
    const band = document.querySelector('[aria-label$=" caption"]')
    return {
      size: video.dataset.captionSize,
      pressed: [...document.querySelectorAll('[aria-label$=" captions"][aria-pressed="true"]')].map((button) => button.getAttribute('aria-label')),
      hovered: [...document.querySelectorAll('[aria-label$=" captions"]:hover')].map((button) => button.getAttribute('aria-label')),
      stored: localStorage.getItem('amadutown.caption-size.v1'),
      trackMode: video.textTracks[0]?.mode,
      bandSize: band?.dataset.captionSize ?? null,
      bandFont: band ? getComputedStyle(band).fontSize : null,
      bandText: band?.textContent ?? null,
    }
  })
  if (state.size !== size || state.pressed.join() !== `${name} captions` || state.hovered.length || state.stored !== size || state.trackMode !== (external ? 'hidden' : 'showing') || (external ? state.bandSize !== size || state.bandFont !== font : state.bandSize !== null)) throw Error(`${course} ${width} ${name}: state changed before capture ${JSON.stringify(state)}`)
  return state
}

export async function holdRenderedFrames(page, count = 36) {
  await page.evaluate((frames) => new Promise((resolve) => {
    let remaining = frames
    const tick = () => { if (--remaining <= 0) resolve(); else requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  }), count)
}

export async function captureCaptionFocus(page, path) {
  const band = page.locator('[aria-label$=" caption"]')
  const target = await band.evaluate((element) => {
    const bandDocumentTop = window.scrollY + element.getBoundingClientRect().top
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    const next = Math.min(maxScroll, Math.max(0, bandDocumentTop - 250))
    window.scrollTo({ top: next, behavior: 'instant' })
    return next
  })
  await page.waitForFunction((expected) => Math.abs(window.scrollY - expected) <= 1, target, { timeout: 5000 })
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const bandBox = await band.boundingBox()
  const toggleBox = await page.getByRole('button', { name: 'English captions on' }).boundingBox()
  const largeBox = await page.getByRole('button', { name: 'Large captions' }).boundingBox()
  const videoBox = await page.locator('video').boundingBox()
  if (!bandBox || !toggleBox || !largeBox || !videoBox) throw Error('Caption capture bounds are unavailable')
  const top = Math.max(100, Math.floor(bandBox.y - 110))
  const bottom = Math.ceil(Math.max(toggleBox.y + toggleBox.height, largeBox.y + largeBox.height) + 100)
  if (bottom > 844 || top >= bottom || videoBox.y + videoBox.height <= top || bandBox.y < top || bandBox.y + bandBox.height > bottom) throw Error(`Caption capture is outside the mobile viewport: ${top}–${bottom}`)
  await page.screenshot({ path, clip: { x: 0, y: top, width: 390, height: bottom - top } })
}
