// @ts-nocheck
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  Video,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

const fps = 30;
const seconds = (value: number) => Math.round(value * fps);
const palette = { navy: '#08111d', ink: '#05080d', gold: '#f6c541', cyan: '#5dd6c8', white: '#f8fafc' };

const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const progress = `${Math.min(100, (frame / 5547) * 100)}%`;
  return (
    <AbsoluteFill style={{ background: palette.ink, fontFamily: 'Inter, Arial, sans-serif', color: palette.white }}>
      {children}
      <div style={{ position: 'absolute', left: 50, right: 50, bottom: 34, height: 5, background: 'rgba(255,255,255,.16)' }}>
        <div style={{ width: progress, height: '100%', background: palette.cyan }} />
      </div>
    </AbsoluteFill>
  );
};

const ProductPanel: React.FC<{ src: string; side?: 'right' | 'full'; label: string; objectPosition?: string }> = ({ src, side = 'right', label, objectPosition = 'center' }) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 18], [70, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const scale = interpolate(frame, [0, 140], [1.02, 1.075], { extrapolateRight: 'clamp' });
  const full = side === 'full';
  return (
    <AbsoluteFill style={{ background: full ? '#e9e5da' : palette.navy }}>
      {!full && (
        <div style={{ position: 'absolute', left: 70, top: 70, width: 720 }}>
          <Img src={staticFile('amadutown-logo-upscaled.png')} style={{ width: 58, height: 74, objectFit: 'contain' }} />
          <div style={{ marginTop: 52, fontSize: 58, lineHeight: 1.04, fontWeight: 850, maxWidth: 650 }}>The decision survives the handoff.</div>
          <div style={{ marginTop: 28, fontSize: 25, lineHeight: 1.45, color: 'rgba(255,255,255,.72)', maxWidth: 610 }}>Owned browser gameplay. One continuous product path. No simulated outcome claim.</div>
        </div>
      )}
      <div style={{ position: 'absolute', top: full ? 0 : 44, bottom: full ? 0 : 70, left: full ? 0 : 850, right: full ? 0 : 44, overflow: 'hidden', borderRadius: full ? 0 : 18, boxShadow: full ? 'none' : '-25px 24px 60px rgba(0,0,0,.5)', transform: `translateX(${enter}px)` }}>
        <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition, transform: `scale(${scale})` }} />
        <div style={{ position: 'absolute', left: 24, top: 22, padding: '10px 16px', background: 'rgba(5,8,13,.82)', borderLeft: `5px solid ${palette.gold}`, fontSize: 22, fontWeight: 800 }}>{label}</div>
      </div>
    </AbsoluteFill>
  );
};

const GameplayMotion: React.FC = () => (
  <AbsoluteFill style={{ background: '#ede8dd' }}>
    <Video src={staticFile('dark-castle-live-gameplay.webm')} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    <div style={{ position: 'absolute', left: 40, top: 35, padding: '12px 18px', background: 'rgba(5,8,13,.84)', borderLeft: `6px solid ${palette.gold}`, color: '#fff', fontSize: 24, fontWeight: 820 }}>LIVE PRODUCT PROOF · EXPLORE</div>
  </AbsoluteFill>
);

const ThreeStep: React.FC = () => {
  const frame = useCurrentFrame();
  const steps = ['EXPLORE', 'CARRY', 'RESPOND'];
  const selected = Math.min(2, Math.floor(frame / seconds(9.3)));
  return (
    <AbsoluteFill style={{ background: palette.navy, padding: '90px 72px 90px 940px' }}>
      <div style={{ color: palette.cyan, fontSize: 23, fontWeight: 800 }}>THE PRODUCT DISCIPLINE</div>
      <div style={{ fontSize: 60, lineHeight: 1.05, fontWeight: 860, marginTop: 22 }}>Preserve context.<br />Make judgment visible.</div>
      <div style={{ display: 'grid', gap: 18, marginTop: 54 }}>
        {steps.map((step, index) => {
          const active = index === selected;
          return <div key={step} style={{ padding: '23px 28px', border: `2px solid ${active ? palette.gold : 'rgba(255,255,255,.18)'}`, background: active ? 'rgba(246,197,65,.12)' : 'rgba(255,255,255,.035)', color: active ? palette.gold : 'rgba(255,255,255,.52)', fontSize: 35, fontWeight: 850, transform: `translateX(${active ? 0 : 18}px)`, transition: 'none' }}>{index + 1}. {step}</div>;
        })}
      </div>
    </AbsoluteFill>
  );
};

const CTA: React.FC = () => (
  <AbsoluteFill style={{ background: 'linear-gradient(120deg,#07101c,#122238)' }}>
    <div style={{ position: 'absolute', left: 1040, right: 90, top: 175, bottom: 120, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start' }}>
      <Img src={staticFile('amadutown-logo-upscaled.png')} style={{ width: 74, height: 94, objectFit: 'contain' }} />
      <div style={{ marginTop: 24, fontSize: 58, lineHeight: 1.05, fontWeight: 860 }}>Build products that make<br /><span style={{ color: palette.gold }}>judgment visible.</span></div>
      <div style={{ marginTop: 26, fontSize: 27, lineHeight: 1.35, color: 'rgba(255,255,255,.72)' }}>Subscribe to AmaduTown for more behind-the-build lessons.</div>
    </div>
  </AbsoluteFill>
);

export const DarkCastleBase: React.FC = () => (
  <Frame>
    <Sequence from={0} durationInFrames={seconds(24)}>
      <ProductPanel src="01-explore-start.png" label="HOOK · THE BOARD IS NOT THE DECISION" />
    </Sequence>
    <Sequence from={seconds(24)} durationInFrames={seconds(17)}>
      <AbsoluteFill style={{ background: 'linear-gradient(120deg,#0b1421,#1b2a3d)' }} />
    </Sequence>
    <Sequence from={seconds(41)} durationInFrames={seconds(27)}>
      <GameplayMotion />
    </Sequence>
    <Sequence from={seconds(68)} durationInFrames={seconds(28)}>
      <ProductPanel src="03-handoff.png" label="HANDOFF · e4 REMAINS VISIBLE" />
    </Sequence>
    <Sequence from={seconds(96)} durationInFrames={seconds(31)}>
      <ProductPanel src="04-computer-response.png" side="full" label="RESPONSE · POSITION + NOTATION + NEXT DECISION" objectPosition="center top" />
    </Sequence>
    <Sequence from={seconds(127)} durationInFrames={seconds(28)}>
      <ThreeStep />
    </Sequence>
    <Sequence from={seconds(155)} durationInFrames={seconds(29.94)}>
      <CTA />
    </Sequence>
  </Frame>
);
