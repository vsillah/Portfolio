"use client";
/* eslint-disable @next/next/no-img-element -- Native image loading starts and stops Safari's transparent animation. */

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./TrumpetRecruitmentTimeline.module.css";

export type TimelineStep = { days: string; title: string; detail: string };

const asset = "/work/trumpet-trainer/design/trumpet-timeline";
const beatTimes = [0, 1.26, 3.24, 4.28, 5.40, 6.40];

export default function TrumpetRecruitmentTimeline({ steps }: { steps: TimelineStep[] }) {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const started = useRef(false);
  const safariTimers = useRef<number[]>([]);
  const [beat, setBeat] = useState(0);
  const [staticPoster, setStaticPoster] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [safariMedia, setSafariMedia] = useState<boolean | null>(null);
  const [safariAnimated, setSafariAnimated] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setSafariMedia(/iPad|iPhone|iPod/.test(ua) || (/Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)));
  }, []);

  useEffect(() => {
    if (safariMedia === null) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      setStaticPoster(true);
      setBeat(steps.length);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || started.current) return;
      started.current = true;
      observer.disconnect();
      if (safariMedia) {
        setSafariAnimated(true);
        return;
      }
      const player = video.current;
      if (!player) {
        setStaticPoster(true);
        setBeat(steps.length);
        return;
      }
      player.play().then(() => setBeat((current) => Math.max(current, 1))).catch(() => {
        setPlaying(false);
        setStaticPoster(true);
        setBeat(steps.length);
      });
    }, { threshold: 0.25 });
    if (root.current) observer.observe(root.current);
    return () => {
      observer.disconnect();
      safariTimers.current.forEach(window.clearTimeout);
      safariTimers.current = [];
    };
  }, [safariMedia, steps.length]);

  const failMedia = () => {
    safariTimers.current.forEach(window.clearTimeout);
    safariTimers.current = [];
    setPlaying(false);
    setStaticPoster(true);
    setBeat(steps.length);
  };

  const startSafariBeats = () => {
    setPlaying(true);
    setBeat(1);
    safariTimers.current = beatTimes.slice(1, steps.length).map((time, index) =>
      window.setTimeout(() => setBeat(index + 2), time * 1000));
    safariTimers.current.push(window.setTimeout(() => {
      setPlaying(false);
      setStaticPoster(true);
    }, 7000));
  };

  const updateBeat = () => {
    const elapsed = video.current?.currentTime ?? 0;
    const next = beatTimes.reduce((current, time, index) => elapsed >= time ? index + 1 : current, 1);
    setBeat(Math.min(next, steps.length));
  };

  return <div ref={root} className={styles.timeline} data-beat={beat}>
    <span aria-hidden="true" className={styles.spine} />
    <div aria-hidden="true" className={styles.instrument}>
      {!playing && <Image src={`${asset}-poster.png`} width={512} height={768} alt="" draggable={false} priority className={styles.trumpet} />}
      {!staticPoster && safariMedia && safariAnimated && <img src={`${asset}.webp`} width={512} height={768} alt="" draggable={false} onLoad={startSafariBeats} onError={failMedia} className={`${styles.trumpet} ${styles.video} ${playing ? "" : styles.videoPending}`} />}
      {!staticPoster && safariMedia === false && <video ref={video} className={`${styles.trumpet} ${styles.video} ${playing ? "" : styles.videoPending}`} poster={`${asset}-poster.png`} preload="auto" muted playsInline onPlaying={() => setPlaying(true)} onTimeUpdate={updateBeat} onEnded={() => setBeat(steps.length)} onError={failMedia}>
          <source src={`${asset}.webm`} type="video/webm" />
          <source src={`${asset}.mp4`} type="video/mp4" />
        </video>}
    </div>
    <ol className={styles.list}>
      {steps.map(({ days, title, detail }, index) => <li key={days} className={styles.step} data-active={beat === index + 1}>
        <span aria-hidden="true" className={styles.pin}>{index + 1}</span>
        <div className={`${styles.card} rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5`}><span className="text-xs font-semibold uppercase tracking-wide text-radiant-gold">Days {days}</span><h3 className="mt-1 font-premium text-xl">{title}</h3><details className="mt-2 text-sm text-muted-foreground"><summary className="cursor-pointer">Review details</summary><p className="mt-2 leading-6">{detail}</p></details></div>
      </li>)}
    </ol>
  </div>;
}
