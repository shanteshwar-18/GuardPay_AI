"""
GuardPay AI — models package
Exposes all AI module public APIs from a single import point.
Uses lazy imports to avoid loading heavy deps (torch, librosa) until needed.
"""

__all__ = [
    "extract_melspectrogram", "extract_mfcc", "batch_extract",
    "analyze", "analyze_sync",
    "transcribe", "transcribe_sync",
    "classify", "classify_async",
    "score", "score_async", "train_and_save",
    "fuse", "fuse_async",
]


def __getattr__(name):
    """Lazy import — only load heavy modules when actually accessed."""
    if name in ("extract_melspectrogram", "extract_mfcc", "batch_extract"):
        from models.audio_features import extract_melspectrogram, extract_mfcc, batch_extract
        return locals()[name]
    if name in ("analyze", "analyze_sync"):
        from models.audio_analyzer import analyze, analyze_sync
        return locals()[name]
    if name in ("transcribe", "transcribe_sync"):
        from models.transcriber import transcribe, transcribe_sync
        return locals()[name]
    if name in ("classify", "classify_async"):
        from models.coercion_engine import classify, classify_async
        return locals()[name]
    if name in ("score", "score_async", "train_and_save"):
        from models.behaviour_analyzer import score, score_async, train_and_save
        return locals()[name]
    if name in ("fuse", "fuse_async"):
        from models.risk_fusion import fuse, fuse_async
        return locals()[name]
    raise AttributeError(f"module 'models' has no attribute '{name}'")
