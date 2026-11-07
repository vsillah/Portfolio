# Agentified L01 native composite

This package places the single approved HeyGen source into the approved L01 provider-free animatic. It preserves native playback speed, uses the natural silence between passages as the split, and keeps the approved final 17 seconds as a provider-free closing evidence card.

Run `node agentified/workshop/l01-native-composite/render.mjs` from the repository root. The script uses the repository's existing `sharp` and FFmpeg dependencies to create the final 1920x1080 H.264/AAC MP4 with a selectable English caption track, native-timing SRT, scene frames, and an explicit source-to-sequence timeline. It does not call a provider.
