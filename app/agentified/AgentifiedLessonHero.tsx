'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import styles from './workshop.module.css'

type Props = { lessonId: string; title: string; poster: string; videoSrc?: string; captionsSrc?: string }

/** Video is an explicit future input. Without an approved source the hero is a static cover. */
export function AgentifiedLessonHero({ lessonId, title, poster, videoSrc, captionsSrc }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [posterRevealed, setPosterRevealed] = useState(false)

  useEffect(() => {
    setPosterRevealed(false)
    videoRef.current?.pause()
    if (videoRef.current) videoRef.current.currentTime = 0
  }, [lessonId, videoSrc])

  const label = `${lessonId} ${title} lesson cover`
  return <div className={styles.coverStage} aria-label={label}>
    {videoSrc ? <video ref={videoRef} className={posterRevealed ? styles.videoReveal : undefined} controls playsInline preload="metadata" poster={poster} aria-label={`${lessonId} ${title} guided video`} onPlaying={() => setPosterRevealed(true)} onEmptied={() => setPosterRevealed(false)}>
      <source src={videoSrc} type="video/mp4" />
      {captionsSrc && <track kind="captions" src={captionsSrc} srcLang="en" label="English" default />}
      Your browser cannot play this video. The read-along transcript is available below.
    </video> : <Image src={poster} alt={label} width={1280} height={720} sizes="(max-width: 900px) 100vw, 50vw" priority={lessonId === 'L01'} />}
  </div>
}
