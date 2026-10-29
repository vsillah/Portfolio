// @ts-nocheck
import React from 'react';
import { Composition } from 'remotion';
import { DarkCastleBase } from './video';

export const Root: React.FC = () => (
  <Composition
    id="DarkCastleBase"
    component={DarkCastleBase}
    durationInFrames={5548}
    fps={30}
    width={1920}
    height={1080}
  />
);
