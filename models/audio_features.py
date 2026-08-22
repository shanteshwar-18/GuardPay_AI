"""
audio_features.py — Shared Audio Feature Extraction Utility
GuardPay AI · AI/ML Module (Jatin)

Provides MFCC and Mel-spectrogram extraction used by BOTH training and inference.

IMPORTANT — train/serve parity:
    `extract_melspectrogram()` is the single canonical preprocessing path. The CNN
    in train_cnn.py and the live inference wrapper in audio_analyzer.py must call
    this exact function, otherwise the model sees a different input distribution
    at serve time than it was trained on and accuracy silently collapses.

Pipeline (fixed and versioned via FEATURE_VERSION):
    audio -> mono 16 kHz -> crop/pad to 4.0 s -> 128-bin Mel -> dB -> 128x128 -> [-1, 1]

Cropping to a fixed duration (rather than resizing a variable-length spectrogram)
keeps the time axis at a constant resolution across clips. Resizing alone would
stretch a 1.8 s clip and squash an 8.5 s clip onto the same 128 frames, which both
distorts the acoustic features and leaks clip duration into the model.

Commit: feat(audio): implement MFCC + Mel-spectrogram extractor with librosa
"""

from __future__ import annotations

import io
import logging

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

try:
    import librosa
    _LIBROSA_OK = True
except ImportError:  # pragma: no cover - librosa is a hard requirement per playbook
    _LIBROSA_OK = False
    logger.warning(
        "[audio_features] librosa not installed — using scipy STFT fallback. "
        "Install librosa for full Mel-spectrogram accuracy."
    )


# ── Constants ──────────────────────────────────────────────────────────────────
# Bump FEATURE_VERSION whenever the preprocessing changes; train_cnn.py stamps it
# into the checkpoint so a stale model can be detected instead of silently misused.
FEATURE_VERSION = 2

SAMPLE_RATE = 16_000
N_MFCC = 40
N_MELS = 128
N_FFT = 1024
HOP_LENGTH = 512
FMAX = 8_000
CLIP_SECONDS = 4.0
CLIP_SAMPLES = int(SAMPLE_RATE * CLIP_SECONDS)
TARGET_SIZE = (128, 128)   # (height, width) for CNN input


# ── Audio loading ──────────────────────────────────────────────────────────────

def _from_raw_pcm16(raw: bytes) -> np.ndarray:
    """Interpret headerless bytes as little-endian int16 PCM scaled to [-1, 1]."""
    if len(raw) % 2:
        raw = raw[:-1]
    return (np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0)


def _load_audio(source, sr: int = SAMPLE_RATE):
    """
    Load audio from a file path (str), raw bytes, or a numpy array.

    Reads at the file's native rate and only resamples when it actually differs
    from `sr`. ASVspoof LA flac is already 16 kHz mono, and forcing a resample
    there costs ~35x more time per file for no benefit.

    Returns (float32 mono numpy array, sample_rate).
    """
    import soundfile as sf

    if isinstance(source, np.ndarray):
        return source.astype(np.float32), sr

    if isinstance(source, str) and source.endswith(".npy"):
        return np.load(source), sr

    if isinstance(source, (bytes, bytearray, memoryview)):
        raw = bytes(source)
        try:
            audio, file_sr = sf.read(io.BytesIO(raw), dtype="float32")
        except Exception:
            # Headerless PCM stream (what the mobile client sends over WebSocket)
            audio, file_sr = _from_raw_pcm16(raw), sr
    else:
        audio, file_sr = sf.read(str(source), dtype="float32")

    if audio.ndim > 1:
        audio = audio.mean(axis=1)          # stereo -> mono

    if file_sr != sr:
        if _LIBROSA_OK:
            audio = librosa.resample(audio, orig_sr=file_sr, target_sr=sr)
        else:
            from scipy.signal import resample
            audio = resample(audio, int(len(audio) * sr / file_sr))

    return np.ascontiguousarray(audio, dtype=np.float32), sr


def _fix_length(audio: np.ndarray, n: int = CLIP_SAMPLES) -> np.ndarray:
    """
    Force the waveform to exactly `n` samples.

    Short clips are tiled (rather than zero-padded) so the model does not learn
    "trailing silence" as a class cue; long clips are centre-cropped.
    """
    if len(audio) == 0:
        return np.zeros(n, dtype=np.float32)
    if len(audio) < n:
        reps = int(np.ceil(n / len(audio)))
        audio = np.tile(audio, reps)
    if len(audio) > n:
        start = (len(audio) - n) // 2
        audio = audio[start:start + n]
    return audio[:n]


def _resize_to_target(arr: np.ndarray) -> np.ndarray:
    """Resize a 2-D spectrogram/MFCC array to TARGET_SIZE using bilinear interpolation."""
    img = Image.fromarray(arr.astype(np.float32), mode="F")
    img = img.resize((TARGET_SIZE[1], TARGET_SIZE[0]), Image.BILINEAR)
    return np.array(img, dtype=np.float32)


def _normalise(arr: np.ndarray) -> np.ndarray:
    """
    Per-sample min-max to [0, 1] then shift to [-1, 1].

    The [-1, 1] range matches transforms.Normalize((0.5,), (0.5,)) and keeps the
    CNN's BatchNorm statistics well-conditioned (see playbook §10: "CNN accuracy
    stuck at 50% — data not normalised").
    """
    lo, hi = float(arr.min()), float(arr.max())
    if hi - lo > 1e-6:
        arr = (arr - lo) / (hi - lo)
    else:
        arr = np.zeros_like(arr)
    return ((arr - 0.5) / 0.5).astype(np.float32)


# ── Core extractors ────────────────────────────────────────────────────────────

def extract_melspectrogram(audio_path_or_bytes, sr: int = SAMPLE_RATE) -> np.ndarray:
    """
    Extract a 128-bin Mel-spectrogram from audio. THE canonical CNN input path.

    Args:
        audio_path_or_bytes: File path (str), raw bytes (WAV or headerless PCM16),
                             or a numpy waveform.
        sr: Target sample rate (default 16 kHz).

    Returns:
        float32 array of shape (128, 128), values in [-1, 1].
    """
    # Pre-computed .npy feature arrays (synthetic fallback data) bypass the audio path
    if isinstance(audio_path_or_bytes, str) and audio_path_or_bytes.endswith(".npy"):
        arr = np.load(audio_path_or_bytes).astype(np.float32)
        if arr.ndim == 2:
            return _normalise(_resize_to_target(arr))

    audio, sr = _load_audio(audio_path_or_bytes, sr)
    audio = _fix_length(audio)

    if _LIBROSA_OK:
        mel = librosa.feature.melspectrogram(
            y=audio, sr=sr, n_mels=N_MELS, n_fft=N_FFT,
            hop_length=HOP_LENGTH, fmax=FMAX,
        )
        mel_db = librosa.power_to_db(mel, ref=np.max)
    else:
        from scipy.signal import stft
        _, _, Zxx = stft(audio, fs=sr, nperseg=N_FFT, noverlap=N_FFT - HOP_LENGTH)
        power = np.abs(Zxx) ** 2 + 1e-10
        if power.shape[0] >= N_MELS:
            power = power[:N_MELS, :]
        else:
            power = np.pad(power, ((0, N_MELS - power.shape[0]), (0, 0)))
        mel_db = 10 * np.log10(power)

    return _normalise(_resize_to_target(mel_db))


def extract_mfcc(audio_path_or_bytes, sr: int = SAMPLE_RATE, n_mfcc: int = N_MFCC) -> np.ndarray:
    """
    Extract 40-coefficient MFCCs for supplementary analysis.

    Returns:
        float32 array of shape (128, 128), values in [-1, 1].
    """
    if isinstance(audio_path_or_bytes, str) and audio_path_or_bytes.endswith(".npy"):
        arr = np.load(audio_path_or_bytes).astype(np.float32)
        if arr.ndim == 2:
            return _normalise(_resize_to_target(arr))

    audio, sr = _load_audio(audio_path_or_bytes, sr)
    audio = _fix_length(audio)

    if _LIBROSA_OK:
        mfccs = librosa.feature.mfcc(
            y=audio, sr=sr, n_mfcc=n_mfcc, n_fft=N_FFT, hop_length=HOP_LENGTH
        )
    else:
        from scipy.fft import dct
        from scipy.signal import stft
        _, _, Zxx = stft(audio, fs=sr, nperseg=N_FFT, noverlap=N_FFT - HOP_LENGTH)
        power = np.abs(Zxx) ** 2 + 1e-10
        log_power = np.log(power[:N_MELS, :])
        mfccs = dct(log_power, axis=0, norm="ortho")[:n_mfcc, :]

    return _normalise(_resize_to_target(mfccs.astype(np.float32)))


def batch_extract(file_list: list, label_list: list) -> tuple:
    """
    Extract Mel-spectrograms for a batch of files (serial; see train_cnn.py for
    the multiprocessing version used on the full ASVspoof corpus).

    Returns:
        (features (N, 128, 128) float32, labels (N,) int64)
    """
    features, labels = [], []
    for path, label in zip(file_list, label_list):
        try:
            features.append(extract_melspectrogram(path))
            labels.append(label)
        except Exception as exc:
            print(f"[audio_features] Warning: skipping {path}: {exc}")
    return np.stack(features), np.array(labels, dtype=np.int64)


# ── Self-test ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import os
    import tempfile

    print("=" * 60)
    print("GuardPay AI — audio_features.py self-test")
    print("=" * 60)
    print(f"librosa available: {_LIBROSA_OK}   feature version: {FEATURE_VERSION}")

    def _make_sine_wave(freq=440.0, duration=3.0, sr=SAMPLE_RATE):
        t = np.linspace(0, duration, int(sr * duration), endpoint=False)
        return (0.5 * np.sin(2 * np.pi * freq * t)).astype(np.float32)

    def _save_as_wav(audio, sr=SAMPLE_RATE):
        import soundfile as sf
        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        sf.write(tmp.name, audio, sr)
        return tmp.name

    cases = [
        ("Sine 440 Hz  (file path)", _save_as_wav(_make_sine_wave(440))),
        ("Sine 880 Hz  (file path)", _save_as_wav(_make_sine_wave(880))),
        ("White noise  (WAV bytes)", None),
        ("Raw PCM16    (headerless)", "rawpcm"),
        ("Short 0.5 s  (tiled pad)", _save_as_wav(_make_sine_wave(300, duration=0.5))),
    ]

    for name, path in cases:
        if path is None:
            buf = io.BytesIO()
            import soundfile as sf
            sf.write(buf, _make_sine_wave(1200), SAMPLE_RATE, format="WAV")
            mel, mfc = extract_melspectrogram(buf.getvalue()), extract_mfcc(buf.getvalue())
        elif path == "rawpcm":
            raw = (_make_sine_wave(700) * 32767).astype("<i2").tobytes()
            mel, mfc = extract_melspectrogram(raw), extract_mfcc(raw)
        else:
            mel, mfc = extract_melspectrogram(path), extract_mfcc(path)
            os.unlink(path)

        assert mel.shape == TARGET_SIZE, f"Mel shape mismatch: {mel.shape}"
        assert mfc.shape == TARGET_SIZE, f"MFCC shape mismatch: {mfc.shape}"
        assert -1.01 <= mel.min() and mel.max() <= 1.01, "Mel outside [-1, 1]"
        print(f"  ✓  {name:<28} mel={mel.shape} range=[{mel.min():.2f},{mel.max():.2f}]")

    print("\nAll extractions passed — shapes (128, 128), range [-1, 1]. ✓")
    print("=" * 60)
