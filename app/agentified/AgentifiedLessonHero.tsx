'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import styles from './workshop.module.css'

type EndScreen = {
  startSeconds: number
  progress: number
  nextLesson?: { id: string; title: string; poster: string }
}

type Props = { lessonId: string; title: string; poster: string; altText?: string; videoSrc?: string; captionsSrc?: string; durationSeconds?: number; resumeSeconds?: number; endScreen?: EndScreen; onProgress?: (seconds: number) => void }

/** Video is an explicit future input. Without an approved source the hero is a static cover. */
export function AgentifiedLessonHero({ lessonId, title, poster, altText, videoSrc, captionsSrc, durationSeconds, resumeSeconds = 0, endScreen, onProgress }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [posterRevealed, setPosterRevealed] = useState(false)
  const [endScreenVisible, setEndScreenVisible] = useState(false)

  useEffect(() => {
    setPosterRevealed(false)
    setEndScreenVisible(false)
    videoRef.current?.pause()
    if (videoRef.current) videoRef.current.currentTime = 0
  }, [lessonId, videoSrc])

  const label = `${lessonId} ${title} lesson cover`
  const syncEndScreen = (currentTime: number) => setEndScreenVisible(Boolean(endScreen && currentTime >= endScreen.startSeconds))
  return <div className={styles.coverStage} aria-label={label}>
    {videoSrc ? <video ref={videoRef} className={`${styles.lessonVideo}${posterRevealed ? ` ${styles.videoReveal}` : ''}`} controls playsInline preload="metadata" poster={poster} aria-label={`${lessonId} ${title} guided video`} onLoadedMetadata={(event) => { if (resumeSeconds > 0 && resumeSeconds < event.currentTarget.duration - 2) event.currentTarget.currentTime = resumeSeconds; syncEndScreen(event.currentTarget.currentTime); const track = event.currentTarget.textTracks[0]; if (track) track.mode = 'showing' }} onTimeUpdate={(event) => { syncEndScreen(event.currentTarget.currentTime); const seconds = Math.floor(event.currentTarget.currentTime); if (seconds > 0 && seconds % 5 === 0) onProgress?.(seconds) }} onSeeking={(event) => syncEndScreen(event.currentTarget.currentTime)} onPause={(event) => onProgress?.(Math.floor(event.currentTarget.currentTime))} onEnded={() => { setEndScreenVisible(Boolean(endScreen)); onProgress?.(Math.floor(durationSeconds ?? 540)) }} onPlaying={() => setPosterRevealed(true)} onEmptied={() => { setPosterRevealed(false); setEndScreenVisible(false) }}>
      <source src={videoSrc} type="video/mp4" />
      {captionsSrc && <track kind="captions" src={captionsSrc} srcLang="en" label="English" default />}
      Your browser cannot play this video. The read-along transcript is available below.
    </video> : <Image src={poster} alt={altText ?? label} width={1280} height={720} sizes="(max-width: 900px) 100vw, 50vw" priority={lessonId === 'L01'} />}
    {endScreenVisible && endScreen && <div className={styles.endScreen} role="status" aria-label={endScreen.nextLesson ? `${lessonId} complete. Up next, ${endScreen.nextLesson.id}: ${endScreen.nextLesson.title}.` : `${lessonId} complete. Agentified course complete.`}>
      <div className={styles.endScreenSummary}>
        <span className={styles.endScreenCheck} aria-hidden="true">✓</span>
        <p>LESSON {String(endScreen.progress).padStart(2, '0')} COMPLETE</p>
        <strong>{endScreen.nextLesson ? 'Your operating file is taking shape.' : 'Your Agentified operating system is ready for review.'}</strong>
        <small>{endScreen.progress} OF 16</small>
        <div className={styles.endScreenProgress} aria-hidden="true"><span style={{ width: `${(endScreen.progress / 16) * 100}%` }} /></div>
      </div>
      {endScreen.nextLesson ? <div className={styles.endScreenNext}>
        <Image src={endScreen.nextLesson.poster} alt="" width={720} height={405} sizes="(max-width: 620px) 42vw, 34vw" />
        <p>UP NEXT · {endScreen.nextLesson.id}</p>
        <strong>{endScreen.nextLesson.title}</strong>
      </div> : <div className={styles.endScreenComplete}>
        <Image src="/amadutown-logo-upscaled.png" alt="" width={96} height={120} />
        <p>COURSE COMPLETE</p>
        <strong>Review your Operating File</strong>
      </div>}
    </div>}
  </div>
}
