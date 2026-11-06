"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import styles from "./TrumpetRecruitmentSocialCarousel.module.css";

const slides = Array.from({ length: 7 }, (_, index) => String(index + 1).padStart(2, "0"));
const base = "/showcases/trumpet-trainer/c19989a3/social";
const correctedSongBuilder = "/showcases/trumpet-trainer/a558583a/song-builder-capture.png";

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
  return <div role="region" aria-roledescription="carousel" aria-label="Trumpet Trainer practice screens" className="mt-4 rounded-3xl border border-border bg-card p-4 sm:p-6">
    <span className="font-heading text-xs uppercase tracking-[.15em] text-bronze dark:text-radiant-gold">A look through the app</span>
    <div className={styles.mediaRow}>
      <button type="button" onClick={() => change(selected - 1)} disabled={selected === 0} className={`${styles.arrow} ${styles.previous}`} aria-label="Previous screen" aria-controls="trumpet-social-slide"><span aria-hidden="true">◀</span></button>
      <figure id="trumpet-social-slide" role="tabpanel" aria-labelledby={`trumpet-social-tab-${selected}`} className={styles.slide}>
        {selected === 6 ? <div className={styles.songBuilderSlide}>
          <div className={styles.songBuilderCopy}>
            <Image src="/amadutown-logo-upscaled.png" alt="" width={80} height={110} className={styles.songBuilderLogo} />
            <p className={styles.songBuilderEyebrow}>Trumpet Trainer</p>
            <h4>Build a tune<br />note by note</h4>
            <p className={styles.songBuilderDescription}>Put a few notes together, hear the tune, and choose what to try next.</p>
            <span className={styles.songBuilderCount}>07 / 07</span>
          </div>
          <div className={styles.songBuilderFrame}>
            <Image src={correctedSongBuilder} alt="Trumpet Trainer screen 7 of 7: Song Builder with a two-note tune" width={1062} height={1070} sizes="(max-width: 639px) 55vw, 34vw" priority className={styles.songBuilderCapture} />
          </div>
        </div> : <Image src={`${base}/slide-${slides[selected]}.png`} alt={`Trumpet Trainer screen ${selected + 1} of ${slides.length}`} width={1080} height={1350} priority={selected === 0} className="h-auto w-full rounded-xl" />}
        <figcaption className="sr-only">Trumpet Trainer screen {selected + 1}</figcaption>
      </figure>
      <button type="button" onClick={() => change(selected + 1)} disabled={selected === slides.length - 1} className={`${styles.arrow} ${styles.next}`} aria-label="Next screen" aria-controls="trumpet-social-slide"><span aria-hidden="true">▶</span></button>
    </div>
    <span role="status" aria-live="polite" className="sr-only">Screen {selected + 1} of {slides.length}</span>
    <div role="tablist" aria-label="Choose a screen" className={styles.dots}>{slides.map((slide, index) => <button key={slide} ref={(element) => { toggles.current[index] = element; }} type="button" role="tab" id={`trumpet-social-tab-${index}`} aria-label={`Show screen ${index + 1}`} title={`Screen ${index + 1}`} aria-selected={selected === index} aria-current={selected === index ? "true" : undefined} aria-controls="trumpet-social-slide" tabIndex={selected === index ? 0 : -1} onClick={() => change(index)} onKeyDown={(event) => onToggleKey(event, index)} className={styles.dot}><span aria-hidden="true" /></button>)}</div>
  </div>;
}
