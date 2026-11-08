# Agentified L02-L04 Learning Plan binding

Base: `bb776e6c4188fdbab29efd41cb8bcdd8dba7aef0` (merged PR #1248). The approved source composites, captions and poster system are reused without provider calls. L01 media, captions, transcript, poster transition, and Operating File behavior remain unchanged. L05-L16 have no video source and remain locked.

## Exact media

| Lesson | Composite SHA-256 | Duration | VTT SHA-256 |
| --- | --- | ---: | --- |
| L02 | `23d2adcfab35bae76fecc2c6c816f420aa735d0cf1a209df2dfabe9aab930874` | 08:30 | `eb8b81caf9283e0c5b106b6b404a72c178f50d2c0549bca18c92a4af343219d9` |
| L03 | `af79f328560bd88d842cef8ea0a5ec8f587445fb62bb7c5de43a041205f65200` | 10:00 | `f548f0a0d2a369dc082261d48eb5aa001e97c48e6cd993d49cb20a0208347bc4` |
| L04 | `b17f3106b3430c7574cc99babc41033632a71aa1f578acfc1b8c66e072f3457e` | 10:00 | `ed98985beb67d616df745399937fa5bcc32b4b7e0267504393f5b2b6e2a4c647` |

The spoken transcript cues are derived verbatim from each approved English VTT. The existing lesson guide remains below the spoken cues. Source and public file digests are checked by `lib/agentified-l02-l04-media.test.ts`.

## Local QA

Run `node scripts/qa/record-agentified-l02-l04-learning-plan.mjs http://localhost:3219 <exact-commit>` against a server started from that commit. The script checks metadata and sources for all three videos, captions and spoken transcripts, viewport overflow, L05 lock, worksheet persistence through the full Operating File, and guest playback progress. It saves desktop, tablet and mobile screenshots and H.264 MP4 walkthroughs in this folder. Recording uses a synthetic worksheet response and aborts external HTTPS requests.

Route: `http://localhost:3219/agentified/learningplan?lesson=L02&revision=<exact-commit>`.

Validation: focused Vitest suite passed (13 tests); `NODE_OPTIONS=--max-old-space-size=8192 MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run build` passed with the existing local Portfolio environment. Rendered guest QA passed at 1440×900, 820×1000 and 390×844. Member persistence is covered by the existing member playback test and the unchanged shared API path; an authenticated live member flow was not run. No provider, upload, publish, migration, production mutation or external send occurred.
