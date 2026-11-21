# L01-08 caption-clearance stop

Historical stop at local experiment `633a54577b54a5d002530fa4527cc42fbdec39dd`. Resolved by local correction `d49c07676741d2c6ee7b89720976203ce1227470`; see `README.md` for the exact-commit rerun. The PR #1290 candidate remains review-only at `55ebd09cba902ccc681a1289601e8f8c773d38a8`.

The external caption band clears the Operating File card at 350 seconds on desktop and mobile. At the protected end-screen start, 359.645 seconds, the band disappears but Chromium renders the final native cue over the beginning of the branded end screen. This violates the protected-boundary stop condition. The approved source-video frame at that timestamp, `/tmp/l01-08-boundary-source.png`, has no subtitle text, so the visible line is the browser text track. See `L01-08-1280-end.png` and `L01-08-390-end.png`; the later `L01-08-1280-after.png` shows the line gone.

The initial automated state verifier reported 66 learner and six fixed-candidate states passing, and the recorder decoded four MP4s. Those initial results did **not** qualify the change because the verifier checked cue timing and band state, but not the rendered native-cue residue at the exact boundary. The correction keeps the L01 track hidden during its end screen. New exact-commit screenshots and natural playback inspection show the residue absent.
