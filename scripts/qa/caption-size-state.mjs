export const captionSizes = { Small: ['S', '14px'], Medium: ['M', '18px'], Large: ['L', '24px'] }

export async function waitForCueFrame(page, time) {
  await page.waitForFunction((target) => {
    const video = document.querySelector('video')
    return video && Math.abs(video.currentTime - target) < .1 && !video.seeking && video.readyState >= 2
  }, time, { timeout: 15000 })
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

export async function waitForCaptionSize(page, { course, width, name }) {
  const [size, font] = captionSizes[name]
  const protectedLesson = course === 'agentified' && await page.locator('video').evaluate((video) => /^L(0[8-9]|1[0-6]) /.test(video.getAttribute('aria-label') ?? ''))
  const external = course === 'accelerated' || width <= 620 || size === 'L' || protectedLesson
  await page.waitForFunction(({ size, font, external }) => {
    const video = document.querySelector('video')
    const group = document.querySelector('[role="group"][aria-label="Caption size"]')
    const selected = document.querySelector(`[aria-label="${{ S: 'Small', M: 'Medium', L: 'Large' }[size]} captions"]`)
    const pressed = [...document.querySelectorAll('[aria-label$=" captions"][aria-pressed="true"]')]
    const band = document.querySelector('[aria-label$=" caption"]')
    const previews = { Small: '14px', Medium: '18px', Large: '24px' }
    if (!group || [...group.querySelectorAll('button')].length !== 3 || Object.entries(previews).some(([name, px]) => {
      const button = group.querySelector(`[aria-label="${name} captions"]`)
      const sample = button?.querySelector('span')
      return sample?.textContent !== 'Aa' || sample.getAttribute('aria-hidden') !== 'true' || getComputedStyle(sample).fontSize !== px || !sample.getBoundingClientRect().width
    })) return false
    const buttons = [...group.querySelectorAll('button')]
    const boxes = buttons.map((button) => button.getBoundingClientRect())
    if (boxes.some((box) => Math.abs(box.width - boxes[0].width) > .5 || Math.abs(box.height - boxes[0].height) > .5 || Math.abs(box.y - boxes[0].y) > 1)) return false
    const styles = buttons.map((button) => getComputedStyle(button.querySelector('span')))
    if (['fontFamily', 'fontWeight', 'fontStyle', 'color', 'lineHeight'].some((property) => new Set(styles.map((style) => style[property])).size !== 1)) return false
    const px = styles.map((style) => Number.parseFloat(style.fontSize))
    if (px[1] - px[0] < 4 || px[2] - px[1] < 6) return false
    if (!video || video.dataset.captionSize !== size || selected?.getAttribute('aria-pressed') !== 'true' || pressed.length !== 1 || pressed[0] !== selected || localStorage.getItem('amadutown.caption-size.v1') !== size) return false
    if (video.textTracks[0]?.mode !== (external ? 'hidden' : 'showing')) return false
    if (external) return band?.dataset.captionSize === size && getComputedStyle(band).fontSize === font && getComputedStyle(band).fontSize === getComputedStyle(selected.querySelector('span')).fontSize && band.textContent?.trim().length > 0
    const nativeFont = { S: '87.5%', M: '112.5%' }[size]
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
      previews: Object.fromEntries(['Small', 'Medium', 'Large'].map((name) => {
        const button = document.querySelector(`[aria-label="${name} captions"]`)
        const sample = button?.querySelector('span')
        const style = sample ? getComputedStyle(sample) : null
        const box = button?.getBoundingClientRect()
        return [name, { text: sample?.textContent, font: style?.fontSize, family: style?.fontFamily, weight: style?.fontWeight, style: style?.fontStyle, color: style?.color, lineHeight: style?.lineHeight, buttonWidth: box?.width, buttonHeight: box?.height, buttonY: box?.y }]
      })),
      stored: localStorage.getItem('amadutown.caption-size.v1'),
      trackMode: video.textTracks[0]?.mode,
      bandSize: band?.dataset.captionSize ?? null,
      bandFont: band ? getComputedStyle(band).fontSize : null,
      bandText: band?.textContent ?? null,
    }
  })
  const samples = Object.values(state.previews)
  const equalMetrics = ['family', 'weight', 'style', 'color', 'lineHeight', 'buttonWidth', 'buttonHeight', 'buttonY'].every((property) => new Set(samples.map((sample) => sample[property])).size === 1)
  if (state.size !== size || state.pressed.join() !== `${name} captions` || state.hovered.length || state.stored !== size || state.trackMode !== (external ? 'hidden' : 'showing') || (external ? state.bandSize !== size || state.bandFont !== font || state.bandFont !== state.previews[name].font : state.bandSize !== null) || !equalMetrics || Object.entries({ Small: '14px', Medium: '18px', Large: '24px' }).some(([label, px]) => state.previews[label].text !== 'Aa' || state.previews[label].font !== px)) throw Error(`${course} ${width} ${name}: state changed before capture ${JSON.stringify(state)}`)
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
