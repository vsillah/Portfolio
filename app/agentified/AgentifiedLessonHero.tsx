'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Maximize2, Minimize2, Pause, Play, Volume2, VolumeX } from 'lucide-react'
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

const l07ExternalCaptionClearance = [
  { sceneId: 'L07-01', startSeconds: 0, endSeconds: 27.99 },
  { sceneId: 'L07-02', startSeconds: 27.99, endSeconds: 65.494 },
  { sceneId: 'L07-03', startSeconds: 65.494, endSeconds: 92.669 },
  { sceneId: 'L07-04', startSeconds: 92.669, endSeconds: 127.108 },
  { sceneId: 'L07-05', startSeconds: 127.108, endSeconds: 153.479 },
  { sceneId: 'L07-06', startSeconds: 153.479, endSeconds: 160.078 },
  { sceneId: 'L07-07', startSeconds: 160.078, endSeconds: 233.648 },
] as const

const l01CaptionClearance = [
  { sceneId: 'L01-02', startSeconds: 34.585, endSeconds: 74.197 },
  { sceneId: 'L01-04', startSeconds: 114.358, endSeconds: 150.501 },
  { sceneId: 'L01-05', startSeconds: 150.501, endSeconds: 183.059 },
  { sceneId: 'L01-08', startSeconds: 343.059, endSeconds: 359.645 },
] as const

const l05CaptionClearance = [
  { sceneId: 'L05-01', startSeconds: 11.91, endSeconds: 24.779 },
  { sceneId: 'L05-02', startSeconds: 24.779, endSeconds: 52.822 },
  { sceneId: 'L05-03', startSeconds: 52.822, endSeconds: 78.582 },
  { sceneId: 'L05-04', startSeconds: 78.582, endSeconds: 105.56 },
  { sceneId: 'L05-05', startSeconds: 105.56, endSeconds: 136.581 },
  { sceneId: 'L05-06', startSeconds: 136.581, endSeconds: 144.329 },
  { sceneId: 'L05-07', startSeconds: 144.329, endSeconds: 219.992 },
  { sceneId: 'L05-08', startSeconds: 219.992, endSeconds: 234.398 },
] as const

const l06CaptionClearance = [
  { sceneId: 'L06-01', startSeconds: 0, endSeconds: 28.639 },
  { sceneId: 'L06-02', startSeconds: 28.639, endSeconds: 65.532 },
  { sceneId: 'L06-03', startSeconds: 65.532, endSeconds: 97.482 },
  { sceneId: 'L06-04', startSeconds: 97.482, endSeconds: 132.486 },
  { sceneId: 'L06-05', startSeconds: 132.486, endSeconds: 162.599 },
  { sceneId: 'L06-06', startSeconds: 162.599, endSeconds: 169.015 },
  { sceneId: 'L06-07', startSeconds: 169.015, endSeconds: 243.974 },
  { sceneId: 'L06-08', startSeconds: 243.974, endSeconds: 255.493 },
] as const

/** Video is an explicit future input. Without an approved source the hero is a static cover. */
export function AgentifiedLessonHero({ lessonId, title, poster, altText, videoSrc, captionsSrc, captionsOn = true, captionSize = 'M', durationSeconds, resumeSeconds = 0, endScreen, onProgress, onCaptionsChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [mediaDuration, setMediaDuration] = useState(durationSeconds ?? 0)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const savedVolumeRef = useRef(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [playerMessage, setPlayerMessage] = useState('')
  const [posterRevealed, setPosterRevealed] = useState(false)
  const [endScreenVisible, setEndScreenVisible] = useState(false)
  const [activeTeachingScene, setActiveTeachingScene] = useState<string | null>(null)
  const [captionTime, setCaptionTime] = useState(0)
  const [mobileWidth, setMobileWidth] = useState(false)
  const [mobileCaption, setMobileCaption] = useState('')
  const externalCaption = mobileWidth || captionSize === 'L' || /^L(0[8-9]|1[0-6])$/.test(lessonId) || (lessonId === 'L07' && l07ExternalCaptionClearance.some((scene) => captionTime >= scene.startSeconds && captionTime < scene.endSeconds)) || (lessonId === 'L06' && (endScreenVisible || l06CaptionClearance.some((scene) => scene.sceneId === activeTeachingScene))) || (lessonId === 'L01' && (endScreenVisible || l01CaptionClearance.some((scene) => scene.sceneId === activeTeachingScene))) || (lessonId === 'L05' && (endScreenVisible || l05CaptionClearance.some((scene) => scene.sceneId === activeTeachingScene)))
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
    const sync = () => setFullscreen(document.fullscreenElement === playerRef.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
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
    if (lessonId !== 'L05') return
    const trackElement = videoRef.current?.querySelector('track')
    const track = trackElement?.track
    if (!trackElement || !track) return
    const desktop = window.matchMedia('(min-width: 621px)')
    const positionOpeningCues = () => {
      for (const cue of Array.from(track.cues ?? [])) {
        if (cue.startTime >= 11.91 || !('snapToLines' in cue)) continue
        const openingCue = cue as VTTCue
        openingCue.snapToLines = !desktop.matches
        openingCue.line = desktop.matches ? 10 : 'auto'
      }
    }
    trackElement.addEventListener('load', positionOpeningCues)
    track.addEventListener('cuechange', positionOpeningCues)
    desktop.addEventListener?.('change', positionOpeningCues)
    positionOpeningCues()
    return () => {
      trackElement.removeEventListener('load', positionOpeningCues)
      track.removeEventListener('cuechange', positionOpeningCues)
      desktop.removeEventListener?.('change', positionOpeningCues)
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
    setPlaying(false)
    setPosition(0)
    setMediaDuration(durationSeconds ?? 0)
    setPlayerMessage('')
    cueCacheRef.current = []
    videoRef.current?.pause()
    if (videoRef.current) videoRef.current.currentTime = 0
  }, [lessonId, videoSrc, durationSeconds])

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return '0:00'
    return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
  }
  const togglePlayback = async () => {
    const video = videoRef.current
    if (!video) return
    if (!video.paused) { video.pause(); return }
    try { await video.play(); setPlayerMessage('') }
    catch { setPlayerMessage('Playback could not start. Try again or use the transcript below.') }
  }
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === playerRef.current) await document.exitFullscreen()
      else if (playerRef.current?.requestFullscreen) await playerRef.current.requestFullscreen()
      else { setPlayerMessage('Fullscreen is unavailable in this browser. The lesson remains playable here.'); return }
      setPlayerMessage('')
    } catch { setPlayerMessage('Fullscreen could not open. The lesson remains playable here.') }
  }
  const volumeLevel = volume < 0.4 ? 1 : volume < 0.8 ? 2 : 3
  const setVolumeLevel = (level: number) => {
    const video = videoRef.current
    if (!video) return
    const requested = [0.25, 0.6, 1][Math.max(1, Math.min(3, level)) - 1]
    video.volume = requested
    video.muted = false
    setVolume(video.volume)
    setMuted(video.muted)
    if (Math.abs(video.volume - requested) > 0.01) setPlayerMessage('This browser controls volume with device buttons.')
    else { savedVolumeRef.current = requested; setPlayerMessage('') }
  }
  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    if (!video.muted && video.volume > 0) savedVolumeRef.current = video.volume
    if (video.muted && video.volume === 0) video.volume = savedVolumeRef.current
    video.muted = !video.muted
    setVolume(video.volume)
    setMuted(video.muted)
  }

  const label = `${lessonId} ${title} lesson cover`
  const syncEndScreen = (currentTime: number) => {
    const visible = Boolean(endScreen && currentTime >= endScreen.startSeconds)
    if ((lessonId === 'L01' || lessonId === 'L05' || lessonId === 'L06') && visible && captionsOn) {
      const track = videoRef.current?.textTracks[0]
      if (track && track.mode !== 'hidden') track.mode = 'hidden'
    }
    setEndScreenVisible(visible)
  }
  const lessonTeachingScenes = mobileTeachingDetails.scenes.filter((scene) => scene.lessonId === lessonId)
  const syncScene = (currentTime: number) => {
    setCaptionTime(currentTime)
    setActiveTeachingScene(lessonTeachingScenes.find((scene) => currentTime >= scene.startSeconds && currentTime < scene.endSeconds)?.sceneId ?? (lessonId === 'L01' ? l01CaptionClearance.find((scene) => currentTime >= scene.startSeconds && currentTime < scene.endSeconds)?.sceneId ?? null : lessonId === 'L05' ? l05CaptionClearance.find((scene) => currentTime >= scene.startSeconds && currentTime < scene.endSeconds)?.sceneId ?? null : lessonId === 'L06' ? l06CaptionClearance.find((scene) => currentTime >= scene.startSeconds && currentTime < scene.endSeconds)?.sceneId ?? null : null))
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
  return <><div ref={playerRef} className={styles.playerShell}><div className={styles.coverStage} aria-label={label}>
    {videoSrc ? <video ref={videoRef} data-caption-size={captionSize} className={`${styles.lessonVideo} ${captionStyles.nativeVideo}${posterRevealed ? ` ${styles.videoReveal}` : ''}`} controls={!mobileWidth} playsInline preload="metadata" poster={poster} aria-label={`${lessonId} ${title} guided video`} onLoadedMetadata={(event) => { if (resumeSeconds > 0 && resumeSeconds < event.currentTarget.duration - 2) event.currentTarget.currentTime = resumeSeconds; setMediaDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : durationSeconds ?? 0); setPosition(event.currentTarget.currentTime); syncEndScreen(event.currentTarget.currentTime); syncScene(event.currentTarget.currentTime); const track = event.currentTarget.textTracks[0]; if (track) track.mode = captionsOn ? externalCaption || ((lessonId === 'L01' || lessonId === 'L05') && endScreen && event.currentTarget.currentTime >= endScreen.startSeconds) ? 'hidden' : 'showing' : 'disabled'; captionsChangeRef.current?.(captionsOn); syncMobileCaption() }} onTimeUpdate={(event) => { setPosition(event.currentTarget.currentTime); syncEndScreen(event.currentTarget.currentTime); syncScene(event.currentTarget.currentTime); syncMobileCaption(); const seconds = Math.floor(event.currentTarget.currentTime); if (seconds > 0 && seconds % 5 === 0) onProgress?.(seconds) }} onSeeking={(event) => { setPosition(event.currentTarget.currentTime); syncEndScreen(event.currentTarget.currentTime); syncScene(event.currentTarget.currentTime); syncMobileCaption() }} onSeeked={() => syncMobileCaption()} onPause={(event) => { setPlaying(false); syncMobileCaption(); onProgress?.(Math.floor(event.currentTarget.currentTime)) }} onEnded={(event) => { setPlaying(false); setPosition(event.currentTarget.duration || durationSeconds || 0); setEndScreenVisible(Boolean(endScreen)); setActiveTeachingScene(null); setMobileCaption(''); onProgress?.(Math.floor(durationSeconds ?? 540)) }} onPlaying={() => { setPlaying(true); setPosterRevealed(true) }} onVolumeChange={(event) => { setMuted(event.currentTarget.muted); setVolume(event.currentTarget.volume) }} onError={() => setPlayerMessage('Video could not load. Use the transcript below while the lesson is unavailable.')} onEmptied={() => { setPlaying(false); setPosterRevealed(false); setEndScreenVisible(false); setActiveTeachingScene(null); setMobileCaption('') }}>
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
  </div>{videoSrc && mobileWidth && <div className={styles.mobilePlayerRail} role="group" aria-label={`${lessonId} video controls`}>
    <button type="button" onClick={togglePlayback} aria-label={playing ? 'Pause video' : 'Play video'}>{playing ? <Pause aria-hidden="true" size={19} fill="currentColor" /> : <Play aria-hidden="true" size={19} fill="currentColor" />}</button>
    <input className={styles.playerSeek} type="range" min="0" max={Math.max(1, mediaDuration)} step="0.1" value={Math.min(position, Math.max(1, mediaDuration))} disabled={mediaDuration <= 0} aria-label="Seek video" aria-valuetext={`${formatTime(position)} of ${formatTime(mediaDuration)}`} onChange={(event) => { const video = videoRef.current; if (video) { video.currentTime = Number(event.currentTarget.value); setPosition(video.currentTime) } }} />
    <output className={styles.playerTime} aria-hidden="true">{formatTime(position)}<span>/</span>{formatTime(mediaDuration)}</output>
    <button type="button" onClick={toggleMute} aria-label={muted ? 'Unmute video' : 'Mute video'} aria-pressed={muted}>{muted ? <VolumeX aria-hidden="true" size={20} /> : <Volume2 aria-hidden="true" size={20} />}</button>
    <div className={styles.playerWaves} role="slider" tabIndex={0} aria-label="Video volume level" aria-valuemin={1} aria-valuemax={3} aria-valuenow={volumeLevel} aria-valuetext={`${['Low', 'Medium', 'Full'][volumeLevel - 1]} volume${muted ? ', muted' : ''}`} onClick={(event) => { const box = event.currentTarget.getBoundingClientRect(); setVolumeLevel(Math.min(3, Math.floor(((event.clientX - box.left) / box.width) * 3) + 1)) }} onKeyDown={(event) => { const level = event.key === 'Home' ? 1 : event.key === 'End' ? 3 : event.key === 'ArrowRight' || event.key === 'ArrowUp' ? Math.min(3, volumeLevel + 1) : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? Math.max(1, volumeLevel - 1) : null; if (level !== null) { event.preventDefault(); setVolumeLevel(level) } }}><svg viewBox="0 0 44 44" aria-hidden="true"><path className={volumeLevel >= 1 && !muted ? styles.waveActive : ''} d="M7 18 Q11 22 7 26" /><path className={volumeLevel >= 2 && !muted ? styles.waveActive : ''} d="M13 14 Q20 22 13 30" /><path className={volumeLevel >= 3 && !muted ? styles.waveActive : ''} d="M19 10 Q29 22 19 34" /></svg></div>
    <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>{fullscreen ? <Minimize2 aria-hidden="true" size={19} /> : <Maximize2 aria-hidden="true" size={19} />}</button>
  </div>}{playerMessage && mobileWidth && <span role="status" className={styles.playerMessage}>{playerMessage}</span>}{videoSrc && externalCaption && captionsOn && mobileCaption && !endScreenVisible && <div className={`${styles.mobileCaptionBand} ${captionStyles.band}`} data-caption-size={captionSize} role="status" aria-label={`${lessonId} caption`}>{mobileCaption}</div>}</div>{videoSrc && teachingScene && <aside className={styles.mobileTeachingDetails} aria-label={`${teachingScene.sceneId} ${teachingScene.title} source wording`}>
    <div className={styles.mobileTeachingHeading}><strong>{teachingScene.title}</strong>{'image' in teachingScene && <a href={teachingScene.image} target="_blank" rel="noopener noreferrer" onClick={() => videoRef.current?.pause()}>Open full plate</a>}</div>
    {teachingScene.details.length > 0 && <div className={styles.mobileTeachingCopy}>{teachingScene.details.map((detail) => <div key={detail.label}><strong>{detail.label}</strong><span>{detail.description}</span></div>)}</div>}
  </aside>}</>
}
