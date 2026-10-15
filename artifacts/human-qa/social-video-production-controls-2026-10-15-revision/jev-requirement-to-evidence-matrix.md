# Jev Social Video Requirement-to-Evidence Matrix

| Requirement | Evidence | Result |
|---|---|---|
| Large presenter left; teaching artifact right | Completeness contract layout regions; corrected contact sheet and 12s split screenshot | Pass |
| Preserve exact internal animation | Six clips extracted from the clean native motion master hash `17bd9257…`; no redrawn motion layer remains | Pass |
| Each artifact exactly once | Six unique scene IDs, one timeline binding each, `appearance_count: 1`, loops disabled | Pass |
| Presenter-forward structure | 0–10s opening and 61.434–67.28s conclusion; split evidence between | Pass |
| Audible Stream 2.0 bed | Audio receipt: −28 LUFS target, 6.4 dB speech duck, 0 clipped samples, no loop, bounded fades | Pass |
| Complete conclusion and spoken subscribe CTA | The final spoken sentence is the approved conclusion. Vambah accepted the visual-only CTA for this exact Jev artifact and declined new audio; future generations still require semantic spoken-CTA proof | Accepted Jev-only exception |
| Preserve packaging and provenance | Killer-script, research, title/thumbnail, privacy, rights, voice A/B, and rotation bindings in package and contract | Pass |
| Safe areas and no crowding | Disjoint presenter/artifact rectangles; 48px outer artifact margin; contact sheet inspection | Pass |
| 1080×1920, lip sync, decode, hashes | Output receipt and full decode: 1080×1920, 25fps, 1782 frames, native presenter audio untouched in original mode | Pass |
| One teaching asset per frame | All 1,682 frames are checked; maximum concurrent teaching assets is 1. The prior 54.60–61.40s overlap is eliminated at the source-19.2s ownership boundary | Pass |
| Fail-closed completeness | Future renders require semantic transcript presence. The current artifact passes only through its exact artifact/input-bound exception, which cannot satisfy another version | Pass with accepted exception |

The native clips run once at source speed. When a narration window is longer than its animation, only the clip's final frame is held. No clip restarts or loops.
