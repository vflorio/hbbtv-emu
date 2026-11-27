#!/bin/sh
# Makes the broadcast's stand-in the extension ships: assets/broadcast/test-card.mp4,
# named hbbtv-emu:broadcast/test-card.mp4 in the state. ffmpeg's test pattern with a
# timecode, 60 s at 1280x720, VP9 and silent Opus in MP4, which Chromium and Firefox
# both play. A keyframe every 2 s, so the live simulation seeks to where the channel
# is on air without decoding far.
set -eu
cd "$(dirname "$0")/../assets/broadcast"
ffmpeg -v error -y \
  -f lavfi -i "testsrc2=size=1280x720:rate=25:duration=60" \
  -f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=48000" \
  -t 60 \
  -c:v libvpx-vp9 -b:v 200k -g 50 -row-mt 1 -deadline good -cpu-used 4 \
  -c:a libopus -b:a 16k \
  -movflags +faststart \
  test-card.mp4
