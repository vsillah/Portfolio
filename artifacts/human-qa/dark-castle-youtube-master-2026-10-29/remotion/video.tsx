// @ts-nocheck
import React from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
  Video,
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

const ProductPanel: React.FC<{ src: string; label: string; objectPosition?: string }> = ({ src, label, objectPosition = 'center' }) => {
  return (
    <AbsoluteFill style={{ background: '#e9e5da' }}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition }} />
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
    <AbsoluteFill style={{ background: palette.navy, padding: '92px 250px' }}>
      <div style={{ color: palette.cyan, fontSize: 23, fontWeight: 800 }}>THE PRODUCT DISCIPLINE</div>
      <div style={{ fontSize: 66, lineHeight: 1.05, fontWeight: 860, marginTop: 22 }}>Preserve context. Make judgment visible.</div>
      <div style={{ display: 'grid', gap: 18, marginTop: 64, maxWidth: 1420 }}>
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
      <AbsoluteFill style={{ background: 'linear-gradient(120deg,#0b1421,#1b2a3d)' }} />
    </Sequence>
    <Sequence from={seconds(24)} durationInFrames={seconds(17)}>
      <AbsoluteFill style={{ background: 'linear-gradient(120deg,#0b1421,#1b2a3d)' }} />
    </Sequence>
    <Sequence from={seconds(41)} durationInFrames={seconds(27)}>
      <GameplayMotion />
    </Sequence>
    <Sequence from={seconds(68)} durationInFrames={seconds(28)}>
      <ProductPanel src="03-handoff.png" label="HANDOFF · e4 REMAINS VISIBLE" objectPosition="center top" />
    </Sequence>
    <Sequence from={seconds(96)} durationInFrames={seconds(31)}>
      <ProductPanel src="04-computer-response.png" label="RESPONSE · POSITION + NOTATION + NEXT DECISION" objectPosition="center top" />
    </Sequence>
    <Sequence from={seconds(127)} durationInFrames={seconds(28)}>
      <ThreeStep />
    </Sequence>
    <Sequence from={seconds(155)} durationInFrames={seconds(21)}>
      <AbsoluteFill style={{ background: 'linear-gradient(120deg,#0b1421,#1b2a3d)' }} />
    </Sequence>
    <Sequence from={seconds(176)} durationInFrames={seconds(8.94)}>
      <CTA />
    </Sequence>
  </Frame>
);
