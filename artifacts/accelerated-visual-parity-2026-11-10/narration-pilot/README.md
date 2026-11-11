# L01 J01 single-call narration pilot

Status: review only; fit failed. The original WAV is local and unchanged. It and the two local MP3 listening excerpts are intentionally untracked because this lane has no confirmed permission to publish the generated voice file in a GitHub PR. The [local player](review.html) works beside those files; GitHub readers get the source-bound [receipt](receipt.json) and [ASR evidence](l01-j01-asr-evidence.json) without the voice media.

The 3,518-character approved J01 payload (SHA-256 `33e4fced3cde522647ec92a08840b2c56b28becfc86a1f2f11f3d24e4b4d6a4a`) maps to L01 C01 and C02 in the [narration pack](../../../../docs/accelerated-course-modules/narration-production-pack-2026-11-10.json). The 209.029-second mono PCM WAV (SHA-256 `24ce83730c2112a52fee7e765794c29c771886ad103094ddff53511d33491360`) gives C01 about 138.06 seconds and C02 about 70.97 seconds at normal speed. The approved windows allow 203.48 and 96.80 seconds. This leaves 91.25 seconds unfilled in total.

Local faster-whisper `small.en` returned the same 611 normalized tokens in the same order as the approved payload. This is strong machine evidence for wording and order, subject to human listening. The -40 dBFS / 0.25-second silence scan found 52 pauses totaling 21.21 seconds; the longest was 0.80 seconds, with none over one second. The pace is about 179.9 approved words/minute in C01 and 164.0 in C02. No subjective pace or presenter-voice match is claimed here.

Do not stretch, slow, or insert the WAV into the learner video to hide this gap. Reconcile pacing and timing before any further provider call. No new provider request, learner-media edit, caption retime, binding, merge, or release occurred in this lane. The captain reported two HeyGen credits spent and $0 cash for the one authorized call; this lane did not query the provider.

## Rebuild and local playback

```bash
python3 -B scripts/qa/build-accelerated-j01-pilot-review.py build
python3 -B scripts/qa/build-accelerated-j01-pilot-review.py check
python3 -m http.server 8771 --bind 127.0.0.1
```

Open `http://127.0.0.1:8771/artifacts/accelerated-visual-parity-2026-11-10/narration-pilot/review.html` in the local browser with `l01-j01-original.wav` beside it.
