"""
GuardPay AI — models package
Exposes all AI module public APIs from a single import point.
"""
from models.audio_features    import extract_melspectrogram, extract_mfcc, batch_extract
from models.audio_analyzer    import analyze, analyze_sync
from models.transcriber       import transcribe, transcribe_sync
from models.coercion_engine   import classify, classify_async
from models.behaviour_analyzer import score, score_async, train_and_save
from models.risk_fusion       import fuse, fuse_async

__all__ = [
    "extract_melspectrogram", "extract_mfcc", "batch_extract",
    "analyze", "analyze_sync",
    "transcribe", "transcribe_sync",
    "classify", "classify_async",
    "score", "score_async", "train_and_save",
    "fuse", "fuse_async",
]
