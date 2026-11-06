"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./TrumpetRecruitmentTimeline.module.css";

export type TimelineStep = { days: string; title: string; detail: string };

const beatIntervalMs = 620;

export default function TrumpetRecruitmentTimeline({ steps }: { steps: TimelineStep[] }) {
  const root = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined") {
      setBeat(steps.length);
      return;
    }

    const timers: number[] = [];
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || started.current) return;
      started.current = true;
      setBeat(1);
      for (let next = 2; next <= steps.length; next += 1) {
        timers.push(window.setTimeout(() => setBeat(next), (next - 1) * beatIntervalMs));
      }
      observer.disconnect();
    }, { threshold: 0.25 });
    if (root.current) observer.observe(root.current);
    return () => {
      observer.disconnect();
      timers.forEach(window.clearTimeout);
    };
  }, [steps.length]);

  return <div ref={root} className={styles.timeline} data-beat={beat}>
    <span aria-hidden="true" className={styles.spine} />
    <div aria-hidden="true" className={styles.instrument} data-vibrate={beat === 3}>
      <Image src="/work/trumpet-trainer/design/brass-trumpet-timeline-v1.png" width={1024} height={1536} alt="" draggable={false} className={styles.trumpet} />
      <span className={`${styles.valve} ${styles.valveOne}`} data-motion-part="valve-1" data-pressed={beat === 2 || beat === 4} />
      <span className={`${styles.valve} ${styles.valveTwo}`} data-motion-part="valve-2" data-pressed={beat === 3 || beat === 5} />
      <span className={`${styles.valve} ${styles.valveThree}`} data-motion-part="valve-3" data-pressed={beat === 4 || beat === 5} />
      <span className={styles.bellLight} data-motion-part="bell" data-resolve={beat === 6} />
    </div>
    <ol className={styles.list}>
      {steps.map(({ days, title, detail }, index) => <li key={days} className={styles.step} data-active={beat === index + 1}>
        <span aria-hidden="true" className={styles.pin}>{index + 1}</span>
        <div className={`${styles.card} rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5`}><span className="text-xs font-semibold uppercase tracking-wide text-radiant-gold">Days {days}</span><h3 className="mt-1 font-premium text-xl">{title}</h3><details className="mt-2 text-sm text-muted-foreground"><summary className="cursor-pointer">Review details</summary><p className="mt-2 leading-6">{detail}</p></details></div>
      </li>)}
    </ol>
  </div>;
}
