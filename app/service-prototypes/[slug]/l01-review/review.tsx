'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import lesson from '@/docs/accelerated-course-modules/l01-guided-video/animatic.json'
import styles from './review.module.css'

const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(Math.floor(value % 60)).padStart(2, '0')}`
const avatars = [{ start: 0, end: 35, id: 'A01' }, { start: 235, end: 255, id: 'A02' }, { start: 345, end: 365, id: 'A03' }, { start: 515, end: 540, id: 'A04' }]

export function L01Review() {
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [captions, setCaptions] = useState(true)
  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => setTime((current) => {
      if (current >= lesson.runtime_seconds - 0.1) { setPlaying(false); return lesson.runtime_seconds }
      return Math.min(lesson.runtime_seconds, current + 0.1)
    }), 100)
    return () => window.clearInterval(timer)
  }, [playing])
  const scene = useMemo(() => lesson.scenes.find((item) => time >= item.start_seconds && time < item.end_seconds) ?? lesson.scenes[5], [time])
  const cue = useMemo(() => lesson.cues.find((item) => time >= item.start && time < item.end), [time])
  const avatar = avatars.find((item) => time >= item.start && time < item.end)
  const jump = (seconds: number) => { setTime(seconds); setPlaying(false) }
  return <main className={styles.page}>
    <header className={styles.topbar}><Link href="/service-prototypes/accelerated-cohort?view=3">← Learning plan</Link><span>ACCELERATED · L01</span><span className={styles.status}>Silent animatic · review only</span></header>
    <div className={styles.shell}>
      <section className={styles.intro}><div><p className={styles.eyebrow}>GUIDED VIDEO PILOT · SIGNALS</p><h1>Build smarter, stay human.</h1><p>One decision. A safe source boundary. A first page your team can actually use.</p></div><Image src="/accelerated_cover_ebook.webp" alt="Accelerated book cover" width={94} height={140} className={styles.cover} unoptimized /></section>
      <div className={styles.layout}>
        <section className={styles.playerArea} aria-label="L01 animatic player">
          <div className={styles.screen} data-scene={scene.id}>
            <div className={styles.screenTop}><span>ACCELERATED</span><span>{scene.id.replace('L01-', 'SCENE ')}</span></div>
            {avatar && <div className={styles.avatar} aria-label={`${avatar.id} avatar window reserved; no avatar media generated`}><span>DIRECT ADDRESS</span><strong>Presenter window reserved</strong><small>{avatar.id} · no avatar media</small></div>}
            <div className={styles.sceneArt}>
              {scene.id === 'L01-01' && <div className={styles.document}><span>WORKING DRAFT · SYNTHETIC</span><h2>Q3 Innovation Plan<span className={styles.cursor} aria-hidden="true">|</span></h2><div className={styles.rule}/><p>Decision to make</p><strong>Who will decide, and what evidence is missing?</strong></div>}
              {scene.id === 'L01-02' && <div className={styles.artSplit}><Image src="/showcases/service-prototypes/accelerated-sam-infographic.png" alt="Full Signals, Alignment, Momentum workshop map" width={1136} height={944} unoptimized /><div><span>FROM INPUT TO JUDGMENT</span><strong>Signal → decision → learning</strong><p>People own the decision.</p></div></div>}
              {scene.id === 'L01-03' && <div className={styles.map}><Image src="/showcases/service-prototypes/accelerated-sam-infographic.png" alt="Approved full SAM infographic, with Signals, Alignment, and Momentum panels" width={1136} height={944} unoptimized /><div><span>WORKSHOP MAP</span><strong>Signals · Alignment · Momentum</strong><small>Book parts: Systems · Align · Momentum</small></div></div>}
              {scene.id === 'L01-04' && <div className={styles.boundary}><h2>Before the tool, set the boundary.</h2><div><article><span>01</span><strong>Public</strong><small>Safe to use</small></article><article><span>02</span><strong>Approved for this use</strong><small>Tool and purpose cleared</small></article><article><span>03</span><strong>Restricted</strong><small>Keep it out</small></article></div><p>Use a made-up example when the real input cannot be shared.</p></div>}
              {scene.id === 'L01-05' && (avatar ? <div className={styles.exerciseIntro}><span>YOUR TURN</span><h2>Make the first page of your decision file.</h2><p>Start with the decision. Keep private inputs out of the tool.</p></div> : <div className={styles.worksheet}><span>DECISION FILE · PAGE 01</span><h2>Start with the decision.</h2><dl><div><dt>We need to decide whether to…</dt><dd>________________________</dd></div><div><dt>Decision owner</dt><dd>________________________</dd></div><div><dt>When · risk of guessing</dt><dd>________________________</dd></div><div><dt>Input boundary</dt><dd>Public · approved · restricted</dd></div></dl><small>Pause at 06:20 to write your own safe version.</small></div>)}
              {scene.id === 'L01-06' && <div className={styles.close}><div><span>YOUR FIRST PAGE</span><h2>What must we learn before choosing?</h2><p>Keep the decision, evidence gap, and data boundary visible.</p></div><Image src="/showcases/service-prototypes/v2/sam-signals-plate.webp" alt="Approved Signals visual: input funnel and target" width={1024} height={1536} unoptimized /></div>}
            </div>
            {captions && <div className={styles.captionBand} aria-live="off"><span>{cue?.text ?? (time === 540 ? 'End of L01.' : 'Approved narration caption preview')}</span></div>}
          </div>
          <div className={styles.controls}><button type="button" onClick={() => { if (time === 540) setTime(0); setPlaying(!playing) }} aria-label={playing ? 'Pause animatic' : 'Play animatic'}>{playing ? 'Pause' : 'Play'}</button><span>{clock(time)} / 09:00</span><input aria-label="Seek animatic" type="range" min="0" max="540" step="1" value={Math.round(time)} onChange={(event) => jump(Number(event.target.value))}/><button type="button" aria-pressed={captions} onClick={() => setCaptions(!captions)}>CC {captions ? 'on' : 'off'}</button></div>
          <p className={styles.note}>Silent storyboard timing. Captions follow the approved script and need retiming against final recorded audio.</p>
        </section>
        <aside className={styles.side}><div className={styles.sideHeading}><span>09:00 · SIX SCENES</span><h2>Follow the decision.</h2></div><nav aria-label="Animatic scenes">{lesson.scenes.map((item) => <button type="button" key={item.id} aria-current={scene.id === item.id ? 'step' : undefined} onClick={() => jump(item.start_seconds)}><span>{clock(item.start_seconds)}</span><strong>{item.title}</strong><small>{item.on_screen_copy}</small></button>)}</nav><div className={styles.artifact}><span>YOUR TAKEAWAY</span><strong>Decision-file cover sheet</strong><p>Write the decision, owner, deadline, risk of guessing, and input boundary. Use a synthetic case if the real one is restricted.</p></div></aside>
      </div>
      <section className={styles.transcript}><div><p className={styles.eyebrow}>READ ALONG</p><h2>Approved narration</h2><p>The full text stays available for readers and for source review.</p></div><details><summary>Open searchable transcript</summary>{lesson.scenes.map((item) => <section key={item.id}><h3>{clock(item.start_seconds)} · {item.title}</h3><p>{item.narration}</p></section>)}</details></section>
    </div>
  </main>
}
