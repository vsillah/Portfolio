"use client";
/* eslint-disable @next/next/no-img-element -- Local transparent poster pairs with licensed rendered video. */

import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./TrumpetRecruitmentTimeline.module.css";

export type TimelineStep = { days: string; title: string; detail: string };
type BranchPoint = { x: number; y: number };
type BranchGeometry = { width: number; height: number; anchors: BranchPoint[]; ends: BranchPoint[]; mobile: boolean };
const mediaRoot = "/work/trumpet-trainer/recruitment-motion";
const clipFor = (index: number) => `${mediaRoot}/step-${String(index + 1).padStart(2, "0")}.mp4`;
const desktopAnchorX = [0.36, 0.69, 0.18, 0.82, 0.27, 0.72];
const mobileAnchorX = [0.63, 0.72, 0.95, 0.95, 0.76, 0.73];

export default function TrumpetRecruitmentTimeline({ steps }: { steps: TimelineStep[] }) {
  const [active, setActive] = useState(0);
  const [clip, setClip] = useState<number | null>(null);
  const [playToken, setPlayToken] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
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
      const anchors = cards.map((card, index) => {
        const cardRect = card!.getBoundingClientRect();
        return { x: stage.left - bounds.left + stage.width * (mobile ? mobileAnchorX[index] : desktopAnchorX[index]),
          y: cardRect.top + cardRect.height / 2 - bounds.top };
      });
      const ends = cards.map((card, index) => {
        const rect = card!.getBoundingClientRect();
        return { x: (mobile || index % 2 === 1 ? rect.left : rect.right) - bounds.left,
          y: rect.top + rect.height / 2 - bounds.top };
      });
      setBranches({ width: bounds.width, height: bounds.height, anchors, ends, mobile });
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(layout);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [steps.length]);

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
    setTremor(false);
  }, [reducedMotion]);

  const choose = useCallback((index: number) => {
    if (index < 0 || index >= steps.length) return;
    setActive(index);
    setClip(reducedMotion ? null : index);
    setPlayToken((current) => current + 1);
    setPlaying(false);
    setMediaFailed(false);
    setTremor(false);
  }, [reducedMotion, steps.length]);

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

  return <section className={styles.timeline} aria-label="Proposed 14-day milestone plan" data-active={safeActive + 1} data-motion={reducedMotion ? "reduced" : "standard"}>
    <div className={styles.layout} ref={layoutRef}>
      {branches && <svg className={styles.branches} viewBox={`0 0 ${branches.width} ${branches.height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false" data-branch-order="1-2-3-4-5-6" data-progress={safeActive + 1} data-layout={branches.mobile ? "stacked" : "alternating"}>
        {branches.anchors.map((anchor, index) => <g key={index} data-branch-step={index + 1} data-reached={index <= safeActive} data-anchor-side={branches.mobile || index % 2 === 1 ? "right" : "left"}>
          <path d={`M ${anchor.x} ${anchor.y} H ${branches.ends[index].x}`} />
          <circle cx={anchor.x} cy={anchor.y} r={index === safeActive ? 8 : 6} />
        </g>)}
      </svg>}
      <div className={styles.stage} data-timeline-stage>
        <div className={styles.visual}>
          {posterFailed ? <div className={styles.posterFallback} role="img" aria-label="Trumpet visual unavailable">Trumpet visual unavailable</div> : <img src={`${mediaRoot}/poster.png`} width={800} height={800} alt="Vertically framed brass trumpet" className={styles.poster} draggable={false} onError={() => setPosterFailed(true)} />}
          {clip !== null && !reducedMotion && !mediaFailed && <video key={`${clip}-${playToken}`} ref={videoRef} className={styles.video} data-visible={playing} muted playsInline preload="auto" aria-hidden="true" onPlaying={() => setPlaying(true)} onEnded={() => { setPlaying(false); setClip(null); }} onError={() => { setPlaying(false); setMediaFailed(true); setClip(null); }}><source src={clipFor(clip)} type="video/mp4" /></video>}
        </div>
        <span className={styles.stageLabel} aria-hidden="true">{String(safeActive + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</span>
      </div>
      {steps.map((step, index) => <button key={step.days} ref={(element) => { cardRefs.current[index] = element; }} type="button" className={styles.step} data-selected={safeActive === index} data-reached={index <= safeActive} data-tremor={index === 2 && tremor} aria-pressed={safeActive === index} aria-current={safeActive === index ? "step" : undefined} aria-label={`Step ${index + 1}, days ${step.days}: ${step.title}`} onClick={() => choose(index)} onKeyDown={(event) => keyboardSelect(event, index, cardRefs.current)}><span className={styles.number}>{String(index + 1).padStart(2, "0")}</span><span className={styles.stepCopy}><small>Days {step.days}</small><strong>{step.title}</strong></span></button>)}
    </div>
    <div className={styles.controls} aria-label="Milestone navigation">
      <button type="button" className={styles.arrow} aria-label="Previous milestone" onClick={() => choose(safeActive - 1)} disabled={safeActive === 0}><ChevronLeft size={18} aria-hidden="true" /></button>
      <div className={styles.dots} role="group" aria-label="Choose a milestone">{steps.map((step, index) => <button key={step.days} ref={(element) => { dotRefs.current[index] = element; }} type="button" className={styles.dot} aria-label={`Show milestone ${index + 1}: ${step.title}`} aria-current={safeActive === index ? "step" : undefined} onClick={() => choose(index)} onKeyDown={(event) => keyboardSelect(event, index, dotRefs.current)}><span /></button>)}</div>
      <button type="button" className={styles.arrow} aria-label="Next milestone" onClick={() => choose(safeActive + 1)} disabled={safeActive === steps.length - 1}><ChevronRight size={18} aria-hidden="true" /></button>
      {!reducedMotion && <button type="button" className={styles.replay} aria-label={`Replay milestone ${safeActive + 1} gesture`} onClick={() => choose(safeActive)}><RotateCcw size={15} aria-hidden="true" /><span>Replay</span></button>}
    </div>
    <div className={styles.detail} aria-live="polite"><div><span>Days {steps[safeActive]?.days}</span><h3>{steps[safeActive]?.title}</h3></div><p>{steps[safeActive]?.detail}</p></div>
    {mediaFailed && <p className={styles.notice} role="status">Motion unavailable. The plan remains selectable.</p>}
    {reducedMotion && <p className={styles.notice}>Motion is off. Select any milestone to read its plan.</p>}
  </section>;
}
