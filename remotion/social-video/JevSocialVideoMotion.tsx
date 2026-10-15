import { AbsoluteFill, Easing, Img, Sequence, Video, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'

export type JevSocialVideoMotionProps = { reducedMotion: boolean; presenterCutoutPath?: string }
type Scene = { id: string; label: string; start: number; end: number; mode: 'presenter' | 'split' | 'cta'; nativeClip?: string }

const safe = { top: 96, right: 48, bottom: 144, left: 48 }
const transitionFrames = 12
const scenes: Scene[] = [
  { id: 'presenter-open', label: 'UNCERTAINTY SHOULD BE VISIBLE', start: 0, end: 10, mode: 'presenter' },
  { id: 'score-dial', label: 'A SCORE IS INPUT', start: 10, end: 16.279, mode: 'split', nativeClip: 'native-score-dial.mp4' },
  { id: 'read-the-signal-bars', label: 'READ THE SIGNAL', start: 16.279, end: 26.593, mode: 'split', nativeClip: 'native-read-the-signal-bars.mp4' },
  { id: 'apply-policy-bands', label: 'APPLY THE POLICY', start: 26.593, end: 35.431, mode: 'split', nativeClip: 'native-apply-policy-bands.mp4' },
  { id: 'ownership-handoff', label: 'KEEP OWNERSHIP VISIBLE', start: 35.431, end: 42.113, mode: 'split', nativeClip: 'native-ownership-handoff.mp4' },
  { id: 'uncertainty-summary', label: 'MAKE UNCERTAINTY VISIBLE', start: 42.113, end: 51.347, mode: 'split', nativeClip: 'native-uncertainty-summary.mp4' },
  { id: 'exception-routing', label: 'WHO OWNS THE EXCEPTION?', start: 51.347, end: 61.434, mode: 'split', nativeClip: 'native-exception-routing.mp4' },
  { id: 'channel-cta', label: 'PRACTICAL AI GOVERNANCE', start: 61.434, end: 67.28, mode: 'cta' },
]

function Stage({ reducedMotion, presenterCutoutPath }: Required<JevSocialVideoMotionProps>) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const seconds = frame / fps
  const scene = scenes.find((candidate) => seconds >= candidate.start && seconds < candidate.end) ?? scenes.at(-1)!
  const localFrame = frame - Math.round(scene.start * fps)
  const entrance = reducedMotion ? 1 : interpolate(localFrame, [0, transitionFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) })
  const isSplit = scene.mode === 'split'
  const isCta = scene.mode === 'cta'
  const presenter = isSplit
    ? { left: -28, top: 1040, width: 540 }
    : isCta
      ? {
          left: interpolate(entrance, [0, 1], [-28, -40]),
          top: interpolate(entrance, [0, 1], [1040, 930]),
          width: interpolate(entrance, [0, 1], [540, 720]),
        }
      : { left: 20, top: 690, width: 1040 }

  return (
    <AbsoluteFill style={{ background: 'linear-gradient(160deg,#071321 0%,#0c2138 58%,#173b58 100%)', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 82% 14%,rgba(39,91,128,.46),transparent 36%)' }} />
      <div style={{ position: 'absolute', left: safe.left, right: safe.right, top: safe.top, height: 4, background: '#f5c518' }} />
      <div style={{ position: 'absolute', left: safe.left, top: 126, color: '#f5c518', fontSize: 30, fontWeight: 800, letterSpacing: 5 }}>JEV · DECISION FIELD GUIDE</div>
      <div style={{ position: 'absolute', left: safe.left, right: safe.right, top: 184, color: '#fff', fontSize: 54, lineHeight: 1.04, fontWeight: 800 }}>A SCORE IS INPUT.<br />GOVERNANCE DECIDES.</div>

      <Sequence durationInFrames={1682}><Video src={staticFile(presenterCutoutPath)} muted pauseWhenBuffering style={{ position: 'absolute', left: presenter.left, top: presenter.top, width: presenter.width, height: 'auto', filter: 'drop-shadow(0 28px 36px rgba(0,0,0,.34))' }} /></Sequence>

      {scenes.filter((candidate) => candidate.nativeClip).map((candidate) => {
        const from = Math.round(candidate.start * fps)
        const durationInFrames = Math.round((candidate.end - candidate.start) * fps)
        return <Sequence key={candidate.id} from={from} durationInFrames={durationInFrames} premountFor={fps}>
          <div style={{ position: 'absolute', left: 520, top: 430, width: 520, height: 924, opacity: entrance, overflow: 'hidden', borderRadius: 30, border: '3px solid rgba(245,197,24,.9)', boxShadow: '0 28px 80px rgba(0,0,0,.38)', background: '#081525' }}>
            <Video src={staticFile(`review-assets/social-content/.render-inputs/${candidate.nativeClip}`)} muted pauseWhenBuffering style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </Sequence>
      })}

      {!isCta && <div style={{ position: 'absolute', left: isSplit ? 536 : 120, right: isSplit ? 48 : 120, bottom: 150, opacity: entrance }}><div style={{ borderRadius: 999, background: 'rgba(7,19,33,.95)', border: '2px solid rgba(245,197,24,.82)', color: '#f8fafc', padding: '17px 24px', fontSize: isSplit ? 25 : 31, lineHeight: 1.16, fontWeight: 800, letterSpacing: 1.8, textAlign: 'center' }}>{scene.label}</div></div>}

      {isCta && <div style={{ position: 'absolute', left: 500, right: 48, top: 520, textAlign: 'center', opacity: entrance }}>
        <Img src={staticFile('amadutown-logo-upscaled.png')} style={{ width: 210, height: 'auto', objectFit: 'contain', margin: '0 auto 48px' }} />
        <div style={{ color: '#fff', fontSize: 57, lineHeight: 1.04, fontWeight: 800 }}>SUBSCRIBE FOR</div>
        <div style={{ color: '#f5c518', fontSize: 51, lineHeight: 1.04, fontWeight: 800, marginTop: 18 }}>PRACTICAL AI GOVERNANCE</div>
        <div style={{ color: '#c7d5e5', fontSize: 27, lineHeight: 1.38, marginTop: 36 }}>Tools, boundaries, and receipts for decisions that matter.</div>
      </div>}
    </AbsoluteFill>
  )
}

export function JevSocialVideoMotion({ reducedMotion, presenterCutoutPath = 'review-assets/social-content/.render-inputs/jev-presenter-cutout.webm' }: JevSocialVideoMotionProps) {
  return <Stage reducedMotion={reducedMotion} presenterCutoutPath={presenterCutoutPath} />
}
