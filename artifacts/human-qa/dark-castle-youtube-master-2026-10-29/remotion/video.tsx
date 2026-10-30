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

const FPS = 30;
const sec = (value: number) => Math.round(value * FPS);
const GOLD = '#f6c54a';
const CYAN = '#55e1d2';
const BLUE = '#74b8ff';
const INK = '#061522';
const PANEL = '#0c2438';

const ease = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

const shotOpacity = (frame: number, duration: number) =>
  Math.min(ease(frame, 0, 8), interpolate(frame, [duration - 8, duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }));

const Brand = ({label = 'DARK CASTLE CHESS'}) => (
  <div style={{position: 'absolute', left: 66, top: 42, display: 'flex', alignItems: 'center', gap: 18, zIndex: 20}}>
    <Img src={staticFile('amadutown-logo-upscaled.png')} style={{width: 44, height: 58, objectFit: 'contain'}} />
    <div>
      <div style={{fontSize: 19, fontWeight: 800, color: GOLD, letterSpacing: 2}}>AMADUTOWN</div>
      <div style={{fontSize: 13, fontWeight: 650, color: '#a8bdd0', marginTop: 4}}>{label}</div>
    </div>
  </div>
);

const Frame = ({children, accent = CYAN, label, duration}: any) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{
      background: `radial-gradient(circle at 76% 32%, ${accent}20, transparent 30%), linear-gradient(135deg, ${INK}, #0a2032 62%, #07121d)`,
      color: '#f8fbff', fontFamily: 'Inter, Arial, sans-serif', overflow: 'hidden',
      opacity: shotOpacity(frame, duration),
    }}>
      <div style={{position: 'absolute', inset: 0, opacity: 0.25, backgroundImage: 'linear-gradient(#ffffff08 1px, transparent 1px), linear-gradient(90deg, #ffffff08 1px, transparent 1px)', backgroundSize: '64px 64px'}} />
      <Brand label={label} />
      {children}
      <div style={{position: 'absolute', left: 66, right: 66, bottom: 38, height: 3, background: '#183b54'}}>
        <div style={{height: '100%', width: `${Math.min(100, (frame / duration) * 100)}%`, background: accent}} />
      </div>
    </AbsoluteFill>
  );
};

const PresenterBed = ({duration}: any) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, duration], [-18, 18]);
  return (
    <Frame duration={duration} label="DECISION DESIGN">
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 210, background: 'linear-gradient(transparent, #061522 88%)'}} />
      <div style={{position: 'absolute', right: 72 + x, top: 160, width: 300, textAlign: 'right'}}>
        <div style={{fontSize: 16, color: CYAN, fontWeight: 800, letterSpacing: 2}}>THE QUESTION</div>
        <div style={{fontSize: 48, fontWeight: 900, lineHeight: 1.03, marginTop: 12}}>Did the player learn?</div>
      </div>
    </Frame>
  );
};

const KineticTitle = ({duration, eyebrow, lines, accent = GOLD}: any) => {
  const frame = useCurrentFrame();
  return (
    <Frame duration={duration} accent={accent} label="THE OPEN LOOP">
      <div style={{position: 'absolute', left: 130, top: 255, width: 1500}}>
        <div style={{fontSize: 22, color: accent, fontWeight: 850, letterSpacing: 5, transform: `translateY(${(1 - ease(frame, 0, 12)) * 26}px)`, opacity: ease(frame, 0, 12)}}>{eyebrow}</div>
        {lines.map((line: string, index: number) => {
          const p = ease(frame, 8 + index * 6, 24 + index * 6);
          return <div key={line} style={{fontSize: index === 0 ? 118 : 100, fontWeight: 950, lineHeight: 0.96, marginTop: index ? 8 : 30, color: index === lines.length - 1 ? accent : '#fff', transform: `translateX(${(1 - p) * 110}px)`, opacity: p}}>{line}</div>;
        })}
      </div>
      <div style={{position: 'absolute', right: 118, bottom: 105, width: 420, height: 9, background: '#17374e', overflow: 'hidden'}}>
        <div style={{height: '100%', width: `${ease(frame, 10, duration - 8) * 100}%`, background: accent}} />
      </div>
    </Frame>
  );
};

const DecisionFork = ({duration}: any) => {
  const frame = useCurrentFrame();
  const choices = [
    ['ACCIDENT', '#ff8b73'],
    ['HINT', GOLD],
    ['RECOGNITION', CYAN],
  ];
  return (
    <Frame duration={duration} label="ONE MOVE. THREE EXPLANATIONS.">
      <div style={{position: 'absolute', left: 120, right: 120, top: 220, textAlign: 'center'}}>
        <div style={{fontSize: 88, fontWeight: 950}}>e4 landed on the board.</div>
        <div style={{display: 'flex', justifyContent: 'center', gap: 34, marginTop: 96}}>
          {choices.map(([name, color], i) => {
            const p = ease(frame, 12 + i * 8, 30 + i * 8);
            return <div key={name} style={{width: 430, padding: '34px 24px', border: `2px solid ${color}`, background: `${color}14`, transform: `translateY(${(1 - p) * 55}px)`, opacity: p}}>
              <div style={{fontSize: 24, color, fontWeight: 900, letterSpacing: 3}}>{name}</div>
              <div style={{fontSize: 54, fontWeight: 950, marginTop: 18}}>{i === 0 ? 'guessed' : i === 1 ? 'followed' : 'understood'}</div>
            </div>;
          })}
        </div>
        <div style={{fontSize: 28, color: '#b7cad9', marginTop: 52}}>The move is identical. The product decision is not.</div>
      </div>
    </Frame>
  );
};

const BoundaryCard = ({duration}: any) => {
  const frame = useCurrentFrame();
  const split = ease(frame, 5, 26);
  return (
    <Frame duration={duration} accent={GOLD} label="PUBLIC BROWSER PILOT">
      <div style={{position: 'absolute', left: 120, right: 120, top: 220, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36}}>
        <div style={{padding: 55, border: `2px solid ${CYAN}`, background: '#0c2a35', transform: `translateX(${(1 - split) * -90}px)`, opacity: split}}>
          <div style={{fontSize: 20, letterSpacing: 3, color: CYAN, fontWeight: 900}}>VISIBLE</div>
          <div style={{fontSize: 58, fontWeight: 950, marginTop: 24, lineHeight: 1.06}}>Board state<br/>moves forward</div>
        </div>
        <div style={{padding: 55, border: `2px solid ${GOLD}`, background: '#2a2514', transform: `translateX(${(1 - split) * 90}px)`, opacity: split}}>
          <div style={{fontSize: 20, letterSpacing: 3, color: GOLD, fontWeight: 900}}>STILL TO TEST</div>
          <div style={{fontSize: 58, fontWeight: 950, marginTop: 24, lineHeight: 1.06}}>Learning<br/>carried forward</div>
        </div>
      </div>
    </Frame>
  );
};

const ProofPreview = ({duration}: any) => {
  const frame = useCurrentFrame();
  const images = ['01-explore-start.png', '03-handoff.png', '04-computer-response.png'];
  return (
    <Frame duration={duration} label="THREE STATES. ONE CONTINUITY TEST.">
      <div style={{position: 'absolute', left: 90, right: 90, top: 190, display: 'flex', gap: 30}}>
        {images.map((src, i) => {
          const p = ease(frame, 4 + i * 7, 18 + i * 7);
          return <div key={src} style={{flex: 1, transform: `translateY(${(1 - p) * 90}px) rotate(${(i - 1) * 1.5}deg)`, opacity: p, border: `2px solid ${i === 1 ? GOLD : '#35566d'}`, background: '#07131e', boxShadow: '0 24px 70px #0009'}}>
            <Img src={staticFile(src)} style={{width: '100%', height: 470, objectFit: 'cover', objectPosition: i === 0 ? '50% 35%' : '50% 45%'}} />
            <div style={{padding: 22, fontSize: 24, fontWeight: 850, color: i === 1 ? GOLD : '#d8e8f3'}}>{['EXPLORE', 'HANDOFF', 'RESPONSE'][i]}</div>
          </div>;
        })}
      </div>
    </Frame>
  );
};

const GameplayClip = ({duration, startFrom, label}: any) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, duration], [1.02, 1.1]);
  return (
    <AbsoluteFill style={{background: '#02070b', overflow: 'hidden', opacity: shotOpacity(frame, duration)}}>
      <Video src={staticFile('dark-castle-live-gameplay.webm')} startFrom={sec(startFrom)} muted style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`}} />
      <div style={{position: 'absolute', inset: 0, boxShadow: 'inset 0 0 130px #000b'}} />
      <Brand label="LIVE PRODUCT PROOF" />
      <div style={{position: 'absolute', left: 66, bottom: 56, padding: '16px 23px', background: '#061522e8', borderLeft: `6px solid ${CYAN}`, fontSize: 28, fontWeight: 900}}>{label}</div>
    </AbsoluteFill>
  );
};

const ProductShot = ({duration, src, title, crop = '50% 45%', zoom = 1.04, accent = CYAN}: any) => {
  const frame = useCurrentFrame();
  const z = interpolate(frame, [0, duration], [zoom, zoom + 0.08], {easing: Easing.inOut(Easing.ease)});
  return (
    <AbsoluteFill style={{background: '#050b12', opacity: shotOpacity(frame, duration), overflow: 'hidden'}}>
      <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: crop, transform: `scale(${z})`}} />
      <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #04101ae8 0%, #04101a55 44%, transparent 72%), linear-gradient(0deg, #04101acc, transparent 45%)'}} />
      <Brand label="PRODUCT EVIDENCE" />
      <div style={{
        position: 'absolute', left: 72, bottom: 86, width: 820,
        padding: '28px 34px 30px', color: '#ffffff',
        background: 'linear-gradient(105deg, #061522f7 0%, #0a2134f2 78%, #0a2134dc 100%)',
        borderLeft: `8px solid ${accent}`, borderTop: '1px solid #ffffff24',
        boxShadow: '0 20px 55px #000c, inset 0 1px 0 #ffffff14',
      }}>
        <div style={{fontSize: 20, color: accent, fontWeight: 950, letterSpacing: 4}}>LOOK CLOSER</div>
        <div style={{fontSize: 60, color: '#ffffff', fontWeight: 950, lineHeight: 1.04, marginTop: 13, textShadow: '0 3px 18px #000'}}>{title}</div>
      </div>
    </AbsoluteFill>
  );
};

const FlowDiagram = ({duration, words, caption}: any) => {
  const frame = useCurrentFrame();
  return (
    <Frame duration={duration} label="THE DECISION LOOP">
      <div style={{position: 'absolute', left: 120, right: 120, top: 315, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20}}>
        {words.map((word: string, i: number) => {
          const p = ease(frame, 6 + i * 8, 22 + i * 8);
          return <React.Fragment key={word}>
            <div style={{minWidth: 360, padding: '42px 30px', textAlign: 'center', border: `2px solid ${i === words.length - 1 ? GOLD : CYAN}`, background: '#0b2638', fontSize: 43, fontWeight: 950, transform: `scale(${0.82 + p * 0.18})`, opacity: p}}>{word}</div>
            {i < words.length - 1 && <div style={{fontSize: 58, color: GOLD, opacity: ease(frame, 16 + i * 8, 28 + i * 8)}}>→</div>}
          </React.Fragment>;
        })}
      </div>
      <div style={{position: 'absolute', left: 200, right: 200, bottom: 150, textAlign: 'center', fontSize: 30, color: '#b6cad9'}}>{caption}</div>
    </Frame>
  );
};

const CandidateMoves = ({duration}: any) => {
  const frame = useCurrentFrame();
  const moves = ['Nf3', 'Bc4', 'd3'];
  return (
    <Frame duration={duration} accent={BLUE} label="THE NEXT DECISION">
      <div style={{position: 'absolute', left: 120, top: 220, fontSize: 74, fontWeight: 950}}>A useful system gives the learner options.</div>
      <div style={{position: 'absolute', left: 250, right: 250, top: 440, display: 'flex', justifyContent: 'space-between'}}>
        {moves.map((move, i) => {
          const p = ease(frame, 8 + i * 7, 24 + i * 7);
          return <div key={move} style={{width: 360, height: 240, display: 'grid', placeItems: 'center', borderRadius: 30, background: i === 1 ? `${GOLD}22` : '#102d43', border: `3px solid ${i === 1 ? GOLD : BLUE}`, fontSize: 76, fontWeight: 950, transform: `translateY(${(1 - p) * 80}px) rotate(${(i - 1) * 3}deg)`, opacity: p}}>{move}</div>;
        })}
      </div>
    </Frame>
  );
};

const ClaimBoundary = ({duration}: any) => {
  const frame = useCurrentFrame();
  return (
    <Frame duration={duration} accent={GOLD} label="EVIDENCE BEFORE CLAIMS">
      <div style={{position: 'absolute', left: 140, top: 230, fontSize: 94, fontWeight: 950, lineHeight: 1.03}}>The prototype proves<br/><span style={{color: CYAN}}>continuity of state.</span></div>
      <div style={{position: 'absolute', left: 145, bottom: 175, fontSize: 38, color: '#b9cbd8', opacity: ease(frame, 15, 30)}}>It does not yet prove continuity of learning.</div>
      <div style={{position: 'absolute', right: 120, top: 220, width: 440, height: 440, borderRadius: '50%', border: `6px solid ${GOLD}`, display: 'grid', placeItems: 'center', transform: `rotate(${interpolate(frame, [0, duration], [-8, 8])}deg)`}}>
        <div style={{fontSize: 64, fontWeight: 950, textAlign: 'center'}}>TEST<br/>THE<br/>CLAIM</div>
      </div>
    </Frame>
  );
};

const StepFocus = ({duration, number, word, description, accent}: any) => {
  const frame = useCurrentFrame();
  const p = ease(frame, 0, 18);
  return (
    <Frame duration={duration} accent={accent} label="THE PRACTICAL MODEL">
      <div style={{position: 'absolute', left: 140, top: 210, fontSize: 250, lineHeight: 1, color: `${accent}38`, fontWeight: 950}}>{number}</div>
      <div style={{position: 'absolute', left: 370, top: 285, fontSize: 126, fontWeight: 950, color: accent, transform: `translateX(${(1 - p) * 90}px)`, opacity: p}}>{word}</div>
      <div style={{position: 'absolute', left: 380, top: 480, width: 1050, fontSize: 42, lineHeight: 1.28, color: '#d6e4ed'}}>{description}</div>
      <div style={{position: 'absolute', right: 180, bottom: 150, width: 250, height: 250, border: `4px solid ${accent}`, transform: `rotate(${interpolate(frame, [0, duration], [0, 45])}deg)`, opacity: 0.35}} />
    </Frame>
  );
};

const ThreeStepFlow = ({duration}: any) => {
  const frame = useCurrentFrame();
  const steps = ['EXPLORE', 'CARRY', 'RESPOND'];
  return (
    <Frame duration={duration} accent={GOLD} label="ONE CONTINUOUS LEARNING LOOP">
      <div style={{position: 'absolute', left: 100, right: 100, top: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 25}}>
        {steps.map((step, i) => <React.Fragment key={step}>
          <div style={{padding: '50px 55px', minWidth: 400, textAlign: 'center', border: `3px solid ${[CYAN, BLUE, GOLD][i]}`, fontSize: 48, fontWeight: 950, opacity: ease(frame, 4 + i * 6, 18 + i * 6), transform: `translateY(${(1 - ease(frame, 4 + i * 6, 18 + i * 6)) * 40}px)`}}>{step}</div>
          {i < 2 && <div style={{fontSize: 64, color: GOLD}}>→</div>}
        </React.Fragment>)}
      </div>
    </Frame>
  );
};

const CTA = ({duration}: any) => {
  const frame = useCurrentFrame();
  const p = ease(frame, 0, 20);
  return (
    <Frame duration={duration} accent={GOLD} label="AMADUTOWN ADVISORY SOLUTIONS">
      <Img src={staticFile('amadutown-logo-upscaled.png')} style={{position: 'absolute', left: 150, top: 255, width: 270, height: 360, objectFit: 'contain', transform: `scale(${0.85 + p * 0.15})`}} />
      <div style={{position: 'absolute', left: 520, top: 270, width: 1130}}>
        <div style={{fontSize: 27, color: GOLD, fontWeight: 900, letterSpacing: 5}}>BUILD SYSTEMS THAT TEACH</div>
        <div style={{fontSize: 88, lineHeight: 1.02, fontWeight: 950, marginTop: 28}}>Subscribe for the<br/>next build decision.</div>
        <div style={{marginTop: 45, fontSize: 31, color: '#bed0dc'}}>Product evidence. Decision design. Agentic systems.</div>
      </div>
    </Frame>
  );
};

const Shot = ({start, end, children}: any) => (
  <Sequence from={sec(start)} durationInFrames={sec(end - start)}>
    {React.cloneElement(children, {duration: sec(end - start)})}
  </Sequence>
);

export const DarkCastleBase: React.FC = () => (
  <AbsoluteFill style={{background: INK}}>
    <Shot start={0} end={4.5}><PresenterBed /></Shot>
    <Shot start={4.5} end={8.5}><KineticTitle eyebrow="THE BOARD REMEMBERED e4" lines={['THE DECISION', 'DIDN’T.']} /></Shot>
    <Shot start={8.5} end={13.5}><PresenterBed /></Shot>
    <Shot start={13.5} end={17.5}><DecisionFork /></Shot>
    <Shot start={17.5} end={23.5}><PresenterBed /></Shot>
    <Shot start={23.5} end={27.5}><BoundaryCard /></Shot>
    <Shot start={27.5} end={33.5}><PresenterBed /></Shot>
    <Shot start={33.5} end={41}><ProofPreview /></Shot>
    <Shot start={41} end={47}><GameplayClip startFrom={0} label="Explore begins with a real board state" /></Shot>
    <Shot start={47} end={52}><ProductShot src="02-explore-e4.png" title="e4 becomes evidence" crop="52% 42%" /></Shot>
    <Shot start={52} end={57}><ProductShot src="02-explore-e4.png" title="The notation records the move" crop="88% 48%" zoom={1.32} accent={GOLD} /></Shot>
    <Shot start={57} end={62}><FlowDiagram words={['POSITION', 'MOVE', 'NEXT DECISION']} caption="A useful lesson carries context, not just coordinates." /></Shot>
    <Shot start={62} end={68}><ProductShot src="02-explore-e4.png" title="The full state stays visible" crop="50% 50%" /></Shot>
    <Shot start={68} end={73}><ProductShot src="03-handoff.png" title="The handoff keeps e4" crop="50% 42%" accent={GOLD} /></Shot>
    <Shot start={73} end={78}><ProductShot src="03-handoff.png" title="History travels with the learner" crop="82% 48%" zoom={1.3} /></Shot>
    <Shot start={78} end={84}><FlowDiagram words={['EXPLORE', 'HANDOFF', 'PLAY']} caption="The second mode should inherit the first mode’s decision." /></Shot>
    <Shot start={84} end={90}><GameplayClip startFrom={6} label="The handoff becomes a live position" /></Shot>
    <Shot start={90} end={96}><PresenterBed /></Shot>
    <Shot start={96} end={102}><GameplayClip startFrom={12} label="The system answers with a new decision" /></Shot>
    <Shot start={102} end={107}><ProductShot src="04-computer-response.png" title="The response enters the record" crop="86% 48%" zoom={1.3} accent={GOLD} /></Shot>
    <Shot start={107} end={112}><CandidateMoves /></Shot>
    <Shot start={112} end={118}><FlowDiagram words={['CONTEXT', 'RESPONSE', 'CHOICE']} caption="Now the loop can teach the next decision." /></Shot>
    <Shot start={118} end={123}><PresenterBed /></Shot>
    <Shot start={123} end={127}><ProductShot src="04-computer-response.png" title="The loop closes in product" crop="50% 46%" /></Shot>
    <Shot start={127} end={132}><ClaimBoundary /></Shot>
    <Shot start={132} end={137}><StepFocus number="01" word="EXPLORE" description="Make the learner’s first decision visible." accent={CYAN} /></Shot>
    <Shot start={137} end={142}><StepFocus number="02" word="CARRY" description="Move the reasoning and state across modes." accent={BLUE} /></Shot>
    <Shot start={142} end={147}><StepFocus number="03" word="RESPOND" description="Use the new state to shape the next choice." accent={GOLD} /></Shot>
    <Shot start={147} end={151}><ThreeStepFlow /></Shot>
    <Shot start={151} end={155}><KineticTitle eyebrow="THE PRODUCT PRINCIPLE" lines={['CONTINUITY', 'IS INSTRUCTION.']} accent={CYAN} /></Shot>
    <Shot start={155} end={159.5}><PresenterBed /></Shot>
    <Shot start={159.5} end={164}><KineticTitle eyebrow="THE BUILD DECISION" lines={['TEACH THE WHY,', 'NOT JUST THE MOVE.']} /></Shot>
    <Shot start={164} end={170.5}><PresenterBed /></Shot>
    <Shot start={170.5} end={176}><CTA /></Shot>
    <Shot start={176} end={184.94}><CTA /></Shot>
  </AbsoluteFill>
);
