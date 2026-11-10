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
  L02: { lessonId: 'L02', startSeconds: 504, endSeconds: 510, progress: 2, nextLessonId: 'L03', videoSha256: 'c52a6677bdb1b1ffb2c0571dd5d0c3a0fd12706cc4c45610b82b6305dcb753e3', captionsSha256: 'eb8b81caf9283e0c5b106b6b404a72c178f50d2c0549bca18c92a4af343219d9' },
  L03: { lessonId: 'L03', startSeconds: 592, endSeconds: 600, progress: 3, nextLessonId: 'L04', videoSha256: '499bd73624a85d960e0c11764a083f664cea719a8dbdc115fe0164dc86521ac6', captionsSha256: 'f548f0a0d2a369dc082261d48eb5aa001e97c48e6cd993d49cb20a0208347bc4' },
  L04: { lessonId: 'L04', startSeconds: 597, endSeconds: 600, progress: 4, nextLessonId: 'L05', videoSha256: '22d069091c6cab6214f5026326149d6b3220a6aad944cf2be32446fd6c6d7295', captionsSha256: 'ed98985beb67d616df745399937fa5bcc32b4b7e0267504393f5b2b6e2a4c647' },
  L05: { lessonId: 'L05', startSeconds: 234.398, endSeconds: 237.687, progress: 5, nextLessonId: 'L06', videoSha256: 'fb2ce559d03f86937b975cb5e34469ba4de6053394482cd2189d3bc37626d690', captionsSha256: '25e7735ad4209bce2bcf50098d10846da39f655a35468526b559123d34700389' },
  L06: { lessonId: 'L06', startSeconds: 255.493, endSeconds: 258.96, progress: 6, nextLessonId: 'L07', videoSha256: '9143cebf9155c6ab4bfad1d7cc597386e17097e09b1aebbf9cf5903b5b9ed626', captionsSha256: '018418cc1d4bf2333ed6525f1926b8b052f57677a136976e42c80c8f703c69ba' },
  L07: { lessonId: 'L07', startSeconds: 248.062, endSeconds: 251.332, progress: 7, nextLessonId: 'L08', videoSha256: 'c1cd6bde3f6e83045db5657dd0398415213dbfa99c2380adc7211dae88d6d82b', captionsSha256: '984fa64e556279730d30a602b3ce160620822ef0577a7ff6cf7de7028e3f8f21' },
  L08: { lessonId: 'L08', startSeconds: 254.357, endSeconds: 257.68, progress: 8, nextLessonId: 'L09', videoSha256: 'd453fee6eeda912361d976c29cc32b90a2ec0bf81a2bfdb6866766d3f7ad35c2', captionsSha256: '25261c89f43785ba30239c37d1c1e17e9a484614efd20a241e25ab0554c92011' },
  L09: { lessonId: 'L09', startSeconds: 263.36, endSeconds: 272.84, progress: 9, nextLessonId: 'L10', videoSha256: '89cf78180f33a0363e762f6c245b1ba74826648eb9ed0a973464d60a77aabde4', captionsSha256: '68371ffd0a983e3f599be63acb57851bd96dd9bceebc574516db86680c093f3d' },
  L10: { lessonId: 'L10', startSeconds: 266.02, endSeconds: 274.28, progress: 10, nextLessonId: 'L11', videoSha256: '94d439462217ed3d7c321cfc7eeffeb2bd303819f77f107f972c5924d291fbd1', captionsSha256: 'e54bdfb260e186474ec496a72e2031716a8ddab89594eff6fdc940f1e35df1b8' },
  L11: { lessonId: 'L11', startSeconds: 248.46, endSeconds: 252.92, progress: 11, nextLessonId: 'L12', videoSha256: '0c38b71f50b2c9c1c79ede56ee2bdff67007f7f2d70e0d043bc506669b8f333e', captionsSha256: 'e9b13aa8a32affc3da8022f8365b8dd0161e038f3bec6a069720820041d45c78' },
  L12: { lessonId: 'L12', startSeconds: 264.6, endSeconds: 268.12, progress: 12, nextLessonId: 'L13', videoSha256: 'f07fea0d2edcb8dfd469db26f33f2dc6fd2b3fcc86de49f0a718bc8ad179d85d', captionsSha256: 'b054480cb0067f7a3d8c2cc727a7c47bd9734a3e1e85c3cb4b0672d9d8104467' },
  L13: { lessonId: 'L13', startSeconds: 247.007, endSeconds: 255.243, progress: 13, nextLessonId: 'L14', videoSha256: 'f7aeebb66a836bdd3b8032e860a2fd9e7c3eef0ed0b07a5dc6937f6d9ecef993', captionsSha256: 'a1050902601ede710453ed94d895bcbb63f071666fc6173734a66bb75137bf27' },
  L14: { lessonId: 'L14', startSeconds: 230.687, endSeconds: 241.762, progress: 14, nextLessonId: 'L15', videoSha256: '9856c54ed142c7c64f53e7c8663f202fa4432051bbc93658df3d796ad2054a11', captionsSha256: '74ce7e73e379f6b25eb3f5b67ed6771f24641d3a0f7c97114abe5e7fe9cc5446' },
  L15: { lessonId: 'L15', startSeconds: 246.324, endSeconds: 255.386, progress: 15, nextLessonId: 'L16', videoSha256: '230e07fb33ca2783b6f51ef5a3a0275e2fc5723fb4d626b380acec4a099f8bc3', captionsSha256: 'f417d3083212b036af00319a84443a8e3f5ddbda5e9daf47d2796eff07f85522' },
  L16: { lessonId: 'L16', startSeconds: 267.222, endSeconds: 267.309, progress: 16, nextLessonId: null, videoSha256: '21b6efaba63b41403cb4675442937d2f8c4aaf6e6453cd6c6ce19fdd136df153', captionsSha256: '18dd5bebac74af34048e62b8f6171daefea89ddfc86618a82cc2b74472936060' },
} as const satisfies Record<string, AgentifiedEndScreenBinding>

export function agentifiedEndScreenFor(lessonId: string, videoSha256: string, captionsSha256: string) {
  const binding = agentifiedEndScreenBindings[lessonId as keyof typeof agentifiedEndScreenBindings]
  if (!binding || binding.videoSha256 !== videoSha256 || binding.captionsSha256 !== captionsSha256) return null
  return binding
}
