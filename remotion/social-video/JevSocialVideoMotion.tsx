import {
  AbsoluteFill,
  Easing,
  Img,
  Video,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'

export type JevSocialVideoMotionProps = {
  reducedMotion: boolean
  presenterCutoutPath?: string
}

type SceneRole = 'presenter_led' | 'split_screen' | 'asset_detail' | 'return_to_presenter' | 'cta'

type Scene = {
  id: string
  label: string
  start: number
  end: number
  role: SceneRole
  crop?: { x: number; y: number; width: number; height: number }
}

const safe = { top: 96, right: 64, bottom: 144, left: 64 }
const transitionFrames = 12

const scenes: Scene[] = [
  { id: 'presenter-open', label: 'UNCERTAINTY SHOULD BE VISIBLE', start: 0, end: 16.279, role: 'presenter_led', crop: { x: 0, y: 0, width: 1142, height: 705 } },
  { id: 'inspect-score', label: 'INSPECT THE SCORE', start: 16.279, end: 26.593, role: 'split_screen', crop: { x: 33, y: 212, width: 297, height: 325 } },
  { id: 'apply-policy', label: 'APPLY THE POLICY', start: 26.593, end: 35.431, role: 'asset_detail', crop: { x: 344, y: 212, width: 437, height: 325 } },
  { id: 'retain-ownership', label: 'RETAIN OWNERSHIP', start: 35.431, end: 42.113, role: 'split_screen', crop: { x: 796, y: 212, width: 313, height: 325 } },
  { id: 'retain-receipt', label: 'KEEP THE RECEIPT', start: 42.113, end: 51.347, role: 'asset_detail', crop: { x: 796, y: 446, width: 313, height: 91 } },
  { id: 'hold-the-boundary', label: 'LIVE PROVIDER USE: HOLD', start: 51.347, end: 61.434, role: 'split_screen', crop: { x: 714, y: 88, width: 395, height: 92 } },
  { id: 'conclusion', label: 'ROUTE. REVIEW. REFUSE.', start: 61.434, end: 67.28, role: 'return_to_presenter' },
  { id: 'channel-cta', label: 'PRACTICAL AI GOVERNANCE', start: 67.28, end: 71.28, role: 'cta' },
]

type Layout = {
  presenterX: number
  presenterY: number
  presenterWidth: number
  presenterOpacity: number
  assetX: number
  assetY: number
  assetWidth: number
  assetHeight: number
  assetOpacity: number
}

const layouts: Record<SceneRole, Layout> = {
  presenter_led: { presenterX: -70, presenterY: 720, presenterWidth: 760, presenterOpacity: 1, assetX: 570, assetY: 470, assetWidth: 450, assetHeight: 780, assetOpacity: 0.92 },
  split_screen: { presenterX: -90, presenterY: 660, presenterWidth: 760, presenterOpacity: 1, assetX: 520, assetY: 350, assetWidth: 500, assetHeight: 1020, assetOpacity: 1 },
  asset_detail: { presenterX: -250, presenterY: 730, presenterWidth: 680, presenterOpacity: 0.14, assetX: 60, assetY: 300, assetWidth: 960, assetHeight: 1140, assetOpacity: 1 },
  return_to_presenter: { presenterX: 10, presenterY: 690, presenterWidth: 1040, presenterOpacity: 1, assetX: 540, assetY: 410, assetWidth: 480, assetHeight: 900, assetOpacity: 0 },
  cta: { presenterX: 40, presenterY: 690, presenterWidth: 1000, presenterOpacity: 0, assetX: 540, assetY: 410, assetWidth: 480, assetHeight: 900, assetOpacity: 0 },
}

function mixLayout(from: Layout, to: Layout, progress: number): Layout {
  const mix = (a: number, b: number) => a + (b - a) * progress
  return {
    presenterX: mix(from.presenterX, to.presenterX),
    presenterY: mix(from.presenterY, to.presenterY),
    presenterWidth: mix(from.presenterWidth, to.presenterWidth),
    presenterOpacity: mix(from.presenterOpacity, to.presenterOpacity),
    assetX: mix(from.assetX, to.assetX),
    assetY: mix(from.assetY, to.assetY),
    assetWidth: mix(from.assetWidth, to.assetWidth),
    assetHeight: mix(from.assetHeight, to.assetHeight),
    assetOpacity: mix(from.assetOpacity, to.assetOpacity),
  }
}

function SemanticMotion({ sceneId, frame, reducedMotion }: { sceneId: string; frame: number; reducedMotion: boolean }) {
  const progress = reducedMotion ? 1 : interpolate(frame, [10, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const line = { position: 'absolute' as const, background: '#38d6cf', borderRadius: 999, boxShadow: '0 0 18px rgba(56,214,207,.55)' }
  if (sceneId === 'inspect-score') return <><div style={{ ...line, left: '9%', top: '27%', width: `${68 * progress}%`, height: 5 }} /><div style={{ ...line, left: '9%', top: '50%', width: `${36 * progress}%`, height: 5 }} /><div style={{ ...line, left: '9%', top: '73%', width: `${12 * progress}%`, height: 5 }} /></>
  if (sceneId === 'apply-policy') return <><div style={{ position: 'absolute', left: `${8 + 29 * progress}%`, top: '12%', width: 5, height: '76%', borderRadius: 999, background: '#f5c518', boxShadow: '0 0 22px rgba(245,197,24,.7)' }} /><div style={{ position: 'absolute', left: `${5 + 58 * progress}%`, bottom: '8%', padding: '4px 9px', borderRadius: 999, background: '#f5c518', color: '#081525', fontSize: 12, fontWeight: 900 }}>THRESHOLD</div></>
  if (sceneId === 'retain-ownership') return <><div style={{ ...line, left: '49.3%', top: '9%', width: 4, height: `${73 * progress}%` }} />{[24, 47, 70].map((top, index) => <div key={top} style={{ position: 'absolute', left: '46%', top: `${top}%`, width: 18, height: 18, borderRadius: 99, background: index === 2 ? '#f5c518' : '#38d6cf', opacity: progress > (index + 1) * .2 ? 1 : .18 }} />)}</>
  if (sceneId === 'retain-receipt') return <><div style={{ ...line, left: '8%', bottom: '15%', width: `${84 * progress}%`, height: 5 }} /><div style={{ position: 'absolute', right: '7%', top: '12%', color: '#f5c518', fontSize: 28, fontWeight: 900, opacity: progress }}>✓</div></>
  if (sceneId === 'hold-the-boundary') return <><div style={{ position: 'absolute', inset: 4, border: '4px solid #f5c518', borderRadius: 14, opacity: progress, boxShadow: 'inset 0 0 22px rgba(245,197,24,.2)' }} /><div style={{ position: 'absolute', right: 10, top: 8, color: '#f5c518', fontSize: 12, fontWeight: 900, opacity: progress }}>HOLD</div></>
  return null
}

function AssetCrop({ scene, layout, localFrame, reducedMotion, opacityMultiplier = 1 }: { scene: Scene; layout: Layout; localFrame: number; reducedMotion: boolean; opacityMultiplier?: number }) {
  if (!scene.crop) return null
  const panelHeight = Math.min(layout.assetHeight, layout.assetWidth * scene.crop.height / scene.crop.width + 48)
  const panelTop = layout.assetY + (layout.assetHeight - panelHeight) / 2
  const cropWidth = Math.min(layout.assetWidth - 36, (panelHeight - 36) * scene.crop.width / scene.crop.height)
  const cropHeight = cropWidth * scene.crop.height / scene.crop.width
  return (
    <div style={{ position: 'absolute', left: layout.assetX, top: panelTop, width: layout.assetWidth, height: panelHeight, opacity: layout.assetOpacity * opacityMultiplier, overflow: 'hidden', borderRadius: 36, background: '#f8fafc', border: '3px solid rgba(245,197,24,.92)', boxShadow: '0 28px 80px rgba(0,0,0,.36)' }}>
      <div style={{ position: 'absolute', width: cropWidth, height: cropHeight, left: (layout.assetWidth - cropWidth) / 2, top: (panelHeight - cropHeight) / 2, overflow: 'hidden' }}>
        <Img key={scene.id} src={staticFile(`review-assets/social-content/.render-inputs/crop-${scene.id}.png`)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        <SemanticMotion sceneId={scene.id} frame={localFrame} reducedMotion={reducedMotion} />
      </div>
      <div style={{ position: 'absolute', inset: 18, border: '2px solid rgba(8,21,37,.24)', borderRadius: 22 }} />
    </div>
  )
}

function Stage({ reducedMotion, presenterCutoutPath }: Required<JevSocialVideoMotionProps>) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const seconds = frame / fps
  const foundIndex = scenes.findIndex((scene) => seconds >= scene.start && seconds < scene.end)
  const index = foundIndex === -1 ? scenes.length - 1 : foundIndex
  const scene = scenes[index]
  const previous = scenes[Math.max(0, index - 1)]
  const localFrame = frame - Math.round(scene.start * fps)
  const progress = reducedMotion ? 1 : interpolate(localFrame, [0, transitionFrames], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic),
  })
  const layout = mixLayout(layouts[previous.role], layouts[scene.role], progress)
  const labelOpacity = interpolate(localFrame, [2, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const isCta = scene.role === 'cta'
  const sceneEndFrame = Math.round(scene.end * fps)
  const presenterEndFade = scene.role === 'return_to_presenter' && !reducedMotion
    ? interpolate(frame, [sceneEndFrame - transitionFrames, sceneEndFrame], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) })
    : 1

  return (
    <AbsoluteFill style={{ background: 'linear-gradient(160deg,#071321 0%,#0c2138 58%,#173b58 100%)', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 82% 14%,rgba(39,91,128,.46),transparent 36%)' }} />
      <div style={{ position: 'absolute', left: safe.left, right: safe.right, top: safe.top, height: 4, background: '#f5c518' }} />
      <div style={{ position: 'absolute', left: safe.left, top: 126, color: '#f5c518', fontSize: 30, fontWeight: 800, letterSpacing: 5 }}>JEV · OPERATOR FIELD GUIDE</div>
      <div style={{ position: 'absolute', left: safe.left, right: safe.right, top: 184, color: '#fff', fontSize: 54, lineHeight: 1.04, fontWeight: 800 }}>A SCORE IS INPUT.<br />GOVERNANCE DECIDES.</div>

      {!isCta && <Sequence durationInFrames={1682}>
        <Video
          src={staticFile(presenterCutoutPath)}
          muted
          pauseWhenBuffering
          style={{ position: 'absolute', left: layout.presenterX, top: layout.presenterY, width: layout.presenterWidth, height: 'auto', opacity: layout.presenterOpacity * presenterEndFade, filter: 'drop-shadow(0 28px 36px rgba(0,0,0,.34))' }}
        />
      </Sequence>}

      {!isCta && index > 0 && <AssetCrop key={`previous-${previous.id}`} scene={previous} layout={layout} localFrame={localFrame} reducedMotion={reducedMotion} opacityMultiplier={1 - progress} />}
      {!isCta && <AssetCrop key={`current-${scene.id}`} scene={scene} layout={layout} localFrame={localFrame} reducedMotion={reducedMotion} opacityMultiplier={progress} />}

      {!isCta && <div style={{ position: 'absolute', left: safe.left, right: safe.right, bottom: 172, display: 'flex', justifyContent: scene.role === 'split_screen' ? 'flex-end' : 'center', opacity: labelOpacity }}>
        <div style={{ maxWidth: 880, borderRadius: 999, background: 'rgba(7,19,33,.94)', border: '2px solid rgba(245,197,24,.82)', color: '#f8fafc', padding: '17px 30px', fontSize: 29, lineHeight: 1.16, fontWeight: 800, letterSpacing: 2.1, textAlign: 'center' }}>{scene.label}</div>
      </div>}

      {isCta && <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '240px 72px 180px', textAlign: 'center', opacity: labelOpacity }}>
        <Img src={staticFile('amadutown-logo-upscaled.png')} style={{ width: 300, height: 'auto', objectFit: 'contain', marginBottom: 64 }} />
        <div style={{ color: '#fff', fontSize: 72, lineHeight: 1.04, fontWeight: 800 }}>SUBSCRIBE FOR</div>
        <div style={{ color: '#f5c518', fontSize: 66, lineHeight: 1.04, fontWeight: 800, marginTop: 18 }}>PRACTICAL AI GOVERNANCE</div>
        <div style={{ color: '#c7d5e5', fontSize: 31, lineHeight: 1.42, marginTop: 40, maxWidth: 850 }}>Tools, boundaries, and receipts for decisions that matter.</div>
      </AbsoluteFill>}

      <div style={{ position: 'absolute', left: safe.left, right: safe.right, bottom: 96, color: '#a9bfd2', fontSize: 24, lineHeight: 1.3, textAlign: 'center' }}>Mock-qualified review · live provider use remains on hold</div>
    </AbsoluteFill>
  )
}

export function JevSocialVideoMotion({ reducedMotion, presenterCutoutPath = 'review-assets/social-content/.render-inputs/jev-presenter-cutout.webm' }: JevSocialVideoMotionProps) {
  return <Stage reducedMotion={reducedMotion} presenterCutoutPath={presenterCutoutPath} />
}
