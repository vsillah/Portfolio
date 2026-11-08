'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import styles from './workshop.module.css'

type Props = { lessonId: string; title: string; poster: string; altText?: string; videoSrc?: string; captionsSrc?: string; durationSeconds?: number; resumeSeconds?: number; onProgress?: (seconds: number) => void }

/** Video is an explicit future input. Without an approved source the hero is a static cover. */
export function AgentifiedLessonHero({ lessonId, title, poster, altText, videoSrc, captionsSrc, durationSeconds, resumeSeconds = 0, onProgress }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [posterRevealed, setPosterRevealed] = useState(false)

  useEffect(() => {
    setPosterRevealed(false)
    videoRef.current?.pause()
    if (videoRef.current) videoRef.current.currentTime = 0
  }, [lessonId, videoSrc])

  const label = `${lessonId} ${title} lesson cover`
  return <div className={styles.coverStage} aria-label={label}>
    {videoSrc ? <video ref={videoRef} className={posterRevealed ? styles.videoReveal : undefined} controls playsInline preload="metadata" poster={poster} aria-label={`${lessonId} ${title} guided video`} onLoadedMetadata={(event) => { if (resumeSeconds > 0 && resumeSeconds < event.currentTarget.duration - 2) event.currentTarget.currentTime = resumeSeconds; const track = event.currentTarget.textTracks[0]; if (track) track.mode = 'showing' }} onTimeUpdate={(event) => { const seconds = Math.floor(event.currentTarget.currentTime); if (seconds > 0 && seconds % 5 === 0) onProgress?.(seconds) }} onPause={(event) => onProgress?.(Math.floor(event.currentTarget.currentTime))} onEnded={() => onProgress?.(Math.floor(durationSeconds ?? 540))} onPlaying={() => setPosterRevealed(true)} onEmptied={() => setPosterRevealed(false)}>
      <source src={videoSrc} type="video/mp4" />
      {captionsSrc && <track kind="captions" src={captionsSrc} srcLang="en" label="English" default />}
      Your browser cannot play this video. The read-along transcript is available below.
    </video> : <Image src={poster} alt={altText ?? label} width={1280} height={720} sizes="(max-width: 900px) 100vw, 50vw" priority={lessonId === 'L01'} />}
  </div>
}
