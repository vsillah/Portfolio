# Lesson media qualification

The exact asset hashes, stream metadata, caption counts, script comparison, silence windows and receipt bindings are in `qualification-manifest.json`. **Qualified** means a stated technical subcheck passed; it never means Human QA or release approval. All sixteen final composites decode to the same mono 16 kHz PCM hash as their bound sources, and all use 25 fps with the same source/final frame count. All sixteen source, composite and caption SHA-256s match their current bindings; posters are present and hashed. The existing protected-window validator passed 44 source/final frame comparisons at a minimum PSNR of 45.30 dB. This establishes identity and protected-window continuity, not full visual quality.

| Lesson | Phase 2 status | Exact finding and next gate |
| --- | --- | --- |
| L01 | **Needs correction** | Source/final audio identical; 55 cues exactly match all eight spoken script rows. Encoded container is 378.285 s versus 378.059 s declared (+0.226 s), with visual stream 378.280 s and a silent tail after the 359.645 s final cue. No bound UI end screen. Resolve end-screen design and duration binding in Phase 3/4; do not alter source in this phase. |
| L02 | **Needs correction** | 510 s file has six cues and 56 caption words versus 502 script words. Audio silence starts at 16.417 s and continues to 501.055 s. Only a ~20 s local provider presenter source is recorded. Full teaching narration is missing from this bound version. |
| L03 | **Needs correction** | 600 s file has four cues and 51 caption words versus 541 script words. Audio silence runs 14.099–588.024 s. Local provider presenter source is ~19 s. Full teaching narration is missing. |
| L04 | **Needs correction** | 600 s file has seven cues and 53 caption words versus 549 script words. Audio silence runs 17.836–593.796 s. Local provider presenter source is ~22 s. Full teaching narration is missing. |
| L05 | Technically present but visually pending | 60 cues; caption words exactly match script; 45.661 s guided-work silence plus closing silence. Inspect contextual pacing and visuals. |
| L06 | Technically present but visually pending | 50 cues; exact script words; 45.521 s guided-work silence. Inspect contextual pacing and visuals. |
| L07 | Technically present but visually pending | 56 cues; exact script words; 45.538 s guided-work silence. Inspect contextual pacing and visuals. |
| L08 | Technically present but visually pending | 55 cues; exact script words; 45.505 s guided-work silence. Inspect contextual pacing and visuals. |
| L09 | Technically present but visually pending | 48 cues; exact script words; 45.491 s guided-work silence. Inspect two bound diagrams and caption placement. |
| L10 | **Needs correction** | 51 cues and exact script words, but adjacent cues overlap 0.640 s at 03:04.360–03:05.000. Review display and retime the exact caption asset in Phase 3 if confirmed. |
| L11 | Technically present but visually pending | 41 cues; exact script words; 45.709 s guided-work silence. Inspect contextual pacing and visuals. |
| L12 | Technically present but visually pending | 44 cues; exact script words; 45.607 s guided-work silence. Inspect contextual pacing and visuals. |
| L13 | Technically present but visually pending | 49 cues; exact script words; 45.009 s guided-work silence. Inspect contextual pacing and visuals. |
| L14 | Technically present but visually pending | 54 cues; exact script words; 45.003 s guided-work silence. Inspect two bound diagrams and caption placement. |
| L15 | Technically present but visually pending | 57 cues; exact script words; 45.056 s guided-work silence. Inspect contextual pacing and visuals. |
| L16 | **Needs correction** | 63 cues and exact script words; 45.000 s guided-work silence. Hash-bound end screen is visible for only 0.087 s (267.222–267.309). Resolve final lesson ending in Phase 3/4. |

Every lesson also has **Needs rights confirmation** as a separate distribution gate. L02–L04 are **Blocked** from a completed narrated lesson claim until their missing passage is recovered and checked. Human QA remains pending for all sixteen. No media bytes were changed.
