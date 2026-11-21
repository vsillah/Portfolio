"""Replace only the L13 69.86-70.34 s PCM window with the L01-derived sample.

Requires numpy 2.5.5, matching the local review environment.
"""

import json
import sys
import wave
from pathlib import Path

import numpy as np

original, sample, target = map(Path, sys.argv[1:4])


def read(path):
    with wave.open(str(path), 'rb') as wav:
        params = wav.getparams()
        audio = np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16)
        audio = audio.reshape(-1, params.nchannels).copy()
    return params, audio


params, audio = read(original)
sample_params, sample_audio = read(sample)
assert params.framerate == sample_params.framerate == 48000
assert params.nchannels == sample_params.nchannels == 2
assert params.sampwidth == sample_params.sampwidth == 2
start = round(69.86 * 48000)
end = round(70.34 * 48000)
frames = end - start
assert len(sample_audio) == frames
shifted = sample_audio.astype(np.float32) * 0.51
original_window = audio[start:end].astype(np.float32)
fade = round(0.012 * 48000)
alpha = np.ones((frames, 1), dtype=np.float32)
alpha[:fade, 0] = np.linspace(0, 1, fade, endpoint=False)
alpha[-fade:, 0] = np.linspace(1, 0, fade, endpoint=False)
audio[start:end] = np.clip(np.rint(original_window * (1 - alpha) + shifted * alpha), -32768, 32767).astype(np.int16)
with wave.open(str(target), 'wb') as wav:
    wav.setparams(params)
    wav.writeframes(audio.tobytes())
print(json.dumps({'sampleRateHz': 48000, 'channels': 2, 'targetSeconds': [69.86, 70.34], 'framesReplaced': frames, 'gain': 0.51, 'crossfadeMs': 12}))
