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

  return <div className="mt-6 max-w-4xl">
    <div aria-label="Adult perspective card deck" className={styles.stage} style={{ "--drag-x": `${dragX}px` } as React.CSSProperties} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={resetGesture} onDragStart={(event) => event.preventDefault()}>
      {personas.map((persona, index) => {
        const depth = order.indexOf(index);
        const isActive = depth === 0;
        return <article key={persona.name} data-testid={`persona-card-${index}`} data-depth={depth} aria-hidden={!isActive} className={`${styles.card} flex flex-col overflow-hidden rounded-3xl border border-radiant-gold/50`}>
          <div className="relative h-56 shrink-0 overflow-hidden bg-imperial-navy/60 sm:h-72 lg:h-80">{persona.imageSrc ? <Image src={persona.imageSrc} alt={persona.imageAlt ?? `Fictional adult scene for ${persona.name}`} fill draggable={false} sizes="(max-width: 640px) 90vw, (max-width: 900px) 62vw, 560px" className="object-cover object-center sm:object-contain" priority={index === 0} /> : <div aria-hidden="true" className="h-full bg-gradient-to-br from-radiant-gold/20 via-imperial-navy to-background" />}<span className="absolute bottom-3 right-3 rounded-full bg-imperial-navy/90 px-3 py-1 text-xs text-platinum-white">Fictional scene</span></div>
          <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-7"><h3 className="font-heading text-xs uppercase tracking-[.15em] text-radiant-gold">{persona.name}</h3><p className="mt-4 font-premium text-2xl leading-snug sm:text-3xl">{persona.headline}</p><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{persona.support}</p><details className="mt-auto pt-5 text-sm text-muted-foreground"><summary tabIndex={isActive ? 0 : -1} className="cursor-pointer font-semibold text-foreground">Contact path</summary><p className="mt-2 leading-6">{persona.channel}</p></details></div>
        </article>;
      })}
    </div>
    <div className="mt-5 flex items-center justify-between gap-3"><button type="button" onClick={previous} aria-label="Previous adult perspective" className="min-h-11 rounded-full border border-radiant-gold px-5 font-semibold text-radiant-gold hover:bg-radiant-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-radiant-gold">Previous</button><span role="status" aria-live="polite" className="text-center text-sm font-semibold">Persona {active + 1} of {personas.length}<span className="sr-only">: {personas[active]?.name}</span></span><button type="button" onClick={next} aria-label="Next adult perspective" className="min-h-11 rounded-full border border-radiant-gold px-5 font-semibold text-radiant-gold hover:bg-radiant-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-radiant-gold">Next</button></div>
    <div role="group" aria-label="Choose an adult perspective" className="mt-4 flex flex-wrap justify-center gap-2">{personas.map((persona, index) => <button key={persona.name} type="button" aria-label={`Show ${persona.name}`} aria-pressed={active === index} onClick={() => select(index)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-radiant-gold ${active === index ? "border-radiant-gold bg-radiant-gold text-imperial-navy" : "border-border bg-card text-foreground hover:border-radiant-gold"}`}>{persona.name}</button>)}</div>
  </div>;
}
