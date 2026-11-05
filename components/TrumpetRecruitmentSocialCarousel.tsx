"use client";

import Image from "next/image";
import { useRef, useState } from "react";

const slides = Array.from({ length: 7 }, (_, index) => String(index + 1).padStart(2, "0"));
const base = "/showcases/trumpet-trainer/c19989a3/social";

export default function TrumpetRecruitmentSocialCarousel() {
  const [selected, setSelected] = useState(0);
  const toggles = useRef<Array<HTMLButtonElement | null>>([]);
  const change = (next: number) => setSelected((next + slides.length) % slides.length);
  function onToggleKey(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % slides.length : event.key === "ArrowLeft" ? (index + slides.length - 1) % slides.length : event.key === "Home" ? 0 : event.key === "End" ? slides.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    change(next);
    toggles.current[next]?.focus();
  }
  return <div role="region" aria-roledescription="carousel" aria-label="Trumpet Trainer social carousel slides" className="mt-4 rounded-3xl border border-border bg-card p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-heading text-xs uppercase tracking-[.15em] text-radiant-gold">Approved review slides</span><span role="status" aria-live="polite" className="text-sm font-semibold">Slide {selected + 1} of {slides.length}</span></div>
    <figure id="trumpet-social-slide" role="tabpanel" aria-labelledby={`trumpet-social-tab-${selected}`} className="mt-4"><Image src={`${base}/slide-${slides[selected]}.png`} alt={`Social carousel slide ${selected + 1} of ${slides.length}`} width={1080} height={1350} priority={selected === 0} className="mx-auto h-auto w-full max-w-[360px] rounded-xl" /><figcaption className="sr-only">Approved Trumpet Trainer social slide {selected + 1}</figcaption></figure>
    <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={() => change(selected - 1)} className="min-h-11 rounded-full border border-radiant-gold px-4 font-semibold text-radiant-gold hover:bg-radiant-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-radiant-gold" aria-label="Previous social slide">Previous</button><button type="button" onClick={() => change(selected + 1)} className="min-h-11 rounded-full border border-radiant-gold px-4 font-semibold text-radiant-gold hover:bg-radiant-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-radiant-gold" aria-label="Next social slide">Next</button></div>
    <div role="tablist" aria-label="Choose a social slide" className="mt-4 flex flex-wrap justify-center gap-2">{slides.map((slide, index) => <button key={slide} ref={(element) => { toggles.current[index] = element; }} type="button" role="tab" id={`trumpet-social-tab-${index}`} aria-label={`Show social slide ${index + 1}`} aria-selected={selected === index} aria-controls="trumpet-social-slide" tabIndex={selected === index ? 0 : -1} onClick={() => change(index)} onKeyDown={(event) => onToggleKey(event, index)} className={`min-h-11 min-w-11 rounded-full border text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-radiant-gold ${selected === index ? "border-radiant-gold bg-radiant-gold text-imperial-navy" : "border-border text-foreground hover:border-radiant-gold"}`}>{index + 1}</button>)}</div>
  </div>;
}
