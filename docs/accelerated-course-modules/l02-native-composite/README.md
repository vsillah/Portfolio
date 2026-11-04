# Accelerated L02 native composite

This package binds the Human-QA-approved HeyGen source for Accelerated L02 to the approved provider-free storyboard.

## Bound inputs

- Provider job: `b4b8b4e83c18429feca3f4f4f45ae28b`
- Approved native source SHA-256: `2beae8254c76a6f8bf168afb8483e83e63c13b621ec3934c81397d3167cd1a3d`
- Approved script SHA-256: `73119dd526db5221d0af960feb25be911e31841c5f143d6e1a843076108ec1af`
- Storyboard packet: `../l02-l04-guided-video/l02-packet.json`
- Captions: `../l02-l04-guided-video/l02-storyboard.srt`

The native source remains at 1.0x speed, 1920x1080, and 25 fps. Its four sentence-complete passages are placed only in their approved scene windows. Source audio owns those windows; the rest of this review composite is silent because no separate full-lesson narration source has been approved.

## Build

```bash
python3 build-native-composite.py
```

The build refuses to run if the source, script, packet, or captions drift. It produces `accelerated-l02-native-composite.mp4`, `composite-manifest.json`, and `composite-receipt.json`.

## Review

Serve the repository root and open:

```text
/docs/accelerated-course-modules/l02-native-composite/review.html
```

No provider call, upload, publication, distribution, credential change, or external send is part of this package.
