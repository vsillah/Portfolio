"use client";

import Image from "next/image";
import { useState } from "react";

type Persona = { name: string; headline: string; support: string; channel: string; imageSrc?: string; imageAlt?: string };

export default function TrumpetRecruitmentPersonas({ personas }: { personas: Persona[] }) {
  const [order, setOrder] = useState([0, 1, 2, 3]);
  const active = order[0];
  function next() { setOrder(([front, ...rest]) => [...rest, front]); }
  function previous() { setOrder((current) => [current[current.length - 1], ...current.slice(0, -1)]); }
  function select(index: number) { setOrder((current) => [index, ...current.filter((item) => item !== index)]); }

  return <div className="mt-6 max-w-4xl">
    <div aria-label="Adult perspective card deck" className="relative min-h-[560px] sm:min-h-[620px]">
      {personas.map((persona, index) => {
        const depth = order.indexOf(index);
        const isActive = depth === 0;
        return <article key={persona.name} data-testid={`persona-card-${index}`} data-depth={depth} aria-hidden={!isActive} className="absolute inset-x-2 top-0 h-[calc(100%-24px)] overflow-hidden rounded-3xl border border-radiant-gold/40 bg-card shadow-xl motion-safe:transition-[transform,opacity] motion-safe:duration-500 motion-safe:ease-out motion-reduce:transition-none sm:inset-x-4" style={{ zIndex: 4 - depth, transform: `translateY(${(3 - depth) * 8}px) scale(${1 - depth * 0.012})`, opacity: 1 - depth * 0.08 }}>
          {isActive && <div className="flex h-full flex-col">
            <div className="relative h-56 shrink-0 overflow-hidden bg-imperial-navy/60 sm:h-72 lg:h-80">{persona.imageSrc ? <Image src={persona.imageSrc} alt={persona.imageAlt ?? `Fictional adult scene for ${persona.name}`} fill sizes="(max-width: 900px) 100vw, 900px" className="object-cover object-center sm:object-contain" priority={index === 0} /> : <div aria-hidden="true" className="h-full bg-gradient-to-br from-radiant-gold/20 via-imperial-navy to-background" />}<span className="absolute bottom-3 right-3 rounded-full bg-imperial-navy/90 px-3 py-1 text-xs text-platinum-white">Fictional scene</span></div>
            <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-7"><h3 className="font-heading text-xs uppercase tracking-[.15em] text-radiant-gold">{persona.name}</h3><p className="mt-4 font-premium text-2xl leading-snug sm:text-3xl">{persona.headline}</p><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{persona.support}</p><details className="mt-auto pt-5 text-sm text-muted-foreground"><summary className="cursor-pointer font-semibold text-foreground">Contact path</summary><p className="mt-2 leading-6">{persona.channel}</p></details></div>
          </div>}
        </article>;
      })}
    </div>
    <div className="mt-5 flex items-center justify-between gap-3"><button type="button" onClick={previous} aria-label="Previous adult perspective" className="min-h-11 rounded-full border border-radiant-gold px-5 font-semibold text-radiant-gold hover:bg-radiant-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-radiant-gold">Previous</button><span role="status" aria-live="polite" className="text-center text-sm font-semibold">Persona {active + 1} of {personas.length}</span><button type="button" onClick={next} aria-label="Next adult perspective" className="min-h-11 rounded-full border border-radiant-gold px-5 font-semibold text-radiant-gold hover:bg-radiant-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-radiant-gold">Next</button></div>
    <div role="group" aria-label="Choose an adult perspective" className="mt-4 flex flex-wrap justify-center gap-2">{personas.map((persona, index) => <button key={persona.name} type="button" aria-label={`Show ${persona.name}`} aria-pressed={active === index} onClick={() => select(index)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-radiant-gold ${active === index ? "border-radiant-gold bg-radiant-gold text-imperial-navy" : "border-border bg-card text-foreground hover:border-radiant-gold"}`}>{persona.name}</button>)}</div>
  </div>;
}
