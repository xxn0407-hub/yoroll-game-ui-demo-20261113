"""Derive the gameplay palette from the approved Yoroll UI masters, never test media.

Requires ffmpeg. No oscillators, new noise, echo, reverb, music loop or paid service.
Run from any directory: python3 tools/build-gameplay-audio.py
"""
from array import array
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
import tempfile
import wave

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'playtests/assets/audio'
REVISION = 'ethereal-gameplay-20261116'
# name, approved master, start, end, playback ratio, duration, low pass, peak, attack, release
PLAN = [
    ('start', 'home-opening', 5.05, 7.25, .94, 2.2, 1800, .12, .09, .85),
    ('focus', 'ui-hover', .05, .90, .90, .90, 1100, .09, .055, .45),
    ('tap', 'ui-select', 0, .40, .82, .38, 1300, .10, .018, .22),
    ('hold', 'ui-hover', .04, .90, .76, .98, 1050, .10, .09, .55),
    ('release', 'ui-select', .05, .44, .68, .48, 900, .065, .025, .32),
    ('swipe', 'ui-transition', .12, 1.1, .90, 1.0, 1400, .095, .07, .6),
    ('trace', 'ui-open', .12, .95, .82, .85, 1100, .075, .08, .5),
    ('reveal', 'home-opening', 6.05, 8.0, .98, 1.8, 1700, .105, .11, 1.05),
    ('item', 'ui-chapter', 0, 1.15, .90, 1.2, 1250, .095, .07, .7),
    ('combine', 'home-opening', 5.35, 8.35, 1.0, 2.7, 1700, .12, .12, 1.4),
    ('turn', 'ui-back', .04, .80, .80, .85, 1050, .085, .04, .52),
    ('place', 'ui-select', 0, .45, .65, .52, 1000, .095, .025, .3),
    ('invalid', 'ui-hover', .02, .88, .45, 1.35, 800, .08, .1, .85),
    ('rhythm-hit', 'ui-select', 0, .26, .78, .28, 1100, .085, .012, .18),
    ('rhythm-miss', 'ui-select', .03, .33, .58, .40, 650, .045, .03, .25),
    ('success', 'ui-success', 0, 4.64, 1.0, 4.64, 1900, .145, .09, 1.25),
    ('failure', 'ui-gameover', .12, 3.7, .93, 3.6, 1100, .115, .14, 1.25),
    # A single fading tail for the image/audio timing example. Keep its 12s
    # timeline, including silence after the tail, without repeating the opening.
    ('image-audio', 'home-opening', 5.05, 10.0, 1.0, 12.0, 1600, .095, .13, 1.8),
]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def render(row):
    name, master, start, end, ratio, duration, cutoff, peak, attack, release = row
    source = ROOT / 'assets/audio' / (master + '.wav')
    active = min(duration, (end - start) / ratio)
    filters = ','.join([
        f'atrim=start={start}:end={end}', 'asetpts=PTS-STARTPTS',
        f'asetrate={round(48000 * ratio)}', 'aresample=48000',
        'highpass=f=38', f'lowpass=f={cutoff}:p=2',
        f'atrim=duration={active}', f'afade=t=in:d={attack}',
        f'afade=t=out:st={max(attack, active-release)}:d={release}',
        f'apad=whole_dur={duration}', f'atrim=duration={duration}',
    ])
    with tempfile.TemporaryDirectory() as temp:
        raw = Path(temp) / 'cue.wav'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(source),
                        '-af', filters, '-ar', '48000', '-ac', '2',
                        '-c:a', 'pcm_s16le', str(raw)], check=True)
        with wave.open(str(raw)) as audio:
            samples = array('h', audio.readframes(audio.getnframes()))
        if sys.byteorder != 'little':
            samples.byteswap()
    maximum = max(abs(s) for s in samples) or 1
    scale = peak * 32767 / maximum
    # Dense actions should not become loud hiss even if the source is diffuse.
    rms = math.sqrt(sum(s*s for s in samples) / len(samples)) / 32768
    scale = min(scale, 10 ** (-34 / 20) / rms) if name in {
        'tap', 'trace', 'place', 'rhythm-hit', 'rhythm-miss'
    } else scale
    samples = array('h', (round(s * scale) for s in samples))
    samples[0] = samples[1] = samples[-1] = samples[-2] = 0
    output = DEST / (name + '.wav')
    encoded = array('h', samples)
    if sys.byteorder != 'little':
        encoded.byteswap()
    with wave.open(str(output), 'wb') as audio:
        audio.setnchannels(2)
        audio.setsampwidth(2)
        audio.setframerate(48000)
        audio.writeframes(encoded.tobytes())
    rms = math.sqrt(sum(s*s for s in samples) / len(samples)) / 32768
    return {
        'file': 'assets/audio/' + name + '.wav', 'sha256': digest(output),
        'source': 'assets/audio/' + master + '.wav', 'sourceSha256': digest(source),
        'sourceRangeSeconds': [start, end], 'playbackRatio': ratio,
        'durationSeconds': len(samples) / 96000, 'lowPassHz': cutoff,
        'attackSeconds': attack, 'releaseSeconds': release,
        'peak': round(max(abs(s) for s in samples) / 32768, 5),
        'rmsDbfs': round(20 * math.log10(max(rms, 1e-12)), 2),
        'boundarySamples': [0, 0],
    }


if __name__ == '__main__':
    DEST.mkdir(parents=True, exist_ok=True)
    spec = {
        'revision': REVISION,
        'format': '48000 Hz stereo 16-bit PCM WAV', 'sharedMixGain': .5,
        'character': 'Soft low resonance, restrained air, continuous natural decay.',
        'sourcePolicy': 'Only approved local Yoroll masters. No original test-link audio.',
        'processing': 'Trim, lower pitch where needed, low pass and zero-ended fades. No added delay, reverb, drums or loops.',
        'assets': {row[0]: render(row) for row in PLAN},
    }
    (DEST / 'manifest.json').write_text(json.dumps(spec, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'revision': REVISION, 'assets': len(spec['assets']),
                      'bytes': sum(p.stat().st_size for p in DEST.glob('*.wav'))}))
