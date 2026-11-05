"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import styles from "./TrumpetRecruitmentPersonas.module.css";

type Persona = { name: string; headline: string; support: string; channel: string; imageSrc?: string; imageAlt?: string };
type Gesture = { pointerId: number; x: number; y: number; vertical: boolean; captured: boolean };
const SWIPE_THRESHOLD = 56;

export default function TrumpetRecruitmentPersonas({ personas }: { personas: Persona[] }) {
  const [order, setOrder] = useState(() => personas.map((_, index) => index));
  const [dragX, setDragX] = useState(0);
  const gesture = useRef<Gesture | null>(null);
  const active = order[0];
  function next() { setOrder(([front, ...rest]) => [...rest, front]); }
  function previous() { setOrder((current) => [current[current.length - 1], ...current.slice(0, -1)]); }
  function select(index: number) { setOrder((current) => [index, ...current.filter((item) => item !== index)]); }
  function resetGesture() { gesture.current = null; setDragX(0); }
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
      }
      setDragX(Math.max(-120, Math.min(120, dx)));
    }
  }
  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    resetGesture();
    if (!start.vertical && Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) >= Math.abs(dy) * 1.25) {
      if (dx < 0) next(); else previous();
    }
  }

  return <div className="relative mt-6 max-w-4xl">
    <div aria-label="Adult perspective card deck" className={styles.stage} style={{ "--drag-x": `${dragX}px` } as React.CSSProperties} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={resetGesture} onDragStart={(event) => event.preventDefault()}>
      {personas.map((persona, index) => {
        const depth = order.indexOf(index);
        const isActive = depth === 0;
        return <article key={persona.name} data-testid={`persona-card-${index}`} data-depth={depth} aria-hidden={!isActive} className={`${styles.card} flex flex-col overflow-hidden rounded-3xl border border-radiant-gold/50`}>
          <div data-testid={`persona-image-${index}`} className={`${styles.imageRegion} relative overflow-hidden bg-imperial-navy/60`}>{persona.imageSrc ? <Image src={persona.imageSrc} alt={persona.imageAlt ?? `Fictional adult scene for ${persona.name}`} fill draggable={false} sizes="(max-width: 640px) 90vw, (max-width: 900px) 62vw, 560px" className="object-cover object-center" priority={index === 0} /> : <div aria-hidden="true" className="h-full bg-gradient-to-br from-radiant-gold/20 via-imperial-navy to-background" />}<span className="absolute bottom-3 right-3 rounded-full bg-imperial-navy/90 px-3 py-1 text-xs text-platinum-white">Fictional scene</span></div>
          <div data-testid={`persona-copy-${index}`} className={`${styles.copyRegion} flex min-h-0 flex-col p-5 sm:p-7`}><h3 className="font-heading text-xs uppercase tracking-[.15em] text-radiant-gold">{persona.name}</h3><p className="mt-4 font-premium text-2xl leading-snug sm:text-3xl">{persona.headline}</p><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{persona.support}</p><details className="mt-auto pt-5 text-sm text-muted-foreground"><summary tabIndex={isActive ? 0 : -1} className="cursor-pointer font-semibold text-foreground">Contact path</summary><p className="mt-2 leading-6">{persona.channel}</p></details></div>
        </article>;
      })}
    </div>
    <button type="button" onClick={previous} aria-label="Previous adult perspective" className={`${styles.arrow} ${styles.previous}`}><span aria-hidden="true">◀</span></button>
    <button type="button" onClick={next} aria-label="Next adult perspective" className={`${styles.arrow} ${styles.next}`}><span aria-hidden="true">▶</span></button>
    <span role="status" aria-live="polite" className="sr-only">Persona {active + 1} of {personas.length}: {personas[active]?.name}</span>
    <div role="group" aria-label="Choose an adult perspective" className={styles.dots}>{personas.map((persona, index) => <button key={persona.name} type="button" aria-label={`Show ${persona.name}`} title={persona.name} aria-current={active === index ? "true" : undefined} onClick={() => select(index)} className={styles.dot}><span aria-hidden="true" /></button>)}</div>
  </div>;
}
