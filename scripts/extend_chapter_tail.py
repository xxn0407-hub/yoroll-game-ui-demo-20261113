"""Render a low, centred chapter tone with a continuous, quiet decay."""
from pathlib import Path
import hashlib
import json
import math
import struct
import wave

ROOT = Path(__file__).resolve().parents[1]
RATE = 48000
DURATION = 2.8
FUNDAMENTAL = 587.33
PITCH_RATIO = .5
TARGET_RMS_DBFS = -39.33


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


def fit_partials(source):
    # Keep the established source colour, lowering it one octave. A single
    # centred phase avoids the hollow impression of a wide stereo tail.
    start, count = round(.085 * RATE), round(.2 * RATE)
    weights = [.5 - .5 * math.cos(2 * math.pi * i / (count - 1)) for i in range(count)]
    scale = 2 / sum(weights)
    partials = []
    for ratio in [1, 2]:
        frequency = FUNDAMENTAL * ratio
        coefficients = []
        for channel in [0, 1]:
            cosine = sine = 0.
            for i, weight in enumerate(weights):
                phase = 2 * math.pi * frequency * (start + i) / RATE
                value = source[start + i][channel] * weight
                cosine += value * math.cos(phase)
                sine += value * math.sin(phase)
            coefficients.append((cosine * scale, sine * scale))
        colour_gain = 1 if ratio == 1 else .15
        centred = tuple((coefficients[0][i] + coefficients[1][i]) * .5 * colour_gain for i in [0, 1])
        partials.append((frequency * PITCH_RATIO, [centred, centred]))
    return partials


def continuous_tail(source):
    partials = fit_partials(source)
    frames = []
    for index in range(round(DURATION * RATE)):
        time = index / RATE
        envelope = smooth(time / .075) * math.exp(-time / .55)
        envelope *= 1 - smooth((time - 1.75) / 1.05)
        pair = [0., 0.]
        for frequency, coefficients in partials:
            phase = 2 * math.pi * frequency * (time + .085)
            cosine, sine = math.cos(phase), math.sin(phase)
            for channel, (a, b) in enumerate(coefficients):
                pair[channel] += (a * cosine + b * sine) * envelope
        frames.append(tuple(pair))
    rms = math.sqrt(sum(a * a + b * b for a, b in frames) / (len(frames) * 2))
    peak = max(abs(value) for pair in frames for value in pair)
    # A fixed, lower gain keeps the entire tone gentle without compression.
    gain = min(10 ** (TARGET_RMS_DBFS / 20) / rms, .085 / peak)
    frames = [(a * gain, b * gain) for a, b in frames]
    frames[0] = frames[-1] = (0., 0.)
    return frames


def main():
    source_path = ROOT / 'assets/audio/ui-hover.wav'
    source = read_pcm(source_path)
    frames = continuous_tail(source)
    write_pcm(ROOT / 'assets/audio/ui-chapter.wav', frames)
    audition = [[0., 0.] for _ in range(round(3.5 * RATE))]
    for clip, at, level in [(source, .10, .5 * .48), (frames, .37, .5 * .44)]:
        for index, pair in enumerate(clip):
            target = round(at * RATE) + index
            blend = .3 + .7 * math.exp(-max(0, target / RATE - .37) / .09) if clip is source else 1
            for channel in (0, 1):
                audition[target][channel] += pair[channel] * level * blend
    write_pcm(ROOT / 'chapter-sound-preview.wav', audition)
    rms = math.sqrt(sum(a * a + b * b for a, b in frames) / (len(frames) * 2))
    tail = frames[round(1.28 * RATE):round(2.3 * RATE)]
    tail_rms = math.sqrt(sum(a * a + b * b for a, b in tail) / (len(tail) * 2))
    print(json.dumps({'durationSeconds': DURATION,
                      'peak': max(abs(v) for pair in frames for v in pair),
                      'rmsDbfs': round(20 * math.log10(rms), 2),
                      'tailRmsDbfs1280to2300ms': round(20 * math.log10(tail_rms), 2),
                      'sourceSha256': hashlib.sha256(source_path.read_bytes()).hexdigest()}))


if __name__ == '__main__':
    main()
