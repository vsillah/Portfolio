# L01 P01/P02 presenter anchor review

Status: **still review only**. The earlier C01/C02 MP4 has a rejected lower-right presenter position and failed the ordinary-pause check. It was not rerendered for this correction and must not be used for Human QA.

The proposed fixed inset is **x=1420, y=48, width=448, height=256** in the 1920×1080 source frame. At the 1280×720 review video size it is approximately **x=947, y=32, width=299, height=171**. It leaves 52 source pixels at the right edge and 48 at the top. Its bottom is 616 source pixels above a conservative 160-pixel bottom control guard, and 517 review pixels above the separate caption band starting at y=720. These are geometric clearances, not a substitute for a real player check.

The [P01 desktop](p01-anchor-desktop.png) and [mobile](p01-anchor-mobile.png) stills show the approved Q3 card shifted below the inset with its full border visible. The [P02 desktop](p02-anchor-desktop.png) and [mobile](p02-anchor-mobile.png) stills show the original bottom-right presenter box removed from the workshop-map slide; the same-size inset sits above the map title. The two stills use source presenter pixels at 5s and 240.5s and show their corresponding planned captions in the bottom band. [Source bindings and still hashes](anchor-review.json) are local review evidence.

Desktop 1280×820 and mobile 390×250 stills were visually inspected. The presenter rectangle is inside the video image, clear of the caption band, and does not cover the active P01 or P02 text. The Q3 card remains sparse and the map is small on mobile; the separate illustration audit owns those issues. Caption legibility, player-control overlays, motion continuity, and every presenter window still require rendered playback. The failed 2.566s and 2.520s pauses also remain unresolved. No learner media or binding changed.

Rebuild these stills only with `python3 -B scripts/qa/build-accelerated-l01-j01-c01-c02.py anchor`. Do not run the `render` action under this stopped timing authorization.
