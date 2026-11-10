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
  L02: { lessonId: 'L02', startSeconds: 504, endSeconds: 510, progress: 2, nextLessonId: 'L03', videoSha256: '27a72885e84e7f100bda67298afa6c75a85696b7324650da950c658dff84d469', captionsSha256: 'eb8b81caf9283e0c5b106b6b404a72c178f50d2c0549bca18c92a4af343219d9' },
  L03: { lessonId: 'L03', startSeconds: 592, endSeconds: 600, progress: 3, nextLessonId: 'L04', videoSha256: '0ad7c3e132e2f54148f282a798255cb1f9a23a0f5865ee1cfb6e142efe1d6cbb', captionsSha256: 'f548f0a0d2a369dc082261d48eb5aa001e97c48e6cd993d49cb20a0208347bc4' },
  L04: { lessonId: 'L04', startSeconds: 597, endSeconds: 600, progress: 4, nextLessonId: 'L05', videoSha256: 'f7400d17001b64692c24ac9050a5896d40e5951a4782fc71282138e211dc0306', captionsSha256: 'ed98985beb67d616df745399937fa5bcc32b4b7e0267504393f5b2b6e2a4c647' },
  L05: { lessonId: 'L05', startSeconds: 234.398, endSeconds: 237.687, progress: 5, nextLessonId: 'L06', videoSha256: 'aa9b234ae717b8c54f90c1200db4f1657a21095b1714c33023cdc0431b062061', captionsSha256: '25e7735ad4209bce2bcf50098d10846da39f655a35468526b559123d34700389' },
  L06: { lessonId: 'L06', startSeconds: 255.493, endSeconds: 258.96, progress: 6, nextLessonId: 'L07', videoSha256: '163e01e6eb8f1a014b7155b40063bc2b6fa3546fc6bc4329579775581e6f9ef3', captionsSha256: '018418cc1d4bf2333ed6525f1926b8b052f57677a136976e42c80c8f703c69ba' },
  L07: { lessonId: 'L07', startSeconds: 248.062, endSeconds: 251.332, progress: 7, nextLessonId: 'L08', videoSha256: '42782f17a49cc35e3e01be1f29f7de18d13ee5406004a84da7e9602aa06f2f55', captionsSha256: '984fa64e556279730d30a602b3ce160620822ef0577a7ff6cf7de7028e3f8f21' },
  L08: { lessonId: 'L08', startSeconds: 254.357, endSeconds: 257.68, progress: 8, nextLessonId: 'L09', videoSha256: '5ea78c3647a901be84eddc1647185fcbea7178d79a5588befb467f92d20c93bd', captionsSha256: '25261c89f43785ba30239c37d1c1e17e9a484614efd20a241e25ab0554c92011' },
  L09: { lessonId: 'L09', startSeconds: 263.36, endSeconds: 272.84, progress: 9, nextLessonId: 'L10', videoSha256: '998a5ccc01d9a599025e27f035a72fe9b5104d98b69ce17bd12de5f6436a4dd6', captionsSha256: '68371ffd0a983e3f599be63acb57851bd96dd9bceebc574516db86680c093f3d' },
  L10: { lessonId: 'L10', startSeconds: 266.02, endSeconds: 274.28, progress: 10, nextLessonId: 'L11', videoSha256: '65936cf362e2299d70f9fea807102cbc3813dec491b4805d51d0ddaecd59a762', captionsSha256: 'e54bdfb260e186474ec496a72e2031716a8ddab89594eff6fdc940f1e35df1b8' },
  L11: { lessonId: 'L11', startSeconds: 248.46, endSeconds: 252.92, progress: 11, nextLessonId: 'L12', videoSha256: '169488eced03d6c5c300dc9241af14c7677389d9ed9997578266a7828cf842b3', captionsSha256: 'e9b13aa8a32affc3da8022f8365b8dd0161e038f3bec6a069720820041d45c78' },
  L12: { lessonId: 'L12', startSeconds: 264.6, endSeconds: 268.12, progress: 12, nextLessonId: 'L13', videoSha256: '64039c97b99b884e2c12351210ec079469e2b4c6a872961d1eaac2ff845089d1', captionsSha256: 'b054480cb0067f7a3d8c2cc727a7c47bd9734a3e1e85c3cb4b0672d9d8104467' },
  L13: { lessonId: 'L13', startSeconds: 247.007, endSeconds: 255.243, progress: 13, nextLessonId: 'L14', videoSha256: '4ae75aa1afeef376820edf3390313c5a4239fa70e94abf7e0b558bbca093a18f', captionsSha256: 'a1050902601ede710453ed94d895bcbb63f071666fc6173734a66bb75137bf27' },
  L14: { lessonId: 'L14', startSeconds: 230.687, endSeconds: 241.762, progress: 14, nextLessonId: 'L15', videoSha256: 'a58c3a1cf8550d67a1f164e64008a6eeea342978264904242cb23ad5a5a1591c', captionsSha256: '74ce7e73e379f6b25eb3f5b67ed6771f24641d3a0f7c97114abe5e7fe9cc5446' },
  L15: { lessonId: 'L15', startSeconds: 246.324, endSeconds: 255.386, progress: 15, nextLessonId: 'L16', videoSha256: '0c5bac1659ef43dd3737c77ffad29401f43477dd1add6d8c6ad799a43f42c1bf', captionsSha256: 'f417d3083212b036af00319a84443a8e3f5ddbda5e9daf47d2796eff07f85522' },
  L16: { lessonId: 'L16', startSeconds: 267.222, endSeconds: 267.309, progress: 16, nextLessonId: null, videoSha256: '4283c8d8fb7eca85b9b0493aa07ac22901f0155d0742ebc61c0a0744698846fc', captionsSha256: '18dd5bebac74af34048e62b8f6171daefea89ddfc86618a82cc2b74472936060' },
} as const satisfies Record<string, AgentifiedEndScreenBinding>

export function agentifiedEndScreenFor(lessonId: string, videoSha256: string, captionsSha256: string) {
  const binding = agentifiedEndScreenBindings[lessonId as keyof typeof agentifiedEndScreenBindings]
  if (!binding || binding.videoSha256 !== videoSha256 || binding.captionsSha256 !== captionsSha256) return null
  return binding
}
