'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import styles from './workshop.module.css'
import mobileTeachingDetails from './mobile-teaching-details.json'
import type { CaptionSize } from '@/lib/caption-size-preference'
import captionStyles from '@/components/captions/captions.module.css'

type EndScreen = {
  startSeconds: number
  progress: number
  nextLesson?: { id: string; title: string; poster: string }
}

type Props = { lessonId: string; title: string; poster: string; altText?: string; videoSrc?: string; captionsSrc?: string; captionsOn?: boolean; captionSize?: CaptionSize; durationSeconds?: number; resumeSeconds?: number; endScreen?: EndScreen; onProgress?: (seconds: number) => void; onCaptionsChange?: (enabled: boolean) => void }

// Scene bounds match presentation-illustration-audit/audit-boundaries.json.
const l07DesktopCaptionClearance = [
  { sceneId: 'L07-01', startSeconds: 0, endSeconds: 27.99, line: 4 },
  { sceneId: 'L07-06', startSeconds: 153.479, endSeconds: 160.078, line: 52 },
] as const

const l01CaptionClearance = { startSeconds: 34.585, endSeconds: 74.197 } as const

/** Video is an explicit future input. Without an approved source the hero is a static cover. */
export function AgentifiedLessonHero({ lessonId, title, poster, altText, videoSrc, captionsSrc, captionsOn = true, captionSize = 'M', durationSeconds, resumeSeconds = 0, endScreen, onProgress, onCaptionsChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [posterRevealed, setPosterRevealed] = useState(false)
  const [endScreenVisible, setEndScreenVisible] = useState(false)
  const [activeTeachingScene, setActiveTeachingScene] = useState<string | null>(null)
  const [mobileWidth, setMobileWidth] = useState(false)
  const [mobileCaption, setMobileCaption] = useState('')
  const externalCaption = mobileWidth || captionSize === 'L' || /^L(0[8-9]|1[0-6])$/.test(lessonId) || (lessonId === 'L06' && activeTeachingScene === 'L06-03') || (lessonId === 'L01' && activeTeachingScene === 'L01-02')
  const cueCacheRef = useRef<Array<{ startTime: number; endTime: number; text: string }>>([])
  const endScreenStart = endScreen?.startSeconds
  const captionsChangeRef = useRef(onCaptionsChange)
  captionsChangeRef.current = onCaptionsChange

  const syncMobileCaption = useCallback(() => {
    const video = videoRef.current
    const track = video?.textTracks[0]
    if (!video || !track || !externalCaption || (endScreenStart !== undefined && video.currentTime >= endScreenStart)) {
      setMobileCaption('')
      return
    }
    const loadedCues = Array.from(track.cues ?? [], (cue) => ({ startTime: cue.startTime, endTime: cue.endTime, text: (cue as VTTCue).text }))
    if (loadedCues.length) cueCacheRef.current = loadedCues
    const time = video.currentTime
    setMobileCaption((loadedCues.length ? loadedCues : cueCacheRef.current).filter((cue) => cue.startTime <= time && time < cue.endTime).map((cue) => cue.text).join('\n'))
  }, [endScreenStart, externalCaption])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(max-width: 620px)')
    const sync = () => setMobileWidth(media.matches)
    media.addEventListener?.('change', sync)
    sync()
    return () => media.removeEventListener?.('change', sync)
  }, [])

  useEffect(() => {
    const track = videoRef.current?.textTracks[0]
    if (!track) return
    const mode = captionsOn ? externalCaption ? 'hidden' : 'showing' : 'disabled'
    if (track.mode !== mode) track.mode = mode
    syncMobileCaption()
  }, [captionsOn, externalCaption, syncMobileCaption, videoSrc])

  useEffect(() => {
    const trackElement = videoRef.current?.querySelector('track')
    const track = trackElement?.track
    if (!trackElement || !track) return
    trackElement.addEventListener('load', syncMobileCaption)
    track.addEventListener('cuechange', syncMobileCaption)
    return () => {
      trackElement.removeEventListener('load', syncMobileCaption)
      track.removeEventListener('cuechange', syncMobileCaption)
    }
  }, [captionsSrc, syncMobileCaption])

  useEffect(() => {
    if (lessonId !== 'L07') return
    const trackElement = videoRef.current?.querySelector('track')
    const track = trackElement?.track
    if (!trackElement || !track) return
    const desktop = window.matchMedia('(min-width: 621px)')
    // Keep native captions and controls while clearing these two desktop labels.
    const positionSceneCues = () => {
      for (const cue of Array.from(track.cues ?? [])) {
        const scene = l07DesktopCaptionClearance.find(({ startSeconds, endSeconds }) => cue.startTime >= startSeconds && cue.startTime < endSeconds)
        if (!scene || !('snapToLines' in cue)) continue
        const positionedCue = cue as VTTCue
        positionedCue.snapToLines = !desktop.matches
        positionedCue.line = desktop.matches ? scene.line : 'auto'
      }
    }
    trackElement.addEventListener('load', positionSceneCues)
    track.addEventListener('cuechange', positionSceneCues)
    desktop.addEventListener?.('change', positionSceneCues)
    positionSceneCues()
    return () => {
      trackElement.removeEventListener('load', positionSceneCues)
      track.removeEventListener('cuechange', positionSceneCues)
      desktop.removeEventListener?.('change', positionSceneCues)
    }
  }, [lessonId, captionsSrc])

  useEffect(() => {
    const tracks = videoRef.current?.textTracks
    if (!tracks || typeof tracks.addEventListener !== 'function') return
    const sync = () => {
      const track = tracks[0]
      if (externalCaption && track?.mode === 'showing') track.mode = 'hidden'
      captionsChangeRef.current?.(Array.from(tracks).some((item) => item.mode === 'showing' || (externalCaption && item.mode === 'hidden')))
    }
    tracks.addEventListener('change', sync)
    return () => tracks.removeEventListener('change', sync)
  }, [lessonId, videoSrc, externalCaption])

  useEffect(() => {
    setPosterRevealed(false)
    setEndScreenVisible(false)
    setActiveTeachingScene(null)
    setMobileCaption('')
    cueCacheRef.current = []
    videoRef.current?.pause()
    if (videoRef.current) videoRef.current.currentTime = 0
  }, [lessonId, videoSrc])

  const label = `${lessonId} ${title} lesson cover`
  const syncEndScreen = (currentTime: number) => setEndScreenVisible(Boolean(endScreen && currentTime >= endScreen.startSeconds))
  const lessonTeachingScenes = mobileTeachingDetails.scenes.filter((scene) => scene.lessonId === lessonId)
  const syncScene = (currentTime: number) => {
    setActiveTeachingScene(lessonTeachingScenes.find((scene) => currentTime >= scene.startSeconds && currentTime < scene.endSeconds)?.sceneId ?? (lessonId === 'L01' && currentTime >= l01CaptionClearance.startSeconds && currentTime < l01CaptionClearance.endSeconds ? 'L01-02' : null))
  }
  const teachingScene = lessonTeachingScenes.find((scene) => scene.sceneId === activeTeachingScene)
  useEffect(() => {
    if (lessonId !== 'L07' || !videoSrc) return
    const video = videoRef.current
    const gate = mobileTeachingDetails.scenes.find((scene) => scene.sceneId === 'L07-07')
    if (!video || !gate) return
    let frame = 0
    const syncGate = () => {
      const inside = video.currentTime >= gate.startSeconds && video.currentTime < gate.endSeconds
      setActiveTeachingScene((current) => inside ? gate.sceneId : current === gate.sceneId ? null : current)
    }
    const tick = () => {
      syncGate()
      if (!video.paused && !video.ended) frame = requestAnimationFrame(tick)
    }
    const start = () => {
      cancelAnimationFrame(frame)
      tick()
    }
    const stop = () => {
      cancelAnimationFrame(frame)
      syncGate()
    }
    video.addEventListener('playing', start)
    video.addEventListener('pause', stop)
    video.addEventListener('seeked', syncGate)
    if (!video.paused) start()
    return () => {
      cancelAnimationFrame(frame)
      video.removeEventListener('playing', start)
      video.removeEventListener('pause', stop)
      video.removeEventListener('seeked', syncGate)
    }
  }, [lessonId, videoSrc])
  return <><div className={styles.coverStage} aria-label={label}>
    {videoSrc ? <video ref={videoRef} data-caption-size={captionSize} className={`${styles.lessonVideo} ${captionStyles.nativeVideo}${posterRevealed ? ` ${styles.videoReveal}` : ''}`} controls playsInline preload="metadata" poster={poster} aria-label={`${lessonId} ${title} guided video`} onLoadedMetadata={(event) => { if (resumeSeconds > 0 && resumeSeconds < event.currentTarget.duration - 2) event.currentTarget.currentTime = resumeSeconds; syncEndScreen(event.currentTarget.currentTime); syncScene(event.currentTarget.currentTime); const track = event.currentTarget.textTracks[0]; if (track) track.mode = captionsOn ? externalCaption ? 'hidden' : 'showing' : 'disabled'; captionsChangeRef.current?.(captionsOn); syncMobileCaption() }} onTimeUpdate={(event) => { syncEndScreen(event.currentTarget.currentTime); syncScene(event.currentTarget.currentTime); syncMobileCaption(); const seconds = Math.floor(event.currentTarget.currentTime); if (seconds > 0 && seconds % 5 === 0) onProgress?.(seconds) }} onSeeking={(event) => { syncEndScreen(event.currentTarget.currentTime); syncScene(event.currentTarget.currentTime); syncMobileCaption() }} onSeeked={() => syncMobileCaption()} onPause={(event) => { syncMobileCaption(); onProgress?.(Math.floor(event.currentTarget.currentTime)) }} onEnded={() => { setEndScreenVisible(Boolean(endScreen)); setActiveTeachingScene(null); setMobileCaption(''); onProgress?.(Math.floor(durationSeconds ?? 540)) }} onPlaying={() => setPosterRevealed(true)} onEmptied={() => { setPosterRevealed(false); setEndScreenVisible(false); setActiveTeachingScene(null); setMobileCaption('') }}>
      <source src={videoSrc} type="video/mp4" />
      {captionsSrc && <track kind="captions" src={captionsSrc} srcLang="en" label="English" default onLoad={() => syncMobileCaption()} />}
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
  </div>{videoSrc && externalCaption && captionsOn && mobileCaption && !endScreenVisible && <div className={`${styles.mobileCaptionBand} ${captionStyles.band}`} data-caption-size={captionSize} role="status" aria-label={`${lessonId} caption`}>{mobileCaption}</div>}{videoSrc && teachingScene && <aside className={styles.mobileTeachingDetails} aria-label={`${teachingScene.sceneId} ${teachingScene.title} source wording`}>
    <div className={styles.mobileTeachingHeading}><strong>{teachingScene.title}</strong>{'image' in teachingScene && <a href={teachingScene.image} target="_blank" rel="noopener noreferrer" onClick={() => videoRef.current?.pause()}>Open full plate</a>}</div>
    {teachingScene.details.length > 0 && <div className={styles.mobileTeachingCopy}>{teachingScene.details.map((detail) => <div key={detail.label}><strong>{detail.label}</strong><span>{detail.description}</span></div>)}</div>}
  </aside>}</>
}
