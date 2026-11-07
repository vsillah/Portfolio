'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import styles from './workshop.module.css'

type Props = { lessonId: string; title: string; poster: string; altText?: string; videoSrc?: string; captionsSrc?: string; resumeSeconds?: number; onProgress?: (seconds: number) => void }

export function AgentifiedLessonHero({ lessonId, title, poster, altText, videoSrc, captionsSrc, resumeSeconds = 0, onProgress }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [posterRevealed, setPosterRevealed] = useState(false)

  useEffect(() => {
    setPosterRevealed(false)
    videoRef.current?.pause()
    if (videoRef.current) videoRef.current.currentTime = 0
  }, [lessonId, videoSrc])

  const label = `${lessonId} ${title} lesson cover`
  const recordProgress = () => {
    const seconds = Math.floor(videoRef.current?.currentTime ?? 0)
    if (seconds > 0) onProgress?.(seconds)
  }
  return <div className={styles.coverStage} aria-label={label}>
    {videoSrc ? <video ref={videoRef} className={posterRevealed ? styles.videoReveal : undefined} controls playsInline preload="metadata" poster={poster} aria-label={`${lessonId} ${title} guided video`} onLoadedMetadata={() => { if (videoRef.current && resumeSeconds > 0) videoRef.current.currentTime = Math.min(resumeSeconds, 539) }} onTimeUpdate={() => { const seconds = Math.floor(videoRef.current?.currentTime ?? 0); if (seconds > 0 && seconds % 5 === 0) recordProgress() }} onPause={recordProgress} onEnded={() => onProgress?.(540)} onPlaying={() => setPosterRevealed(true)} onEmptied={() => setPosterRevealed(false)}>
      <source src={videoSrc} type="video/mp4" />
      {captionsSrc && <track kind="captions" src={captionsSrc} srcLang="en" label="English" default />}
      Your browser cannot play this video. The read-along transcript is available below.
    </video> : <Image src={poster} alt={altText ?? label} width={1280} height={720} sizes="(max-width: 900px) 100vw, 50vw" priority={lessonId === 'L01'} />}
  </div>
}
