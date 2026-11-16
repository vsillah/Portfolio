# Accelerated Lesson 03 local illustration review

This package reconstructs the Human-QA-approved local desktop and 390×844 review candidates. It does not update learner media. The seven second-half illustrations are synthetic teaching scenes; they are not records of real learner research. Source art, returned narration WAVs, recovered J02 word timing, local ASR timing inputs, build scripts, optional WebVTT, and bounded receipts are included. Generated MP4s and intermediates remain local and are excluded from this PR.

## Bound inputs

- Base commit: `2002dda495dd319dd936fea00a405928bba3302e` on `codex/accelerated-lesson-pacing-audit`.
- Original native picture prerequisite: `artifacts/accelerated-l03-heygen-2026-11-04/accelerated-l03-heygen-native.mp4` in the primary Portfolio checkout, SHA-256 `064e049bfaee6d60d5d811d516dbcdf9c14466602afef9a34e07cbf31c551198`. The scripts intentionally bind this existing local first-party file; it is not copied into Git.
- Bound native composite: `public/accelerated/lessons/l03/approved-02b9c3ea/accelerated-l03-native-composite.mp4`, SHA-256 `02b9c3ea941c22ffaf87b3bc4e4c4612951499af15485e0261910fad6014053a`.
- J01 returned WAV: `l03-j01-provider-return/l03-j01-original.wav`, SHA-256 `6d86bdd09509f492724b76f3af256dc50c128e534e052b972a9092f18ca60531`.
- J02 returned WAV: `j02-second-half-preflight/l03-j02-original.wav`, SHA-256 `4b1b3217ae87e1c74bbb197204bf7a618414e00b9f3dc2bb800439715b7248b3`.

## Rebuild order

From the repository root on macOS with Python, Pillow, and FFmpeg installed:

```bash
python3 artifacts/accelerated-l03-illustration-checkpoint-2026-11-13/scene01-provider-free/build_presenter_stills.py
python3 artifacts/accelerated-l03-illustration-checkpoint-2026-11-13/scene01-contextual-review/build_recovery_video_only.py
python3 artifacts/accelerated-l03-illustration-checkpoint-2026-11-13/scene01-contextual-review/build_mobile_opening_correction.py
python3 artifacts/accelerated-l03-illustration-checkpoint-2026-11-13/j01-first-half-review/build_recovery_video_only.py
python3 artifacts/accelerated-l03-illustration-checkpoint-2026-11-13/j01-first-half-review/build_mobile_single_plate.py
python3 artifacts/accelerated-l03-illustration-checkpoint-2026-11-13/j01-first-half-review/build_mobile_options_aligned.py
python3 artifacts/accelerated-l03-illustration-checkpoint-2026-11-13/j02-second-half-preflight/build_whole_lesson_review.py
python3 artifacts/accelerated-l03-illustration-checkpoint-2026-11-13/j02-second-half-preflight/build_optional_captions.py
```

The first-half output checks must equal desktop `6cbca81b31e146e075d98c8ba3832e181e59af097a1f7cbfa95bade282b33a61` and mobile `2cee5081cc116c0373822b4a91edf38b09de875d6731ea5b719be20d29b03141`. The approved whole-lesson local review checks are desktop `24e5daaa3989dc8ae4324bca4726a08bdc9c16475e264fdd7cd5b0bf5d2987d3` and mobile `bfbe6e377633cc2ff9c1fe3af216ee79e0a84957df847ffc2e26e3f374c1616c`. See `whole-lesson-technical-receipt.json` for local file paths, frame counts, validation, and limits.

J01's original provider word-timing JSON was removed with a prior worktree. The optional caption track uses canonical script wording and local ASR timing for J01. Its timing remains subject to captain review; the video picture and audio rebuild does not depend on that missing timing file.

## Approval boundary

Vambah approved Human QA for these two exact local MP4 hashes. This approval permits the reproducible source and receipts to be added to draft PR #1270. It does not authorize provider generation, spending, learner-media replacement, merge, deployment, publication, or release.
