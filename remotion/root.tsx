import { Composition } from 'remotion'
import { JevSocialVideoMotion } from './social-video/JevSocialVideoMotion'

export function Root() {
  return (
    <Composition
      id="JevSocialVideoMotion"
      component={JevSocialVideoMotion}
      durationInFrames={1782}
      fps={25}
      width={1080}
      height={1920}
      defaultProps={{ reducedMotion: false }}
    />
  )
}
