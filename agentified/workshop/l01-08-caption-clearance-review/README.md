# L01-08 caption clearance review

Review-only correction for draft PR #1293. Code commit: `d49c07676741d2c6ee7b89720976203ce1227470`. The distinct fixed-padding candidate was copied byte-for-byte from draft PR #1290 head `55ebd09cba902ccc681a1289601e8f8c773d38a8`; it is **not** bound to learners.

## Scope and result

The approved L01 learner media is unchanged. Desktop Small and Medium captions use the existing external band while the Operating File card is shown, from 343.059 seconds until the branded end screen starts at 359.645 seconds. The last cue remains in that band until its original end time. At the boundary, the band clears and the L01 text track remains hidden, including after seeking or pausing, so the browser does not paint the final native cue over the protected end screen. L01-07 retains native desktop captions. Mobile and Large captions retain their existing external-band behavior.

The initial local experiment showed a native cue residue over the end screen. `RESUME-STOP.md` records that observation. This packet was regenerated after the correction from the exact code commit above. The approved video frame at the boundary contains no subtitle text; the earlier residue was browser text-track rendering.

## Bindings

- Approved L01 video SHA-256: `1eeaa68bde9529da7e2aeb8ccbd36b4dd41c56f408e191792765230b9c861775`.
- Approved L01 VTT SHA-256: `6dee645eafea79649d17711c589a84acbe45a478b7a5994f718ccbbc6297492e`.
- Fixed desktop candidate MP4 SHA-256: `e0985ea2e0a31f155a1e3200d057c0adb2f5507e40511ed6741811ef0db52245`.
- Fixed mobile candidate MP4 SHA-256: `8d4b0899752298d6bfc14d281c06b7f4a9994ab82ed8ef2aef72dc1ee3076c5d`.
- Both candidate VTT files SHA-256: `ddb8a6224dad7cae4bd628c53af34694017487f64e95145c98c6b73d23350d05`.

`receipt.json` holds the complete source paths, candidate hashes, timestamps, and measured states. `walkthrough-state.json` maps each recorded step to the exact localhost route and code commit.

## Validation

- `vitest run` on caption controls, Agentified hero, Agentified workshop, and Accelerated Learning Plan: 81 passed.
- ESLint on the three changed TSX files, `git diff --check`, and both QA script syntax checks: passed.
- `node scripts/qa/verify-l01-08-caption-clearance.mjs`: 70 learner states and six fixed-candidate states passed at 1280 and 390 pixel widths. Checked every L01 scene boundary/midpoint, adjacent L01-07, cue gaps, the final cue, exact 359.645 boundary, later end screen, natural playback across the boundary, S/M/L, captions off/on and paused restoration, controls, geometry, overflow, source hashes, and dark theme.
- `node scripts/qa/record-l01-08-caption-clearance.mjs`: 30 walkthrough states and four MP4s decoded successfully.
- Visual inspection: `L01-08-1280-M-on.png`, `L01-08-390-L-on.png`, `L01-08-1280-end.png`, `L01-08-390-end.png`, `L01-08-1280-played-through.png`, `L01-08-390-played-through.png`, and `L01-08-390-dark-theme.png` show no caption/card collision or lingering cue at the protected boundary.

## Walkthroughs

- `L01-learner-1280-d49c076767.mp4`
- `L01-learner-390-d49c076767.mp4`
- `L01-candidate-desktop-d49c076767.mp4`
- `L01-candidate-mobile-d49c076767.mp4`

These are local synthetic-session review artifacts. No provider action, media bind, merge, deployment, publication, or release occurred. Captain reconciliation remains required because downstream PR #1294 also touches the shared hero component. Human QA remains a separate captain gate.
