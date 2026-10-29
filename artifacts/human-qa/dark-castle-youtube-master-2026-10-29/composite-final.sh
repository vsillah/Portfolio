#!/bin/zsh
set -euo pipefail

PACKAGE_DIR=${0:a:h}
BASE="$PACKAGE_DIR/dark-castle-base.mp4"
PRESENTER="$PACKAGE_DIR/source/heygen/dark-castle-presenter.mp4"
MUSIC=/Users/vambahsillah/Projects/Portfolio.worktrees/stop-counting-ai-licenses-media/local-private/youtube-music/the-stream-v2.wav
OUTPUT="$PACKAGE_DIR/dark-castle-youtube-master.mp4"

if [[ ! -f "$PRESENTER" ]]; then
  print -u2 "Missing approved native presenter source: $PRESENTER"
  exit 1
fi

ffmpeg -hide_banner -loglevel warning -y \
  -i "$BASE" -i "$PRESENTER" -i "$MUSIC" \
  -filter_complex "
    [1:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,split=2[p0][p1];
    [p0]trim=start=0:end=41,setpts=PTS-STARTPTS,format=yuva420p,fade=t=out:st=40.65:d=0.35:alpha=1[presenter_open];
    [p1]trim=start=155:end=176,setpts=PTS-STARTPTS,format=yuva420p,fade=t=in:st=0:d=0.35:alpha=1,fade=t=out:st=20.65:d=0.35:alpha=1,setpts=PTS+155/TB[presenter_close];
    [0:v][presenter_open]overlay=0:0:eof_action=pass[v1];
    [v1][presenter_close]overlay=0:0:eof_action=pass[vout];
    [1:a]aresample=48000,loudnorm=I=-16:LRA=7:TP=-1.5[voice];
    [2:a]atrim=0:184.94,aresample=48000,loudnorm=I=-27:LRA=7:TP=-2,afade=t=in:st=0:d=2,afade=t=out:st=181.94:d=3[music];
    [voice][music]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[mix];
    [mix]loudnorm=I=-16:LRA=7:TP=-1.5[aout]
  " \
  -map '[vout]' -map '[aout]' \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart -t 184.94 "$OUTPUT"

ffprobe -v error -show_entries format=duration,size:stream=index,codec_name,width,height,r_frame_rate,sample_rate,channels \
  -of json "$OUTPUT" > "$PACKAGE_DIR/final-media-probe.json"

shasum -a 256 "$OUTPUT" > "$PACKAGE_DIR/final-media-sha256.txt"
