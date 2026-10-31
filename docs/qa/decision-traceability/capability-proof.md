# Dark Castle capability proof — source and claim register

Portfolio branch: `codex/dark-castle-capability-proof`. Dark Castle source revision: `682fb3ec32eacf23485cd6ead1a2ca852fe4400f` (`origin/main`, inspected 2026-10-31). Public image assets are deterministic pixel crops from that revision, without generated pieces, altered positions, rewritten UI, or copied private data. We discarded a generative crop attempt because it changed board details. The original local QA captures were not published.

The page shows selected product views from browser and iOS builds. It does not promise that every mode is available on every platform. The six scenes are different learner triggers and responses, not six examples of the same opening position.

| Public scene and crop | Exact Dark Castle source path at the revision above | Product claim and boundary |
| --- | --- | --- |
| Drill — `public/lead-magnets/dark-castle-capabilities/drill.jpg`, crop `780:715:120:185` | `docs/qa/native-canonical-learning/expo-1440.jpg`; `docs/qa/native-canonical-learning/README.md` | Curriculum stage, Black-to-move Drill board, Hint and Answer. Local build evidence, no release or mastery claim. |
| Walk-through — `walkthrough.jpg`, crop `730:675:200:80`; `walk-step.jpg`, crop `725:128:200:475` | `docs/qa/evidence/desktop-walk.jpg`; `docs/qa/evidence/walk-next.jpg`; `README.md` | Mode, lesson stages, board, next-part explanation and Play from here. The two crops come from successive states of one source flow. They do not assert live interactive behavior on the scorecard. |
| Review to practice — `mistake-save.jpg`, crop `325:80:30:410`; `mistake-library-heading.jpg`, crop `520:140:25:90`; `mistake-library-filter.jpg`, crop `520:85:25:270` | `docs/qa/ios-my-mistakes-phase3/media/phone-candidate-save.png`; `docs/qa/ios-my-mistakes-phase3/media/phone-my-mistakes.png`; `docs/qa/ios-my-mistakes-phase3/README.md` | Save for practice and Saved games → Practice → My Mistakes. The three crops exclude synthetic QA source labels, example counts, and internal receipts. Local iOS evidence; no public release claim. |
| Coach — `coach-review.jpg`, crop `740:490:90:970` | `docs/qa/native-coach-controls/final-ios-review.png`; `docs/qa/browser-coach-overlays/README.md` | Move review identifies a move to study and shows Study/Again. Excludes engine diagnostics and simulator chrome. No claim that Coach diagnoses every game. |
| Variation — `variation.jpg`, crop `425:495:20:175` | `docs/qa/variation-piece-cues/pairing-first-727.png`; `docs/qa/variation-piece-cues/README.md` | Same-board piece silhouettes and highlighted knight, qualified in local browser/iOS development contexts. Excludes native-analysis unavailable and roadmap text. |
| Candidates — `candidates.jpg`, crop `745:840:90:780` | `docs/qa/native-candidate-analysis/ios-black-candidates.png`; `docs/qa/native-candidate-analysis/README.md` | iOS Explore analysis with three candidate moves, White-perspective scores and continuation lines. Native-only engine availability; browser Candidates may be unavailable. No win-probability or outcome claim. |

Crops were produced with FFmpeg's `crop=width:height:x:y` filter. The two My Mistakes library slices are shown together in the page without the synthetic example count between them. Each public asset has an exact SHA-256 fingerprint:

| Asset | SHA-256 |
| --- | --- |
| `drill.jpg` | `e2901d94ffef751f0ab9afde015b22f8639a2b6300f7b8f6618b4fddcd7ede82` |
| `walkthrough.jpg` | `6d45c8d8ac63ea89b15252d4fdf3e217386e5a106fc9f7b433d6297b531f11e3` |
| `walk-step.jpg` | `5df31d8686ceea4d546fd75d50a7fa657308c6d3dc63832421d185ee149288e3` |
| `mistake-save.jpg` | `05993cc5293483bd038ac0bf4b55cfcfe3d42bce9d19a4f4b40458af9b6fd7f5` |
| `mistake-library-heading.jpg` | `f82a595bee916f70de8f14a66b006ca5842e10b3e700d7ffe88caa2fdbd91e72` |
| `mistake-library-filter.jpg` | `c976cf5556ab8749bd3406128842a7a8ac46ace56dafeeb6354d46ad7c41a033` |
| `coach-review.jpg` | `e8454aca7d268a32d34176855ee0957ff3792feb3902a8e408e2665e656b8e9d` |
| `variation.jpg` | `6cdf828b104e2b828b8a80e0bf6537645bd7169897b7961e2594f3761ee5add2` |
| `candidates.jpg` | `16d556036af61bde915b3e81cbd75bfe7940f2d7f17cd3f70a6ac239bd22b242` |

## Competitor comparison provenance

Inspected official documentation on 2026-10-31:

| Public comparison statement | Official support |
| --- | --- |
| Chess.com offers lessons, Game Review, and MoveTrainer for study and retry. | [Lessons](https://support.chess.com/en/articles/8609703-how-do-lessons-work-on-chess-com), [Game Review](https://support.chess.com/en/articles/10328363-how-do-i-use-game-review-on-the-app), [MoveTrainer](https://support.chess.com/en/articles/10319267-when-will-the-variations-be-ready-for-my-review). |
| Lichess offers analysis, studies, game-based puzzles, learn-from-mistakes tools, and broad play/community options. | [Lichess features](https://lichess.org/features). |
| Both services span broad play and study paths. | The same official feature documentation above; this is a qualitative inference about breadth, not a user-count or superiority assertion. |
| Dark Castle connects a lesson, play, review, and a return to practice. | Dark Castle `README.md` and the six specific QA sources above; Portfolio source brief `docs/social-content-qa/dark-castle-capability-differentiation-2026-10-31.md`. This is the design emphasis of the connected flow, not a claim that competitors lack similar pieces. |

The page makes no uniqueness, superiority, scale ranking, learning-outcome, or release claim. The four scorecard questions, scoring, PDF, email, consent, privacy link, and submit API are unchanged. No approved LinkedIn content or production Social Content data was touched.
