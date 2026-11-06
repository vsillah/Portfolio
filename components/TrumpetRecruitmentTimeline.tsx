"use client";
/* eslint-disable @next/next/no-img-element -- Local transparent poster pairs with licensed rendered video. */

import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./TrumpetRecruitmentTimeline.module.css";

export type TimelineStep = { days: string; title: string; detail: string };
type BranchPoint = { x: number; y: number };
type BranchGeometry = { width: number; height: number; spineX: number; nodes: BranchPoint[]; ends: BranchPoint[]; mobile: boolean };
const mediaRoot = "/work/trumpet-trainer/recruitment-motion";
const clipFor = (index: number) => `${mediaRoot}/step-${String(index + 1).padStart(2, "0")}.webm`;
const vignetteLabels = [
  "Choose one short first-note exercise",
  "See one note and its trumpet fingering",
  "Repeat a short pattern of notes on the staff",
  "Listen to a note and adjust toward the pitch guide",
  "Write down one question to bring to a teacher",
  "Choose the next short note exercise",
];

function PracticeVignette({ index }: { index: number }) {
  return <div className={styles.vignette} role="img" aria-label={vignetteLabels[index]} data-visual-step={index + 1}>
    <div className={styles.vignetteTop}><span>Toot&apos;s journey</span><span>{String(index + 1).padStart(2, "0")} / 06</span></div>
    <div className={styles.vignetteScreen}>
      {index === 0 && <div className={styles.lessonPreview}><span className={styles.lessonNumber}>1</span><div><small>First notes</small><strong>Meet G</strong><span>One short exercise</span></div><span className={styles.lessonStart}>Start →</span></div>}
      {index === 1 && <div className={styles.notePreview}><div className={styles.noteStaff}><span className={styles.singleNote} aria-hidden="true" /></div><div className={styles.noteGuide}><strong>G</strong><span className={styles.valves}><i /><i /><i /></span><small>See it · play it</small></div></div>}
      {index === 2 && <div className={styles.patternPreview}><div className={styles.patternStaff}><span className={styles.patternNote} /><span className={styles.patternNote} /><span className={styles.patternNote} /></div><div className={styles.patternCue}><span>1</span><span>2</span><span>3</span><strong>↻ Try again</strong></div></div>}
      {index === 3 && <div className={styles.listenPreview}><div className={styles.waveBars}><i /><i /><i /><i /><i /><i /><i /></div><div className={styles.pitchGuide}><span>Listen</span><div><i /><b /></div><span>Adjust</span></div></div>}
      {index === 4 && <div className={styles.questionPreview}><span className={styles.questionMark}>?</span><div><small>Bring one question</small><strong>What felt hard?</strong><span className={styles.questionLine} /><span className={styles.questionLine} /></div></div>}
      {index === 5 && <div className={styles.nextPreview}><span className={styles.previousNote}>First note ✓</span><span className={styles.nextArrow}>→</span><div><small>Next step</small><strong>Choose another note</strong></div></div>}
    </div>
  </div>;
}

export default function TrumpetRecruitmentTimeline({ steps }: { steps: TimelineStep[] }) {
  const [active, setActive] = useState(0);
  const [clip, setClip] = useState<number | null>(null);
  const [playToken, setPlayToken] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [alphaReady, setAlphaReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [alphaMotionSupported, setAlphaMotionSupported] = useState(false);
  const [tremor, setTremor] = useState(false);
  const [branches, setBranches] = useState<BranchGeometry | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const safeActive = Math.min(active, Math.max(steps.length - 1, 0));

  useEffect(() => {
    const layout = layoutRef.current;
    if (!layout || steps.length !== 6) return;
    const measure = () => {
      const bounds = layout.getBoundingClientRect();
      const stage = layout.querySelector('[data-timeline-stage]')?.getBoundingClientRect();
      const cards = cardRefs.current.slice(0, 6);
      if (!stage || cards.some((card) => !card)) return;
      const mobile = window.matchMedia?.("(max-width: 767px)").matches ?? window.innerWidth <= 767;
      // The cropped RGBA render keeps the long main tube at 37.5% of the stage width.
      // Draw the rail beneath that tube; only the branch ends and outside nodes show.
      const spineX = stage.left - bounds.left + stage.width * .375;
      const nodes = cards.map((card, index) => {
        const cardRect = card!.getBoundingClientRect();
        const right = mobile || index % 2 === 1;
        return { x: (right ? stage.right - 2 : stage.left - 1) - bounds.left,
          y: cardRect.top + cardRect.height / 2 - bounds.top };
      });
      const ends = cards.map((card, index) => {
        const rect = card!.getBoundingClientRect();
        return { x: (mobile || index % 2 === 1 ? rect.left : rect.right) - bounds.left,
          y: rect.top + rect.height / 2 - bounds.top };
      });
      setBranches({ width: bounds.width, height: bounds.height, spineX, nodes, ends, mobile });
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(layout);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [steps.length]);

  useEffect(() => {
    const probe = document.createElement("video");
    // Safari has no reliable transparent VP9 playback here; keep the RGBA poster.
    setAlphaMotionSupported(navigator.vendor !== "Apple Computer, Inc." &&
      probe.canPlayType('video/webm; codecs="vp9"') !== "");
  }, []);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (!reducedMotion) return;
    videoRef.current?.pause();
    setClip(null);
    setPlaying(false);
    setAlphaReady(false);
    setTremor(false);
  }, [reducedMotion]);

  const choose = useCallback((index: number) => {
    if (index < 0 || index >= steps.length) return;
    setActive(index);
    setClip(reducedMotion || !alphaMotionSupported ? null : index);
    setPlayToken((current) => current + 1);
    setPlaying(false);
    setAlphaReady(false);
    setMediaFailed(false);
    setTremor(false);
  }, [alphaMotionSupported, reducedMotion, steps.length]);

  useEffect(() => {
    if (clip === null || reducedMotion) return;
    const player = videoRef.current;
    if (!player) return;
    let current = true;
    let pulseTimer: number | undefined;
    let settleTimer: number | undefined;
    player.load();
    player.play().catch(() => {
      if (!current) return;
      setMediaFailed(true);
      setClip(null);
      setPlaying(false);
    });
    if (clip === 2) {
      pulseTimer = window.setTimeout(() => {
        if (!current) return;
        setTremor(true);
        settleTimer = window.setTimeout(() => setTremor(false), 220);
      }, 520);
    }
    return () => {
      current = false;
      player.pause();
      if (pulseTimer !== undefined) window.clearTimeout(pulseTimer);
      if (settleTimer !== undefined) window.clearTimeout(settleTimer);
    };
  }, [clip, playToken, reducedMotion]);

  const keyboardSelect = (event: React.KeyboardEvent<HTMLButtonElement>, index: number, controls: Array<HTMLButtonElement | null>) => {
    const next = event.key === "ArrowRight" ? Math.min(index + 1, steps.length - 1)
      : event.key === "ArrowLeft" ? Math.max(index - 1, 0)
      : event.key === "Home" ? 0
      : event.key === "End" ? steps.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    choose(next);
    controls[next]?.focus();
  };

  return <section className={styles.timeline} aria-label="Example practice path" data-active={safeActive + 1} data-motion={reducedMotion ? "reduced" : "standard"} data-alpha-motion={alphaMotionSupported ? "supported" : "poster"}>
    <div className={styles.layout} ref={layoutRef}>
      {branches && <svg className={styles.branches} viewBox={`0 0 ${branches.width} ${branches.height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false" data-branch-order="1-2-3-4-5-6" data-progress={safeActive + 1} data-layout={branches.mobile ? "stacked" : "alternating"}>
        <path className={styles.spineBase} data-timeline-spine="base" d={`M ${branches.spineX} ${branches.nodes[0].y - 20} V ${branches.nodes[5].y + 18}`} />
        <path className={styles.spineProgress} data-timeline-spine="progress" d={`M ${branches.spineX} ${branches.nodes[0].y - 20} V ${branches.nodes[safeActive].y}`} />
        <path className={styles.spineArrow} data-timeline-direction="down" d={`M ${branches.spineX - 5} ${branches.nodes[5].y + 13} L ${branches.spineX} ${branches.nodes[5].y + 20} L ${branches.spineX + 5} ${branches.nodes[5].y + 13}`} />
        {branches.nodes.map((node, index) => <g key={index} data-branch-step={index + 1} data-reached={index <= safeActive} data-anchor-side={branches.mobile || index % 2 === 1 ? "right" : "left"}>
          <path d={`M ${branches.spineX} ${node.y} H ${branches.ends[index].x}`} />
          <circle cx={node.x} cy={node.y} r={12} />
          <text x={node.x} y={node.y} textAnchor="middle" dominantBaseline="central">{index + 1}</text>
        </g>)}
      </svg>}
      <div className={styles.stage} data-timeline-stage>
        <div className={styles.visual}>
          {posterFailed ? <div className={styles.posterFallback} role="img" aria-label="Trumpet visual unavailable">Trumpet visual unavailable</div> : <img src={`${mediaRoot}/poster.png`} width={800} height={800} alt="Upright brass trumpet" className={styles.poster} data-hidden={playing && alphaReady} draggable={false} onError={() => setPosterFailed(true)} />}
          {clip !== null && !reducedMotion && alphaMotionSupported && !mediaFailed && <video key={`${clip}-${playToken}`} ref={videoRef} className={styles.video} data-visible={playing && alphaReady} muted playsInline preload="auto" aria-hidden="true" onLoadedData={(event) => {
            try {
              const canvas = document.createElement("canvas");
              canvas.width = canvas.height = 1;
              const context = canvas.getContext("2d");
              if (!context) throw new Error("Alpha probe unavailable");
              context.drawImage(event.currentTarget, 0, 0, 4, 4, 0, 0, 1, 1);
              if (context.getImageData(0, 0, 1, 1).data[3] > 8) throw new Error("Opaque playback");
              setAlphaReady(true);
            } catch {
              setPlaying(false); setMediaFailed(true); setClip(null);
            }
          }} onPlaying={() => setPlaying(true)} onEnded={() => { setPlaying(false); setClip(null); }} onError={() => { setPlaying(false); setMediaFailed(true); setClip(null); }}><source src={clipFor(clip)} type='video/webm; codecs="vp9"' /></video>}
        </div>
        <span className={styles.stageLabel} aria-hidden="true">{String(safeActive + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</span>
      </div>
      {steps.map((step, index) => <button key={step.days} ref={(element) => { cardRefs.current[index] = element; }} type="button" className={styles.step} data-side={index % 2 === 0 ? "left" : "right"} style={{ gridRow: index + 1 }} data-selected={safeActive === index} data-reached={index <= safeActive} data-tremor={index === 2 && tremor} aria-pressed={safeActive === index} aria-current={safeActive === index ? "step" : undefined} aria-label={`Step ${index + 1}, days ${step.days}: ${step.title}`} onClick={() => choose(index)} onKeyDown={(event) => keyboardSelect(event, index, cardRefs.current)}><span className={styles.number}>{String(index + 1).padStart(2, "0")}</span><span className={styles.stepCopy}><small>Days {step.days}</small><strong>{step.title}</strong></span></button>)}
    </div>
    <div className={styles.controls} aria-label="Milestone navigation">
      <button type="button" className={styles.arrow} aria-label="Previous step" onClick={() => choose(safeActive - 1)} disabled={safeActive === 0}><ChevronLeft size={18} aria-hidden="true" /></button>
      <div className={styles.dots} role="group" aria-label="Choose a practice step">{steps.map((step, index) => <button key={step.days} ref={(element) => { dotRefs.current[index] = element; }} type="button" className={styles.dot} aria-label={`Show step ${index + 1}: ${step.title}`} aria-current={safeActive === index ? "step" : undefined} onClick={() => choose(index)} onKeyDown={(event) => keyboardSelect(event, index, dotRefs.current)}><span /></button>)}</div>
      <button type="button" className={styles.arrow} aria-label="Next step" onClick={() => choose(safeActive + 1)} disabled={safeActive === steps.length - 1}><ChevronRight size={18} aria-hidden="true" /></button>
      {!reducedMotion && alphaMotionSupported && <button type="button" className={styles.replay} aria-label={`Replay step ${safeActive + 1} motion`} onClick={() => choose(safeActive)}><RotateCcw size={15} aria-hidden="true" /><span>Replay</span></button>}
    </div>
    <div className={styles.detail} aria-live="polite"><div className={styles.detailHeading}><span>Days {steps[safeActive]?.days}</span><h3>{steps[safeActive]?.title}</h3></div><div className={styles.detailBody}><PracticeVignette index={safeActive} /><p>{steps[safeActive]?.detail}</p></div></div>
    {mediaFailed && <p className={styles.notice} role="status">Animation is unavailable. You can still explore each step.</p>}
    {reducedMotion && <p className={styles.notice}>Animation is off. Select a step to read more.</p>}
  </section>;
}
