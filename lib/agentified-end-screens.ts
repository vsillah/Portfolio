export type AgentifiedEndScreenBinding = {
  lessonId: string
  startSeconds: number
  endSeconds: number
  progress: number
  nextLessonId: string | null
  videoSha256: string
  captionsSha256: string
}

export const AGENTIFIED_END_SCREEN_PATTERN_COMMIT = '5570138a0cc4e02c4cea0dca81e1bf977a647a63'

export const agentifiedEndScreenBindings = {
  L02: { lessonId: 'L02', startSeconds: 504, endSeconds: 510, progress: 2, nextLessonId: 'L03', videoSha256: '32ae36cbe142aef0fe403b8b5a2ee28d338205a465007956edf6f19392886488', captionsSha256: 'eb8b81caf9283e0c5b106b6b404a72c178f50d2c0549bca18c92a4af343219d9' },
  L03: { lessonId: 'L03', startSeconds: 592, endSeconds: 600, progress: 3, nextLessonId: 'L04', videoSha256: '124d2b2c72e8ec331aebb6c80c702293b0a593e2f6c27eed280196b196c2b2a1', captionsSha256: 'f548f0a0d2a369dc082261d48eb5aa001e97c48e6cd993d49cb20a0208347bc4' },
  L04: { lessonId: 'L04', startSeconds: 597, endSeconds: 600, progress: 4, nextLessonId: 'L05', videoSha256: '3993bb619f6e011f62bdcbf064b4365d730339ed7a917c03f7d5424fbe884f9c', captionsSha256: 'ed98985beb67d616df745399937fa5bcc32b4b7e0267504393f5b2b6e2a4c647' },
  L05: { lessonId: 'L05', startSeconds: 234.398, endSeconds: 237.687, progress: 5, nextLessonId: 'L06', videoSha256: 'b28c0e2478559122fb8e610c00d1e48418279b9e318b6839d3c7e2b5b6a4759c', captionsSha256: '25e7735ad4209bce2bcf50098d10846da39f655a35468526b559123d34700389' },
  L06: { lessonId: 'L06', startSeconds: 255.493, endSeconds: 258.96, progress: 6, nextLessonId: 'L07', videoSha256: 'd6a18bb2163380c58d07b4a522af76e47c9250329aab8858d9880c073d51404a', captionsSha256: '018418cc1d4bf2333ed6525f1926b8b052f57677a136976e42c80c8f703c69ba' },
  L07: { lessonId: 'L07', startSeconds: 248.062, endSeconds: 251.332, progress: 7, nextLessonId: 'L08', videoSha256: '48b3ca355b0bc198aa2130af324085a8df68f225ad1c0ef2d5e4009bceba89b7', captionsSha256: '984fa64e556279730d30a602b3ce160620822ef0577a7ff6cf7de7028e3f8f21' },
  L08: { lessonId: 'L08', startSeconds: 254.357, endSeconds: 257.68, progress: 8, nextLessonId: 'L09', videoSha256: '1917140ce49410ebe456ae0d432fdd07dc57a35b6c1e1064e24f1f84623f7a6d', captionsSha256: '25261c89f43785ba30239c37d1c1e17e9a484614efd20a241e25ab0554c92011' },
  L09: { lessonId: 'L09', startSeconds: 263.36, endSeconds: 272.84, progress: 9, nextLessonId: 'L10', videoSha256: '5aff01214f8d174cf924fd89cbc9ff189968f54f182fb191a90330780977356a', captionsSha256: '68371ffd0a983e3f599be63acb57851bd96dd9bceebc574516db86680c093f3d' },
  L10: { lessonId: 'L10', startSeconds: 266.02, endSeconds: 274.28, progress: 10, nextLessonId: 'L11', videoSha256: '892db666b8168da43b06b3d8071fb42b709d9f37ec8cc936dade4d59372448bd', captionsSha256: 'e54bdfb260e186474ec496a72e2031716a8ddab89594eff6fdc940f1e35df1b8' },
  L11: { lessonId: 'L11', startSeconds: 248.46, endSeconds: 252.92, progress: 11, nextLessonId: 'L12', videoSha256: '040f282fa9982f71b56f6bdd4f128b57114fa7c167f159a3b0eb5e21e3a7f643', captionsSha256: 'e9b13aa8a32affc3da8022f8365b8dd0161e038f3bec6a069720820041d45c78' },
  L12: { lessonId: 'L12', startSeconds: 264.6, endSeconds: 268.12, progress: 12, nextLessonId: 'L13', videoSha256: '6053307528de11cb6e2b1edd09d5f0ebb830764e4532e53ea0fcc22f8d16fc84', captionsSha256: 'b054480cb0067f7a3d8c2cc727a7c47bd9734a3e1e85c3cb4b0672d9d8104467' },
  L13: { lessonId: 'L13', startSeconds: 247.007, endSeconds: 255.243, progress: 13, nextLessonId: 'L14', videoSha256: 'e9228c7ee9d200ec53f67d30dd987b3befb345fa5ef6c94601576e50fd42943f', captionsSha256: 'a1050902601ede710453ed94d895bcbb63f071666fc6173734a66bb75137bf27' },
  L14: { lessonId: 'L14', startSeconds: 230.687, endSeconds: 241.762, progress: 14, nextLessonId: 'L15', videoSha256: '40994408a0b4974eb725f49671dbc10ca4a74b287571161c963bdc97b637737a', captionsSha256: '74ce7e73e379f6b25eb3f5b67ed6771f24641d3a0f7c97114abe5e7fe9cc5446' },
  L15: { lessonId: 'L15', startSeconds: 246.324, endSeconds: 255.386, progress: 15, nextLessonId: 'L16', videoSha256: '5aeaf5df83e033aed4d4740f0be974077a899784cc19566e8898480867f0bc8d', captionsSha256: 'f417d3083212b036af00319a84443a8e3f5ddbda5e9daf47d2796eff07f85522' },
  L16: { lessonId: 'L16', startSeconds: 267.222, endSeconds: 267.309, progress: 16, nextLessonId: null, videoSha256: '43ce6b0052132a20c4c33d9ecaed73d425b3659014460d290a72d687a160eec3', captionsSha256: '18dd5bebac74af34048e62b8f6171daefea89ddfc86618a82cc2b74472936060' },
} as const satisfies Record<string, AgentifiedEndScreenBinding>

export function agentifiedEndScreenFor(lessonId: string, videoSha256: string, captionsSha256: string) {
  const binding = agentifiedEndScreenBindings[lessonId as keyof typeof agentifiedEndScreenBindings]
  if (!binding || binding.videoSha256 !== videoSha256 || binding.captionsSha256 !== captionsSha256) return null
  return binding
}
