# Agentified L02-L04 Learning Plan binding

Correction base: `e51b09b746256e1c6825d249438bcd4a0e6f181e`. The approved native sources, captions, narration, timing and poster system are unchanged; only provider-free composite continuity is corrected. L05-L16 have no video source and remain locked.

## Exact media

| Lesson | Composite SHA-256 | Duration | VTT SHA-256 |
| --- | --- | ---: | --- |
| L02 | `e2b5ecbc55a8bc049793a1706b61267b3638dfe8220357fc937b4e8d1024ebae` | 08:30 | `eb8b81caf9283e0c5b106b6b404a72c178f50d2c0549bca18c92a4af343219d9` |
| L03 | `8749ae9a3750c0cfa2daab1c04bf9d7e81423f8728d68d0ffcd35276e63acde7` | 10:00 | `f548f0a0d2a369dc082261d48eb5aa001e97c48e6cd993d49cb20a0208347bc4` |
| L04 | `8d0245ffbb2a35d65007f43c75b7bef291f90923fe6b8b159480b9662b4b41d7` | 10:00 | `ed98985beb67d616df745399937fa5bcc32b4b7e0267504393f5b2b6e2a4c647` |

The spoken transcript cues are derived verbatim from each approved English VTT. The existing lesson guide remains below the spoken cues. Source and public file digests are checked by `lib/agentified-l02-l04-media.test.ts`.

## Local QA

Run `node scripts/qa/record-agentified-l02-l04-learning-plan.mjs http://localhost:3219 <exact-commit>` against a server started from that commit. The script checks metadata and sources for all three videos, captions and spoken transcripts, viewport overflow, L05 lock, worksheet persistence through the full Operating File, and guest playback progress. It saves desktop, tablet and mobile screenshots and H.264 MP4 walkthroughs in this folder. Recording uses a synthetic worksheet response and aborts external HTTPS requests.

Route: `http://127.0.0.1:3159/agentified/learningplan?lesson=L02&revision=d55e6f7895f431fd4b901a5f0ec3d7265d021841`.

Validation: `npx vitest run lib/agentified-l01-media.test.ts lib/agentified-l02-l04-media.test.ts app/agentified/AgentifiedLessonHero.test.tsx app/agentified/AgentifiedWorkshop.test.tsx` passed (18 tests across 4 files); `NODE_OPTIONS=--max-old-space-size=8192 npm run build` passed with the existing local Portfolio environment. Rendered-frame tests sample all presenter handoffs and closing cards. Guest QA passed at 1440×900, 820×1000 and 390×844. Member persistence is covered by the existing member playback test and unchanged shared API path; an authenticated live member flow was not run. No provider, upload, publish, migration, production mutation or external send occurred.
