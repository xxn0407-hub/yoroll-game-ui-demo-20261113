"""Render a softer chapter cue from the existing hover, without new notes or noise."""
from pathlib import Path
import hashlib
import json
import math
import struct
import wave

ROOT = Path(__file__).resolve().parents[1]
RATE = 48000
DURATION = 2.8


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


def lowpass(values, cutoff):
    omega = 2 * math.pi * cutoff / RATE
    cosine, alpha = math.cos(omega), math.sin(omega) / math.sqrt(2)
    a0 = 1 + alpha
    b0 = (1 - cosine) / (2 * a0)
    b1, b2 = 2 * b0, b0
    a1, a2 = -2 * cosine / a0, (1 - alpha) / a0
    x1 = x2 = y1 = y2 = 0
    result = []
    for value in values:
        out = b0 * value + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        result.append(out)
        x2, x1, y2, y1 = x1, value, y1, out
    return result


def diffuse_tail(dry):
    # An orthogonal eight-line feedback network produces a dense, decaying room.
    # The reflections feed one another rather than repeating a recorded segment.
    delays = [1499, 1601, 1747, 1877, 1999, 2137, 2281, 2441]
    buffers = [[0.] * delay for delay in delays]
    positions, damped = [0] * 8, [0.] * 8
    feedback = [10 ** (-3 * delay / RATE / 4.2) for delay in delays]
    damping = 1 - math.exp(-2 * math.pi * 4000 / RATE)
    left_signs = [1, 1, -1, 1, -1, -1, 1, 1]
    right_signs = [1, -1, 1, 1, 1, -1, -1, 1]
    result = []
    for index in range(len(dry)):
        incoming = dry[index - 720] if index >= 720 else (0., 0.)
        taps = [buffers[j][positions[j]] for j in range(8)]
        result.append((sum(a * b for a, b in zip(taps, left_signs)) / math.sqrt(8),
                       sum(a * b for a, b in zip(taps, right_signs)) / math.sqrt(8)))
        for j in range(8):
            damped[j] += damping * (taps[j] - damped[j])
        mixed = damped.copy()
        for step in [1, 2, 4]:
            for start in range(0, 8, step * 2):
                for j in range(start, start + step):
                    a, b = mixed[j], mixed[j + step]
                    mixed[j], mixed[j + step] = a + b, a - b
        injections = [incoming[0], incoming[1], -incoming[0], incoming[1],
                      incoming[0], -incoming[1], incoming[0], incoming[1]]
        for j in range(8):
            buffers[j][positions[j]] = injections[j] * .35 + mixed[j] / math.sqrt(8) * feedback[j]
            positions[j] = (positions[j] + 1) % delays[j]
    return result


def main():
    source_path = ROOT / 'assets/audio/ui-hover.wav'
    source = read_pcm(source_path)
    offset = round(.085 * RATE)
    body = []
    for index in range(round(DURATION * RATE)):
        source_index = index + offset
        left, right = source[source_index] if source_index < len(source) else (0., 0.)
        for delay, gain in [(.023, .19), (.041, .13), (.067, .09), (.103, .055)]:
            reflected = source_index - round(delay * RATE)
            if offset <= reflected < len(source):
                a, b = source[reflected]
                left, right = left + b * gain, right + a * gain
        envelope = smooth(index / RATE / .075) * (1 - smooth((index / RATE - .16) / 1.12))
        body.append((left * envelope, right * envelope))
    channels = [lowpass([frame[channel] for frame in body], 2000) for channel in (0, 1)]
    dry = list(zip(*channels))
    room = diffuse_tail(dry)
    frames = []
    for index, ((a, b), (wet_a, wet_b)) in enumerate(zip(dry, room)):
        ending = 1 - smooth((index / RATE - 1.9) / .9)
        frames.append(((a * .78 + wet_a * 1.35) * ending, (b * .78 + wet_b * 1.35) * ending))
    gain = .145 / max(abs(value) for pair in frames for value in pair)
    frames = [(a * gain, b * gain) for a, b in frames]
    frames[0] = frames[-1] = (0., 0.)
    write_pcm(ROOT / 'assets/audio/ui-chapter.wav', frames)
    audition = [[0., 0.] for _ in range(round(3.5 * RATE))]
    for clip, at, level in [(source, .10, .5 * .48), (frames, .37, .5 * .44)]:
        for index, pair in enumerate(clip):
            target = round(at * RATE) + index
            blend = .6 + .4 * math.exp(-max(0, target / RATE - .37) / .09) if clip is source else 1
            for channel in (0, 1):
                audition[target][channel] += pair[channel] * level * blend
    write_pcm(ROOT / 'chapter-sound-preview.wav', audition)
    rms = math.sqrt(sum(a * a + b * b for a, b in frames) / (len(frames) * 2))
    tail = frames[round(1.28 * RATE):round(2.3 * RATE)]
    tail_rms = math.sqrt(sum(a * a + b * b for a, b in tail) / (len(tail) * 2))
    print(json.dumps({'durationSeconds': DURATION, 'peak': .145,
                      'rmsDbfs': round(20 * math.log10(rms), 2),
                      'tailRmsDbfs1280to2300ms': round(20 * math.log10(tail_rms), 2),
                      'sourceSha256': hashlib.sha256(source_path.read_bytes()).hexdigest()}))


if __name__ == '__main__':
    main()
