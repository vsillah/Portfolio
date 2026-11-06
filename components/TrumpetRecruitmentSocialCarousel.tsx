"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import styles from "./TrumpetRecruitmentSocialCarousel.module.css";

const slides = Array.from({ length: 7 }, (_, index) => String(index + 1).padStart(2, "0"));
const base = "/showcases/trumpet-trainer/c19989a3/social";
const correctedSongBuilder = "/showcases/trumpet-trainer/a558583a/social/slide-07.png";

export default function TrumpetRecruitmentSocialCarousel() {
  const [selected, setSelected] = useState(0);
  const toggles = useRef<Array<HTMLButtonElement | null>>([]);
  const change = (next: number) => setSelected(Math.max(0, Math.min(slides.length - 1, next)));
  function onToggleKey(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? Math.min(index + 1, slides.length - 1) : event.key === "ArrowLeft" ? Math.max(index - 1, 0) : event.key === "Home" ? 0 : event.key === "End" ? slides.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    change(next);
    toggles.current[next]?.focus();
  }
  return <div role="region" aria-roledescription="carousel" aria-label="Trumpet Trainer social carousel slides" className="mt-4 rounded-3xl border border-border bg-card p-4 sm:p-6">
    <span className="font-heading text-xs uppercase tracking-[.15em] text-radiant-gold">Approved review slides</span>
    <div className={styles.mediaRow}>
      <button type="button" onClick={() => change(selected - 1)} disabled={selected === 0} className={`${styles.arrow} ${styles.previous}`} aria-label="Previous social slide" aria-controls="trumpet-social-slide"><span aria-hidden="true">◀</span></button>
      <figure id="trumpet-social-slide" role="tabpanel" aria-labelledby={`trumpet-social-tab-${selected}`} className={styles.slide}><Image src={selected === 6 ? correctedSongBuilder : `${base}/slide-${slides[selected]}.png`} alt={`Social carousel slide ${selected + 1} of ${slides.length}`} width={1080} height={1350} priority={selected === 0} className="h-auto w-full rounded-xl" /><figcaption className="sr-only">Approved Trumpet Trainer social slide {selected + 1}</figcaption></figure>
      <button type="button" onClick={() => change(selected + 1)} disabled={selected === slides.length - 1} className={`${styles.arrow} ${styles.next}`} aria-label="Next social slide" aria-controls="trumpet-social-slide"><span aria-hidden="true">▶</span></button>
    </div>
    <span role="status" aria-live="polite" className="sr-only">Slide {selected + 1} of {slides.length}</span>
    <div role="tablist" aria-label="Choose a social slide" className={styles.dots}>{slides.map((slide, index) => <button key={slide} ref={(element) => { toggles.current[index] = element; }} type="button" role="tab" id={`trumpet-social-tab-${index}`} aria-label={`Show social slide ${index + 1}`} title={`Slide ${index + 1}`} aria-selected={selected === index} aria-current={selected === index ? "true" : undefined} aria-controls="trumpet-social-slide" tabIndex={selected === index ? 0 : -1} onClick={() => change(index)} onKeyDown={(event) => onToggleKey(event, index)} className={styles.dot}><span aria-hidden="true" /></button>)}</div>
  </div>;
}
