# L01 P01 native sentence move · review only

The [before/after reel](l01-p01-sentence-move-before-after.mp4) compares the current early sentence with a candidate ordering. The exact native sentence “That story makes the pressure visible” is taken from source 28.40–30.80s, including silence before and after its 28.70–30.54s words. The candidate ends P01 at 28.40s, presents C01 next, then puts that native sentence at the start of P02 before the retained P02 speech. It uses the previously owner-confirmed A02 cut at 245.133333s.

| Candidate event | Target time | Native source time |
| --- | --- | --- |
| P01 native | 0.000–28.400s | [0, 28.4] |
| C01 cutaway and J01 | 28.400–235.000s | — |
| P02 moved native sentence | 235.000–237.400s | [28.4, 30.8] |
| P02 retained native audio and picture | 237.400–247.533s | [235.0, 245.133333] |
| P02 transition reserve | 247.533–248.200s | — |
| C02 cutaway and J01 | 248.200–345.000s | — |

The P02 move leaves **0.667s** before C02. The comparison reel omits the long C01 cutaway between its labeled snippets; it is not a full L01 or C01/C02 candidate. The [receipt](receipt.json) binds the source, script, EDL, prior A02 correction, cut points, output hash, and remaining gates. [Encoded-audio ASR evidence](asr-validation.json) found the moved sentence once in the after sequence, followed by P02's next sentence; it does not replace human listening.

The reel uses source presenter video and audio at native speed. During the moved sentence, the exact native opening presenter inset is composited onto the existing P02 map plate; no new talking-head pixels are generated. H.264/AAC is re-encoded for playback. No source word is synthesized or rewritten. Machine word times and full-decode checks support this edit, but a human must listen for any clipped phoneme or awkward visual handoff. No learner-facing media or binding changed, and no provider call, credits, merge, or release occurred.

Rebuild: `python3 -B scripts/qa/build-accelerated-l01-p01-sentence-move.py build`

Check: `python3 -B scripts/qa/build-accelerated-l01-p01-sentence-move.py check`
