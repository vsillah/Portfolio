"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

const base = "/showcases/trumpet-trainer/c19989a3";
const slides = [
  { file: "01-home", title: "A place to begin", detail: "The home screen gives a beginner a clear way into practice." },
  { file: "02-journey-map", title: "See the next step", detail: "A journey map shows the available lesson path." },
  { file: "03-first-lesson", title: "Start small", detail: "The first lesson sets up one short exercise." },
  { file: "04-no-rush-wait", title: "Begin when ready", detail: "No Rush waits for the first note before the exercise moves." },
  { file: "05-gameplay-guidance", title: "Follow the note", detail: "The play screen brings the note and fingering guidance together." },
  { file: "06-results", title: "See what happened", detail: "The result screen closes this synthetic test run with feedback." },
  { file: "07-song-builder", title: "Shape a practice tune", detail: "A song builder offers another way to work with notes." },
];

export default function TrumpetGameplayCarousel() {
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  return (
    <div className="rounded-[2rem] border border-radiant-gold/30 bg-imperial-navy p-4 text-platinum-white shadow-2xl sm:p-6" role="region" aria-roledescription="carousel" aria-label="Trumpet Trainer product screens" tabIndex={0} onKeyDown={(event) => { if (event.key === "ArrowRight") { event.preventDefault(); setIndex((index + 1) % slides.length); } if (event.key === "ArrowLeft") { event.preventDefault(); setIndex((index + slides.length - 1) % slides.length); } }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="font-heading text-xs tracking-wide text-radiant-gold">REAL PRODUCT SCREENS</span>
        <span className="text-xs text-white/70">{index + 1} / {slides.length}</span>
      </div>
      <div role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${slides.length}: ${slide.title}`} aria-live="polite">
        <div className="relative mx-auto aspect-[824/1720] max-h-[550px] overflow-hidden rounded-2xl bg-[#13182a]">
          <Image src={`${base}/${slide.file}.webp`} alt={`Trumpet Trainer screen: ${slide.title}`} fill sizes="(max-width: 1024px) 75vw, 360px" className="object-contain" priority={index === 0} />
        </div>
        <h2 className="mt-5 font-premium text-2xl">{slide.title}</h2>
        <p className="mt-2 min-h-12 text-sm leading-6 text-white/75">{slide.detail}</p>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setIndex((index + slides.length - 1) % slides.length)} aria-label="Previous product screen" className="rounded-full border border-white/40 p-3 hover:border-radiant-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-radiant-gold"><ArrowLeft aria-hidden size={18} /></button>
        <div className="flex flex-wrap justify-center gap-2" aria-label="Choose a product screen">
          {slides.map((item, position) => <button key={item.file} type="button" onClick={() => setIndex(position)} aria-label={`Show screen ${position + 1}: ${item.title}`} aria-current={index === position ? "true" : undefined} className={`h-2.5 w-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-radiant-gold ${index === position ? "bg-radiant-gold" : "bg-white/40 hover:bg-white/70"}`} />)}
        </div>
        <button type="button" onClick={() => setIndex((index + 1) % slides.length)} aria-label="Next product screen" className="rounded-full border border-white/40 p-3 hover:border-radiant-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-radiant-gold"><ArrowRight aria-hidden size={18} /></button>
      </div>
      <p className="mt-4 text-center text-xs text-white/55">Captured from the product with synthetic test input.</p>
    </div>
  );
}
