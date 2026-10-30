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
    [1:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,split=8[p0][p1][p2][p3][p4][p5][p6][p7];
    [p0]trim=start=0:end=4.5,setpts=PTS-STARTPTS,format=yuva420p,fade=t=out:st=4.15:d=0.35:alpha=1[presenter0];
    [p1]trim=start=8.5:end=13.5,setpts=PTS-STARTPTS,scale=2016:1134,crop=1920:1080:0:27,format=yuva420p,fade=t=in:st=0:d=0.35:alpha=1,fade=t=out:st=4.65:d=0.35:alpha=1,setpts=PTS+8.5/TB[presenter1];
    [p2]trim=start=17.5:end=23.5,setpts=PTS-STARTPTS,scale=2112:1188,crop=1920:1080:0:54,format=yuva420p,fade=t=in:st=0:d=0.35:alpha=1,fade=t=out:st=5.65:d=0.35:alpha=1,setpts=PTS+17.5/TB[presenter2];
    [p3]trim=start=27.5:end=33.5,setpts=PTS-STARTPTS,scale=2016:1134,crop=1920:1080:0:27,format=yuva420p,fade=t=in:st=0:d=0.35:alpha=1,fade=t=out:st=5.65:d=0.35:alpha=1,setpts=PTS+27.5/TB[presenter3];
    [p4]trim=start=90:end=96,setpts=PTS-STARTPTS,scale=2112:1188,crop=1920:1080:0:54,format=yuva420p,fade=t=in:st=0:d=0.35:alpha=1,fade=t=out:st=5.65:d=0.35:alpha=1,setpts=PTS+90/TB[presenter4];
    [p5]trim=start=118:end=123,setpts=PTS-STARTPTS,scale=2016:1134,crop=1920:1080:0:27,format=yuva420p,fade=t=in:st=0:d=0.35:alpha=1,fade=t=out:st=4.65:d=0.35:alpha=1,setpts=PTS+118/TB[presenter5];
    [p6]trim=start=155:end=159.5,setpts=PTS-STARTPTS,scale=2112:1188,crop=1920:1080:0:54,format=yuva420p,fade=t=in:st=0:d=0.35:alpha=1,fade=t=out:st=4.15:d=0.35:alpha=1,setpts=PTS+155/TB[presenter6];
    [p7]trim=start=164:end=170.5,setpts=PTS-STARTPTS,scale=2016:1134,crop=1920:1080:0:27,format=yuva420p,fade=t=in:st=0:d=0.35:alpha=1,fade=t=out:st=6.15:d=0.35:alpha=1,setpts=PTS+164/TB[presenter7];
    [0:v][presenter0]overlay=0:0:eof_action=pass[v1];
    [v1][presenter1]overlay=0:0:eof_action=pass[v2];
    [v2][presenter2]overlay=0:0:eof_action=pass[v3];
    [v3][presenter3]overlay=0:0:eof_action=pass[v4];
    [v4][presenter4]overlay=0:0:eof_action=pass[v5];
    [v5][presenter5]overlay=0:0:eof_action=pass[v6];
    [v6][presenter6]overlay=0:0:eof_action=pass[v7];
    [v7][presenter7]overlay=0:0:eof_action=pass[vout];
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
