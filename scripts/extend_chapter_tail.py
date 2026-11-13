"""Make a close, soft cloth-air cue without a sustained note or room resonance.

Source and CC0 provenance: ../chapter-sound-source.json. Requires ffmpeg.
"""
from pathlib import Path
import array
import hashlib
import json
import math
import shutil
import struct
import subprocess
import sys
import wave

ROOT = Path(__file__).resolve().parents[1]
RATE = 48000
DURATION = 1.2
TARGET_RMS_DBFS = -40.5
SOURCE = ROOT / 'assets/audio/sources/Clothes Shaking Movement 6_18.mp3'


def read_pcm(path):
    with wave.open(str(path), 'rb') as source:
        assert (source.getframerate(), source.getnchannels(), source.getsampwidth()) == (RATE, 2, 2)
        return [(a / 32768, b / 32768) for a, b in struct.iter_unpack('<hh', source.readframes(source.getnframes()))]


def write_pcm(path, frames):
    with wave.open(str(path), 'wb') as target:
        target.setnchannels(2)
        target.setsampwidth(2)
        target.setframerate(RATE)
        target.writeframes(b''.join(struct.pack('<hh', round(a * 32767), round(b * 32767)) for a, b in frames))


def smooth(value):
    v = max(0, min(1, value))
    return v ** 3 * (10 + v * (-15 + v * 6))


def read_foley(path):
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        raise RuntimeError('ffmpeg is required to decode the licensed source MP3.')
    result = subprocess.run([ffmpeg, '-v', 'error', '-i', str(path), '-ar', str(RATE),
                             '-ac', '1', '-f', 'f32le', '-'], capture_output=True, check=True)
    samples = array.array('f', result.stdout)
    if sys.byteorder != 'little':
        samples.byteswap()
    return samples


def lowpass(samples, frequency):
    # One-pole filters have no resonant frequency peak or ringing feedback loop.
    coefficient = 1 - math.exp(-2 * math.pi * frequency / RATE)
    previous = 0.
    result = []
    for sample in samples:
        previous += coefficient * (sample - previous)
        result.append(previous)
    return result


def close_air(source):
    samples = []
    for index in range(round(DURATION * RATE)):
        position = index * .5
        before = int(position)
        if before + 1 < len(source):
            blend = position - before
            samples.append(source[before] * (1 - blend) + source[before + 1] * blend)
        else:
            samples.append(0.)
    low = lowpass(samples, 180)
    samples = [a - b for a, b in zip(samples, low)]
    samples = lowpass(lowpass(samples, 1600), 1600)
    ending = min(DURATION - .1, (len(source) - 1) * 2 / RATE)
    assert ending > .4
    frames = []
    for index, sample in enumerate(samples):
        time = index / RATE
        envelope = smooth(time / .075) * (1 - smooth((time - .27) / (ending - .27)))
        frames.append((sample * envelope, sample * envelope))
    # Round off isolated cloth crackles without an envelope-following compressor
    # or delayed signal: the texture stays dry, quiet and free of pumping.
    raw_rms = math.sqrt(sum(a * a for a, _ in frames) / len(frames))
    knee = max(raw_rms * 1.8, 1e-9)
    rounded = lowpass([knee * math.tanh(a / knee) for a, _ in frames], 1600)
    frames = [(sample, sample) for sample in rounded]
    rms = math.sqrt(sum(a * a + b * b for a, b in frames) / (len(frames) * 2))
    peak = max(abs(value) for pair in frames for value in pair)
    gain = min(10 ** (TARGET_RMS_DBFS / 20) / rms, .035 / peak)
    frames = [(a * gain, b * gain) for a, b in frames]
    frames[0] = frames[-1] = (0., 0.)
    return frames


def main():
    source_path = ROOT / 'assets/audio/ui-hover.wav'
    source = read_pcm(source_path)
    frames = close_air(read_foley(SOURCE))
    write_pcm(ROOT / 'assets/audio/ui-chapter.wav', frames)
    audition = [[0., 0.] for _ in range(round(1.8 * RATE))]
    for clip, at, level in [(source, .10, .5 * .48), (frames, .37, .5 * .44)]:
        for index, pair in enumerate(clip):
            target = round(at * RATE) + index
            blend = max(0, 1 - max(0, target / RATE - .37) / .12) if clip is source else 1
            for channel in (0, 1):
                audition[target][channel] += pair[channel] * level * blend
    write_pcm(ROOT / 'chapter-sound-preview.wav', audition)
    rms = math.sqrt(sum(a * a + b * b for a, b in frames) / (len(frames) * 2))
    tail = frames[round(.55 * RATE):round(.95 * RATE)]
    tail_rms = math.sqrt(sum(a * a + b * b for a, b in tail) / (len(tail) * 2))
    print(json.dumps({'durationSeconds': DURATION,
                      'peak': max(abs(v) for pair in frames for v in pair),
                      'rmsDbfs': round(20 * math.log10(rms), 2),
                      'tailRmsDbfs550to950ms': round(20 * math.log10(tail_rms), 2),
                      'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest()}))


if __name__ == '__main__':
    main()
