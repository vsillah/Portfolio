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
    [1:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,split=5[p0a][p0b][p0c][p1a][p1b];
    [p0a]trim=start=0:end=14.2,setpts=PTS-STARTPTS,format=yuva420p,fade=t=out:st=13.8:d=0.4:alpha=1[presenter_open_wide];
    [p0b]trim=start=13.8:end=27.2,setpts=PTS-STARTPTS,scale=2112:1188,crop=1920:1080:0:54,format=yuva420p,fade=t=in:st=0:d=0.4:alpha=1,fade=t=out:st=13:d=0.4:alpha=1,setpts=PTS+13.8/TB[presenter_open_medium];
    [p0c]trim=start=26.8:end=41,setpts=PTS-STARTPTS,scale=2016:1134,crop=1920:1080:0:27,format=yuva420p,fade=t=in:st=0:d=0.4:alpha=1,fade=t=out:st=13.85:d=0.35:alpha=1,setpts=PTS+26.8/TB[presenter_open_close];
    [p1a]trim=start=155:end=165.2,setpts=PTS-STARTPTS,scale=2016:1134,crop=1920:1080:0:27,format=yuva420p,fade=t=in:st=0:d=0.35:alpha=1,fade=t=out:st=9.8:d=0.4:alpha=1,setpts=PTS+155/TB[presenter_close_wide];
    [p1b]trim=start=164.8:end=176,setpts=PTS-STARTPTS,scale=2112:1188,crop=1920:1080:0:54,format=yuva420p,fade=t=in:st=0:d=0.4:alpha=1,fade=t=out:st=10.85:d=0.35:alpha=1,setpts=PTS+164.8/TB[presenter_close_medium];
    [0:v][presenter_open_wide]overlay=0:0:eof_action=pass[v1];
    [v1][presenter_open_medium]overlay=0:0:eof_action=pass[v2];
    [v2][presenter_open_close]overlay=0:0:eof_action=pass[v3];
    [v3][presenter_close_wide]overlay=0:0:eof_action=pass[v4];
    [v4][presenter_close_medium]overlay=0:0:eof_action=pass[vout];
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
