import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { captureCaptionFocus, waitForCaptionSize, waitForCueFrame } from './caption-size-state.mjs'

const base = 'http://127.0.0.1:3121'
const out = 'agentified/workshop/caption-size-review'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = []
const themeResults = []
const ids = (start, end) => Array.from({ length: end - start + 1 }, (_, i) => `L${String(start + i).padStart(2, '0')}`)
async function checkThemes(page, course, width) {
  for (const [theme, colorScheme] of [['light', 'light'], ['dark', 'dark'], ['system', 'light'], ['system', 'dark']]) {
    await page.emulateMedia({ colorScheme })
    await page.evaluate(({ theme }) => { localStorage.setItem('theme', theme); localStorage.setItem('amadutown.caption-size.v1', 'M') }, { theme })
    await page.reload({ waitUntil: 'networkidle' })
    if (course === 'accelerated') await page.locator('button[aria-label^="L01:"]').evaluate((button) => button.click())
    const group = page.getByRole('group', { name: 'Caption size' })
    await group.waitFor()
    await page.waitForFunction(({ theme, colorScheme }) => document.documentElement.classList.contains('dark') === (theme === 'dark' || theme === 'system' && colorScheme === 'dark'), { theme, colorScheme })
    const baseline = await group.evaluate((element) => {
      const buttons = [...element.querySelectorAll('button')]
      const styles = buttons.map((button) => getComputedStyle(button))
      const samples = buttons.map((button) => getComputedStyle(button.querySelector('span')))
      const boxes = buttons.map((button) => button.getBoundingClientRect())
      return {
        ink: getComputedStyle(element).getPropertyValue('--foreground').trim(),
        colors: samples.map((sample) => sample.color),
        fonts: samples.map((sample) => sample.fontSize),
        lineHeights: samples.map((sample) => sample.lineHeight),
        backgrounds: styles.map((style) => style.backgroundColor),
        borders: styles.map((style) => style.borderWidth),
        sizes: boxes.map((box) => [box.width, box.height, box.y]),
      }
    })
    if (new Set(baseline.colors).size !== 1 || baseline.fonts.join() !== '14px,18px,24px' || new Set(baseline.lineHeights).size !== 1 || baseline.borders.join() !== '1px,2px,1px' || baseline.backgrounds[0] === baseline.backgrounds[1] || baseline.sizes.some((size) => size.join() !== baseline.sizes[0].join())) throw Error(`${course} ${width} ${theme}/${colorScheme}: theme baseline failed ${JSON.stringify(baseline)}`)
    const small = page.getByRole('button', { name: 'Small captions' })
    await small.hover()
    const hover = await small.evaluate((button) => getComputedStyle(button).backgroundColor)
    if (hover === baseline.backgrounds[0] || hover === baseline.backgrounds[1]) throw Error(`${course} ${width} ${theme}/${colorScheme}: hover indistinct`)
    await page.mouse.move(5, 5)
    await small.focus()
    const focus = await small.evaluate((button) => ({ outline: getComputedStyle(button).outlineWidth, color: getComputedStyle(button).outlineColor }))
    if (focus.outline !== '3px' || focus.color !== baseline.colors[0]) throw Error(`${course} ${width} ${theme}/${colorScheme}: focus unclear ${JSON.stringify(focus)}`)
    const result = { course, width, theme, colorScheme, ...baseline, hover, focus }
    themeResults.push(result)
    if (theme !== 'system') await group.screenshot({ path: `${out}/${course}-L01-${width}-${theme}-theme.png` })
  }
  await page.emulateMedia({ colorScheme: 'light' })
  await page.evaluate(() => localStorage.setItem('theme', 'light'))
  await page.reload({ waitUntil: 'networkidle' })
}
for (const width of [1280, 390]) {
  for (const course of ['agentified', 'accelerated']) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, recordVideo: undefined })
    const lessonIds = course === 'agentified' ? ['L01', ...ids(5, 16)] : ids(1, 16)
    await page.goto(`${base}/${course}/learningplan`, { waitUntil: 'networkidle' })
    await checkThemes(page, course, width)
    for (const id of lessonIds) {
      console.log(`Checking ${course} ${id} at ${width}px`)
      if (course === 'agentified') await page.goto(`${base}/agentified/learningplan?lesson=${id}`, { waitUntil: 'networkidle' })
      else await page.locator(`button[aria-label^="${id}:"]`).evaluate((button) => button.click())
      const video = page.locator('video')
      await video.waitFor()
      await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
      const cue = await video.evaluate((element) => {
        const cues = Array.from(element.textTracks[0].cues)
        const longest = cues.reduce((a, b) => b.text.length > a.text.length ? b : a)
        return { start: longest.startTime, end: longest.endTime, text: longest.text }
      })
      await video.evaluate((element, time) => { element.currentTime = time; element.dispatchEvent(new Event('timeupdate', { bubbles: true })) }, cue.start + .05)
      await waitForCueFrame(page, cue.start + .05)
      const baselineScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      let geometry = null
      for (const size of ['S', 'M', 'L']) {
        const name = { S: 'Small', M: 'Medium', L: 'Large' }[size]
        await page.getByRole('button', { name: `${name} captions` }).click()
        const state = await waitForCaptionSize(page, { course, width, name })
        const expectsBand = course === 'accelerated' || width === 390 || size === 'L'
        const check = await page.evaluate(() => {
          const video = document.querySelector('video')
          const rect = video.getBoundingClientRect()
          const band = document.querySelector('[aria-label$=" caption"]')
          return { video: [Math.round(rect.width), Math.round(rect.height)], band: band?.textContent ?? null, bandFont: band ? getComputedStyle(band).fontSize : null, scrollWidth: document.documentElement.scrollWidth }
        })
        if (geometry && check.video.join() !== geometry.join()) throw Error(`${course} ${id} ${width}: video changed with ${size}`)
        geometry = check.video
        if (check.scrollWidth > baselineScrollWidth + 1) throw Error(`${course} ${id} ${width}: new horizontal overflow at ${size}`)
        if (Boolean(check.band) !== expectsBand) throw Error(`${course} ${id} ${width}: wrong caption surface at ${size}`)
        if (check.band && !check.band.includes(cue.text.replaceAll('\n', ' ').slice(0, 12))) throw Error(`${course} ${id} ${width}: wrong active cue at ${size}`)
        results.push({ course, id, width, size, cueStart: cue.start, cueEnd: cue.end, cueLength: cue.text.length, selected: state.pressed[0], stored: state.stored, trackMode: state.trackMode, previews: state.previews, ...check })
        if ((course === 'agentified' && id === 'L07' || course === 'accelerated' && ['L01', 'L09'].includes(id)) && width === 390) await captureCaptionFocus(page, `${out}/${course}-${id}-${width}-${size}.png`)
        if (width === 1280 && (course === 'agentified' && id === 'L07' || course === 'accelerated' && id === 'L09')) await video.locator('../..').screenshot({ path: `${out}/${course}-${id}-${width}-${size}.png` })
      }
      const toggle = page.getByRole('button', { name: 'English captions on' })
      await toggle.click()
      await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.mode === 'disabled' && !document.querySelector('[aria-label$=" caption"]') && [...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'English captions off' && button.getAttribute('aria-pressed') === 'false'))
      await page.getByRole('button', { name: 'English captions off' }).click()
      await waitForCaptionSize(page, { course, width, name: 'Large' })
      const restored = await page.locator('[aria-label$=" caption"]').count()
      if (results.at(-1).band && restored !== 1) throw Error(`${course} ${id} ${width}: active cue did not return while paused`)
      if (id === lessonIds[0]) {
        await page.getByRole('button', { name: 'Small captions' }).focus()
        await page.keyboard.press('Enter')
        await waitForCaptionSize(page, { course, width, name: 'Small' })
        await page.getByRole('button', { name: 'Large captions' }).focus()
        await page.keyboard.press('Space')
        await waitForCaptionSize(page, { course, width, name: 'Large' })
      }
    }
    await page.close()
  }
}
await browser.close()
await writeFile(`${out}/receipt.json`, JSON.stringify({ generatedAt: new Date().toISOString(), base, results, themeResults }, null, 2))
console.log(`PASS ${results.length} lesson/size checks; ${themeResults.length} theme checks`)
