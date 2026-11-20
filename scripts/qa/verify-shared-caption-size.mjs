import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { captureCaptionFocus, waitForCaptionSize, waitForCueFrame } from './caption-size-state.mjs'

const base = 'http://127.0.0.1:3121'
const out = 'agentified/workshop/caption-size-review'
const l08Out = 'agentified/workshop/l08-caption-clearance-review'
await mkdir(out, { recursive: true })
await mkdir(l08Out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = []
const themeResults = []
const l08Results = []
const adjacentResults = []
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
      const pausedTime = await video.evaluate((element) => { element.pause(); return element.currentTime })
      const baselineScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      let geometry = null
      for (const size of ['S', 'M', 'L']) {
        const name = { S: 'Small', M: 'Medium', L: 'Large' }[size]
        await page.getByRole('button', { name: `${name} captions` }).click()
        const state = await waitForCaptionSize(page, { course, width, name })
        const expectsBand = course === 'accelerated' || width === 390 || size === 'L' || course === 'agentified' && /^L(0[8-9]|1[0-6])$/.test(id)
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
      await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.mode === 'disabled' && !document.querySelector('[aria-label$=" caption"]') && !document.querySelector('[role="group"][aria-label="Caption size"]') && document.querySelector('video')?.dataset.captionSize === 'L' && localStorage.getItem('amadutown.caption-size.v1') === 'L' && [...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'English captions off' && button.getAttribute('aria-pressed') === 'false'))
      const offState = await video.evaluate((element) => { const box = element.getBoundingClientRect(); return { video: [Math.round(box.width), Math.round(box.height)], time: element.currentTime } })
      if (offState.video.join() !== geometry.join() || Math.abs(offState.time - pausedTime) > .1) throw Error(`${course} ${id} ${width}: geometry or paused cue moved when captions turned off`)
      await page.getByRole('button', { name: 'English captions off' }).click()
      await waitForCaptionSize(page, { course, width, name: 'Large' })
      const restoredTime = await video.evaluate((element) => element.currentTime)
      if (Math.abs(restoredTime - offState.time) > .1) throw Error(`${course} ${id} ${width}: cue time moved when captions returned`)
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
for (const width of [1280, 390]) {
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 720 } })
  await page.goto(`${base}/agentified/learningplan?lesson=L08`, { waitUntil: 'networkidle' })
  const video = page.locator('video')
  await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
  const source = await video.evaluate((element) => ({ video: element.querySelector('source')?.getAttribute('src'), captions: element.querySelector('track')?.getAttribute('src') }))
  if (source.video !== '/agentified/lessons/l08/illustrated-5ea78c36/agentified-l08-illustrated-composite.mp4' || source.captions !== '/agentified/lessons/l08/continuous-3c5b399f/agentified-l08-continuous-narration-captions.vtt') throw Error(`L08 ${width}: approved media binding drifted ${JSON.stringify(source)}`)
  const initialBox = await video.evaluate((element) => { const box = element.getBoundingClientRect(); return [Math.round(box.width), Math.round(box.height)] })
  for (const [scene, time] of [['L08-01', 12.717], ['L08-02', 45.631], ['L08-03', 67.348], ['L08-04', 108.52], ['L08-05', 143.328], ['L08-06', 162.724], ['L08-07', 168.052], ['L08-08', 247.736]]) {
    await video.evaluate((element, target) => { element.currentTime = target; element.dispatchEvent(new Event('timeupdate', { bubbles: true })) }, time)
    await waitForCueFrame(page, time)
    const pausedTime = await video.evaluate((element) => { element.pause(); return element.currentTime })
    const cue = await video.evaluate((element) => [...element.textTracks[0].cues].filter((item) => item.startTime <= element.currentTime && element.currentTime < item.endTime).map((item) => ({ start: item.startTime, end: item.endTime, text: item.text })))
    if (cue.length !== 1 || scene === 'L08-01' && (cue[0].start !== 11.16 || cue[0].end !== 13.04 || cue[0].text !== 'What does ‘maybe’ permit the drafter to') || scene === 'L08-03' && (cue[0].start !== 65.848 || cue[0].end !== 67.843 || cue[0].text !== 'Try a broken payload on purpose.')) throw Error(`L08 ${scene} ${width}: source cue drifted ${JSON.stringify(cue)}`)
    for (const name of ['Small', 'Medium', 'Large']) {
      await page.getByRole('button', { name: `${name} captions` }).click()
      const state = await waitForCaptionSize(page, { course: 'agentified', width, name })
      const bandCount = await page.locator('[aria-label="L08 caption"]').count()
      if (bandCount !== 1 || state.bandText !== cue[0].text) throw Error(`L08 ${scene} ${width} ${name}: missing, duplicate, or altered caption`)
      const onBox = await video.evaluate((element) => { const box = element.getBoundingClientRect(); return [Math.round(box.width), Math.round(box.height)] })
      if (onBox.join() !== initialBox.join()) throw Error(`L08 ${scene} ${width} ${name}: video geometry moved`)
      if (scene === 'L08-01' || scene === 'L08-03' || name === 'Medium') await video.locator('../..').screenshot({ path: `${l08Out}/${scene}-${width}-${name}-on.png` })
      await page.getByRole('button', { name: 'English captions on' }).click()
      await page.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.mode === 'disabled' && !document.querySelector('[aria-label="L08 caption"]') && !document.querySelector('[role="group"][aria-label="Caption size"]'))
      const off = await video.evaluate((element) => { const box = element.getBoundingClientRect(); return { time: element.currentTime, box: [Math.round(box.width), Math.round(box.height)] } })
      if (off.box.join() !== initialBox.join() || Math.abs(off.time - pausedTime) > .1) throw Error(`L08 ${scene} ${width} ${name}: off state changed geometry or cue time`)
      if (name === 'Medium') await video.locator('../..').screenshot({ path: `${l08Out}/${scene}-${width}-off.png` })
      await page.getByRole('button', { name: 'English captions off' }).click()
      const restored = await waitForCaptionSize(page, { course: 'agentified', width, name })
      if (Math.abs(await video.evaluate((element) => element.currentTime) - pausedTime) > .1 || restored.bandText !== cue[0].text) throw Error(`L08 ${scene} ${width} ${name}: cue did not restore`)
      l08Results.push({ width, scene, time, size: name, cue: cue[0], trackMode: state.trackMode, bandCount, video: onBox, off, restored: restored.pressed[0] })
    }
  }
  for (const gap of [11, 126.931, 202.172]) {
    await video.evaluate((element, time) => { element.currentTime = time; element.dispatchEvent(new Event('timeupdate', { bubbles: true })) }, gap)
    await waitForCueFrame(page, gap)
    await page.waitForFunction(() => !document.querySelector('[aria-label="L08 caption"]'))
    const gapBox = await video.evaluate((element) => { const box = element.getBoundingClientRect(); return [Math.round(box.width), Math.round(box.height)] })
    if (gapBox.join() !== initialBox.join()) throw Error(`L08 ${width} ${gap}: cue gap reserved video space`)
  }
  await page.close()
  for (const [id, time] of [['L07', 235.148], ['L09', 1.5]]) {
    const adjacent = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 720 } })
    await adjacent.goto(`${base}/agentified/learningplan?lesson=${id}`, { waitUntil: 'networkidle' })
    const adjacentVideo = adjacent.locator('video')
    await adjacent.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.cues?.length > 0)
    await adjacentVideo.evaluate((element, target) => { element.currentTime = target; element.dispatchEvent(new Event('timeupdate', { bubbles: true })) }, time)
    await waitForCueFrame(adjacent, time)
    const pausedTime = await adjacentVideo.evaluate((element) => { element.pause(); return element.currentTime })
    await adjacent.getByRole('button', { name: 'Medium captions' }).click()
    const state = await waitForCaptionSize(adjacent, { course: 'agentified', width, name: 'Medium' })
    const cue = await adjacentVideo.evaluate((element) => [...element.textTracks[0].cues].filter((item) => item.startTime <= element.currentTime && element.currentTime < item.endTime).map((item) => item.text))
    if (cue.length !== 1 || (width === 390 || id === 'L09') && state.bandText !== cue[0] || width === 1280 && id === 'L07' && state.bandText !== null) throw Error(`${id} ${width}: adjacent caption changed or duplicated`)
    await adjacent.getByRole('button', { name: 'English captions on' }).click()
    await adjacent.waitForFunction(() => document.querySelector('video')?.textTracks[0]?.mode === 'disabled' && !document.querySelector('[aria-label$=" caption"]'))
    await adjacent.getByRole('button', { name: 'English captions off' }).click()
    await waitForCaptionSize(adjacent, { course: 'agentified', width, name: 'Medium' })
    if (Math.abs(await adjacentVideo.evaluate((element) => element.currentTime) - pausedTime) > .1) throw Error(`${id} ${width}: adjacent cue time moved`)
    adjacentResults.push({ id, width, time, cue: cue[0], trackMode: state.trackMode })
    await adjacent.close()
  }
}
await browser.close()
await writeFile(`${out}/receipt.json`, JSON.stringify({ generatedAt: new Date().toISOString(), base, results, themeResults, l08Results, adjacentResults }, null, 2))
console.log(`PASS ${results.length} lesson/size checks; ${themeResults.length} theme checks; ${l08Results.length} L08 scene checks; ${adjacentResults.length} adjacent boundary checks`)
