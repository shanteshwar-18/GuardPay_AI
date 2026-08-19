"""
audio_features.py — Shared Audio Feature Extraction Utility
GuardPay AI · AI/ML Module (Jatin)

Provides MFCC and Mel-spectrogram extraction used by both training and inference.
Handles both real ASVspoof .flac files and synthetic .npy fallback transparently.

Librosa is used when available; falls back to scipy STFT when librosa/numba
are not yet installed (e.g. llvmlite still downloading).

Commit: feat(audio): implement MFCC + Mel-spectrogram extractor with librosa
"""

import io
import logging
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

try:
    import librosa
    _LIBROSA_OK = True
except ImportError:
    _LIBROSA_OK = False
    logger.warning(
        "[audio_features] librosa not installed — using scipy STFT fallback. "
        "Install librosa for full Mel-spectrogram accuracy."
    )


# ── Constants ──────────────────────────────────────────────────────────────────
SAMPLE_RATE = 16_000
N_MFCC = 40
N_MELS = 128
TARGET_SIZE = (128, 128)   # (height, width) for CNN input


# ── Core extractors ────────────────────────────────────────────────────────────

def _load_audio(source, sr: int = SAMPLE_RATE):
    """
    Load audio from a file path (str) or raw bytes.
    Supports: .flac, .wav, .mp3 via librosa, and .npy arrays directly.
    Returns (numpy array, sample_rate).
    """
    if isinstance(source, (str,)) and source.endswith(".npy"):
        # Pre-computed numpy feature array — return as-is
        return np.load(source), sr
    if isinstance(source, np.ndarray):
        return source, sr
    if isinstance(source, bytes):
        # Raw audio bytes — write to in-memory buffer and load with soundfile
        import soundfile as sf
        buf = io.BytesIO(source)
        audio, file_sr = sf.read(buf)
        if audio.ndim > 1:
            audio = audio.mean(axis=1)  # stereo -> mono
        if file_sr != sr:
            if _LIBROSA_OK:
                audio = librosa.resample(audio, orig_sr=file_sr, target_sr=sr)
            else:
                # Simple scipy resample fallback
                from scipy.signal import resample
                n_samples = int(len(audio) * sr / file_sr)
                audio = resample(audio, n_samples)
        return audio.astype(np.float32), sr
    if _LIBROSA_OK:
        # File path — use librosa.load with explicit sr to avoid version mismatch
        audio, _ = librosa.load(source, sr=sr, mono=True)
        return audio, sr
    # Fallback: soundfile
    import soundfile as sf
    audio, file_sr = sf.read(str(source))
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    return audio.astype(np.float32), sr


def _resize_to_target(arr: np.ndarray) -> np.ndarray:
    """Resize a 2-D spectrogram/MFCC array to TARGET_SIZE using bilinear interpolation."""
    img = Image.fromarray(arr)
    img = img.resize((TARGET_SIZE[1], TARGET_SIZE[0]), Image.BILINEAR)
    return np.array(img, dtype=np.float32)


def extract_melspectrogram(
    audio_path_or_bytes,
    sr: int = SAMPLE_RATE,
) -> np.ndarray:
    """
    Extract a 128-bin Mel-spectrogram from audio.

    Args:
        audio_path_or_bytes: File path (str), raw bytes, or numpy array.
        sr: Target sample rate (default 16 kHz).

    Returns:
        Normalised float32 numpy array of shape (128, 128).
    """
    # Handle pre-computed .npy feature arrays
    if isinstance(audio_path_or_bytes, str) and audio_path_or_bytes.endswith(".npy"):
        arr = np.load(audio_path_or_bytes).astype(np.float32)
        # Already a spectrogram — just resize
        if arr.ndim == 2:
            return _resize_to_target(arr)

    audio, sr = _load_audio(audio_path_or_bytes, sr)

    if _LIBROSA_OK:
        mel_spec = librosa.feature.melspectrogram(
            y=audio, sr=sr, n_mels=N_MELS, fmax=8_000
        )
        mel_db = librosa.power_to_db(mel_spec, ref=np.max)
    else:
        # scipy STFT fallback — computes log-power spectrogram, resized to 128 bins
        from scipy.signal import stft
        _, _, Zxx = stft(audio, fs=sr, nperseg=512, noverlap=384)
        power = np.abs(Zxx) ** 2 + 1e-10
        mel_db = 10 * np.log10(power[:N_MELS, :] if power.shape[0] >= N_MELS
                               else np.pad(power, ((0, N_MELS - power.shape[0]), (0, 0))))

    # Resize to exactly 128×128
    resized = _resize_to_target(mel_db)

    # Normalise to [0, 1]
    arr_min, arr_max = resized.min(), resized.max()
    if arr_max - arr_min > 1e-6:
        resized = (resized - arr_min) / (arr_max - arr_min)
    return resized.astype(np.float32)


def extract_mfcc(
    audio_path_or_bytes,
    sr: int = SAMPLE_RATE,
    n_mfcc: int = N_MFCC,
) -> np.ndarray:
    """
    Extract 40-coefficient MFCCs for supplementary analysis.

    Args:
        audio_path_or_bytes: File path, raw bytes, or numpy array.
        sr: Target sample rate.
        n_mfcc: Number of MFCC coefficients.

    Returns:
        Normalised float32 array of shape (128, 128).
    """
    if isinstance(audio_path_or_bytes, str) and audio_path_or_bytes.endswith(".npy"):
        arr = np.load(audio_path_or_bytes).astype(np.float32)
        if arr.ndim == 2:
            return _resize_to_target(arr)

    audio, sr = _load_audio(audio_path_or_bytes, sr)

    if _LIBROSA_OK:
        mfccs = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=n_mfcc)   # (n_mfcc, T)
    else:
        # scipy DCT-based MFCC fallback
        from scipy.fft import dct
        from scipy.signal import stft
        _, _, Zxx = stft(audio, fs=sr, nperseg=512, noverlap=384)
        power = np.abs(Zxx) ** 2 + 1e-10
        log_power = np.log(power[:40, :] if power.shape[0] >= 40
                          else np.pad(power, ((0, 40 - power.shape[0]), (0, 0))))
        mfccs = dct(log_power, axis=0, norm='ortho')[:n_mfcc, :]
    resized = _resize_to_target(mfccs.astype(np.float32))

    # Normalise
    arr_min, arr_max = resized.min(), resized.max()
    if arr_max - arr_min > 1e-6:
        resized = (resized - arr_min) / (arr_max - arr_min)
    return resized.astype(np.float32)


def batch_extract(
    file_list: list,
    label_list: list,
) -> tuple:
    """
    Extract Mel-spectrograms for a batch of files.

    Args:
        file_list:  List of file paths or bytes objects.
        label_list: Corresponding integer labels (0=bonafide, 1=spoof).

    Returns:
        Tuple of (features np.ndarray shape (N, 128, 128), labels np.ndarray shape (N,)).
    """
    features, labels = [], []
    for path, label in zip(file_list, label_list):
        try:
            feat = extract_melspectrogram(path)
            features.append(feat)
            labels.append(label)
        except Exception as exc:
            print(f"[audio_features] Warning: skipping {path}: {exc}")
    return np.stack(features), np.array(labels, dtype=np.int64)


# ── Self-test ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import os, tempfile

    print("=" * 60)
    print("GuardPay AI — audio_features.py self-test")
    print("=" * 60)

    # Generate three synthetic 3-second audio clips and test both code paths

    def _make_sine_wave(freq: float = 440.0, duration: float = 3.0, sr: int = SAMPLE_RATE) -> np.ndarray:
        t = np.linspace(0, duration, int(sr * duration), endpoint=False)
        return (0.5 * np.sin(2 * np.pi * freq * t)).astype(np.float32)

    def _save_as_wav(audio: np.ndarray, sr: int = SAMPLE_RATE) -> str:
        import soundfile as sf
        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        sf.write(tmp.name, audio, sr)
        return tmp.name

    samples = [
        ("Sine 440 Hz  (file path)", _save_as_wav(_make_sine_wave(440))),
        ("Sine 880 Hz  (file path)", _save_as_wav(_make_sine_wave(880))),
        ("White noise  (bytes input)", None),   # will use bytes path
    ]

    for name, path in samples:
        if path is None:
            # Test bytes path
            audio_bytes = (_make_sine_wave(1200) * 32768).astype(np.int16).tobytes()
            mel = extract_melspectrogram(audio_bytes)
            mfc = extract_mfcc(audio_bytes)
            src = "bytes"
        else:
            mel = extract_melspectrogram(path)
            mfc = extract_mfcc(path)
            src = "file"
            os.unlink(path)

        assert mel.shape == TARGET_SIZE, f"Mel shape mismatch: {mel.shape}"
        assert mfc.shape == TARGET_SIZE, f"MFCC shape mismatch: {mfc.shape}"
        print(f"  ✓  {name:<30} mel={mel.shape}  mfcc={mfc.shape}  src={src}")

    print("\nAll three feature extractions passed — shapes are all (128, 128). ✓")
    print("=" * 60)
