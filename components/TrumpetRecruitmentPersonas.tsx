"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./TrumpetRecruitmentPersonas.module.css";

type Persona = { name: string; role: string; personName: string; quote: string; goal: string; friction: string; currentBehavior: string; proof: string; imageSrc?: string; imageAlt?: string };
type Gesture = { pointerId: number; x: number; y: number; vertical: boolean; captured: boolean };
type Motion = { exiting: number; direction: "forward" | "reverse"; startX: number };
const SWIPE_THRESHOLD = 56;
const MOTION_MS = 520;

export default function TrumpetRecruitmentPersonas({ personas }: { personas: Persona[] }) {
  const [order, setOrder] = useState(() => personas.map((_, index) => index));
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [motion, setMotion] = useState<Motion | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const active = order[0];
  useEffect(() => {
    if (!motion) return;
    const timeout = window.setTimeout(() => setMotion(null), MOTION_MS);
    return () => window.clearTimeout(timeout);
  }, [motion]);
  function move(nextOrder: number[], direction: Motion["direction"], startX = 0) {
    if (nextOrder[0] === active) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setMotion(reducedMotion ? null : { exiting: active, direction, startX: Math.max(-120, Math.min(120, startX)) });
    setOrder(nextOrder);
  }
  function next(startX = 0) { move([...order.slice(1), order[0]], "forward", startX); }
  function previous(startX = 0) { move([order[order.length - 1], ...order.slice(0, -1)], "reverse", startX); }
  function select(index: number) {
    const distance = order.indexOf(index);
    move([index, ...order.filter((item) => item !== index)], distance <= order.length / 2 ? "forward" : "reverse");
  }
  function resetGesture() { gesture.current = null; setDragX(0); setDragging(false); }
  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, vertical: false, captured: false };
  }
  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx) * 0.8) start.vertical = true;
    if (start.vertical) return;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (!start.captured) {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        start.captured = true;
        setDragging(true);
      }
      setDragX(Math.max(-120, Math.min(120, dx)));
    }
  }
  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.vertical && Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) >= Math.abs(dy) * 1.25) {
      if (dx < 0) next(dx); else previous(dx);
    }
    resetGesture();
  }

  return <div className="relative mt-6 max-w-4xl">
    <div aria-label="Adults who support beginner players" className={styles.stage} style={{ "--drag-x": `${dragX}px`, "--drag-y": `${-Math.min(Math.abs(dragX) * .12, 14)}px`, "--drag-rotate": `${dragX * .07}deg` } as React.CSSProperties} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={resetGesture} onDragStart={(event) => event.preventDefault()}>
      {personas.map((persona, index) => {
        const depth = order.indexOf(index);
        const isActive = depth === 0;
        return <article key={persona.name} data-testid={`persona-card-${index}`} data-depth={depth} data-dragging={isActive && dragging ? "true" : undefined} data-motion-direction={motion?.exiting === index ? motion.direction : undefined} style={motion?.exiting === index ? { "--motion-start-x": `${motion.startX}px`, "--motion-start-y": `${-Math.min(Math.abs(motion.startX) * .12, 14)}px`, "--motion-start-rotate": `${motion.startX * .07}deg` } as React.CSSProperties : undefined} aria-hidden={!isActive} className={`${styles.card} flex flex-col overflow-hidden rounded-3xl border border-radiant-gold/50`}>
          <div data-testid={`persona-image-${index}`} className={`${styles.imageRegion} relative overflow-hidden bg-imperial-navy/60`}>{persona.imageSrc ? <Image src={persona.imageSrc} alt={persona.imageAlt ?? `Fictional adult scene for ${persona.name}`} fill draggable={false} sizes="(max-width: 640px) 90vw, (max-width: 900px) 62vw, 560px" className="object-cover object-center" priority={index === 0} /> : <div aria-hidden="true" className="h-full bg-gradient-to-br from-radiant-gold/20 via-imperial-navy to-background" />}<span className="absolute bottom-3 right-3 rounded-full bg-imperial-navy/90 px-3 py-1 text-xs text-platinum-white">Illustrative scene</span></div>
          <div data-testid={`persona-copy-${index}`} className={`${styles.copyRegion} flex min-h-0 flex-col p-4 sm:p-5`}>
            <p className={styles.provenance}>Illustrative example</p>
            <div className={styles.identity}><h3 className={styles.personName}>{persona.personName}</h3><p className={styles.role}>{persona.role}</p></div>
            <blockquote className={styles.quote}>“{persona.quote}”</blockquote>
            <dl className={styles.profile}>
              <div><dt>Trying to</dt><dd>{persona.goal}</dd></div>
              <div><dt>Gets in the way</dt><dd>{persona.friction}</dd></div>
              <div><dt>What they do now</dt><dd>{persona.currentBehavior}</dd></div>
              <div><dt>What could help</dt><dd>{persona.proof}</dd></div>
            </dl>
          </div>
        </article>;
      })}
    </div>
    <button type="button" onClick={() => previous()} aria-label="Previous example" className={`${styles.arrow} ${styles.previous}`}><span aria-hidden="true">◀</span></button>
    <button type="button" onClick={() => next()} aria-label="Next example" className={`${styles.arrow} ${styles.next}`}><span aria-hidden="true">▶</span></button>
    <span role="status" aria-live="polite" className="sr-only">Example {active + 1} of {personas.length}: {personas[active]?.name}</span>
    <div role="group" aria-label="Choose an example" className={styles.dots}>{personas.map((persona, index) => <button key={persona.name} type="button" aria-label={`Show ${persona.name}`} title={persona.name} aria-current={active === index ? "true" : undefined} onClick={() => select(index)} className={styles.dot}><span aria-hidden="true" /></button>)}</div>
  </div>;
}
