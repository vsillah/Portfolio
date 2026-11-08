/** Approved provider-free L02-L04 composites; keep source hashes bound to these exact assets. */
export const agentifiedL02L04Media = {
  L02: {
    video: '/agentified/lessons/l02/approved-23d2adcf/agentified-l02-native-composite.mp4',
    captions: '/agentified/lessons/l02/approved-23d2adcf/agentified-l02-native-captions.vtt',
    compositeSha256: '23d2adcfab35bae76fecc2c6c816f420aa735d0cf1a209df2dfabe9aab930874',
    vttSha256: 'eb8b81caf9283e0c5b106b6b404a72c178f50d2c0549bca18c92a4af343219d9',
    durationSeconds: 510,
    spokenCues: [
      { start: '00:00:00', text: 'Morgan opens the Session Option Brief.' },
      { start: '00:00:02', text: 'It says the free session is a good idea.' },
      { start: '00:00:05', text: 'The wording sounds settled.' },
      { start: '00:00:07', text: 'Yet the brief has only prepared a comparison.' },
      { start: '00:00:10', text: "Somebody still has to decide whether the proposal belongs on next month's program agenda." },
      { start: '00:08:21', text: 'In the next lesson, we will make the evidence path readable to that owner.' },
    ],
  },
  L03: {
    video: '/agentified/lessons/l03/approved-af79f328/agentified-l03-native-composite.mp4',
    captions: '/agentified/lessons/l03/approved-af79f328/agentified-l03-native-captions.vtt',
    compositeSha256: 'af79f328560bd88d842cef8ea0a5ec8f587445fb62bb7c5de43a041205f65200',
    vttSha256: 'f548f0a0d2a369dc082261d48eb5aa001e97c48e6cd993d49cb20a0208347bc4',
    durationSeconds: 600,
    spokenCues: [
      { start: '00:00:00', text: 'Morgan sees a line in the Harbor Session Option Brief: “The room can hold twenty people.”' },
      { start: '00:00:04', text: 'Morgan asks where the number came from.' },
      { start: '00:00:06', text: 'A raw machine log might answer eventually, after someone searches through hundreds of entries.' },
      { start: '00:09:48', text: 'Next we will decide what a human correction is allowed to teach the system.' },
    ],
  },
  L04: {
    video: '/agentified/lessons/l04/approved-b17f3106/agentified-l04-native-composite.mp4',
    captions: '/agentified/lessons/l04/approved-b17f3106/agentified-l04-native-captions.vtt',
    compositeSha256: 'b17f3106b3430c7574cc99babc41033632a71aa1f578acfc1b8c66e072f3457e',
    vttSha256: 'ed98985beb67d616df745399937fa5bcc32b4b7e0267504393f5b2b6e2a4c647',
    durationSeconds: 600,
    spokenCues: [
      { start: '00:00:00', text: 'Morgan reviews the Harbor brief and writes a correction: “The facilitator note says available for review.”' },
      { start: '00:00:06', text: 'It does not say confirmed to teach.' },
      { start: '00:00:09', text: 'The draft is fixed.' },
      { start: '00:00:11', text: 'A week later, another request comes in.' },
      { start: '00:00:14', text: 'Should the agent remember that correction?' },
      { start: '00:00:16', text: 'Yes, perhaps.' },
      { start: '00:09:53', text: 'The next lesson will place these pieces on one operating map.' },
    ],
  },
} as const
