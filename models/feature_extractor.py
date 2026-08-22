"""
feature_extractor.py — Parallel ASVspoof feature extraction & caching
GuardPay AI · AI/ML Module (Jatin)

Deliberately torch-free.

On Windows, multiprocessing uses the "spawn" start method, which re-imports the
parent's __main__ module in every worker. If that module imports torch, each of
the N workers loads the full torch runtime and the machine runs out of page file
(WinError 1455). Keeping extraction in this separate, torch-free module means a
worker only pulls numpy/librosa/soundfile/PIL.

Usage (standalone):
    python models/feature_extractor.py --split train --workers 8
    python models/feature_extractor.py --all

train_cnn.py invokes this automatically via subprocess when a cache is missing.

Commit: feat(audio): parallel ASVspoof feature extraction with on-disk cache
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))
from models.audio_features import (  # noqa: E402
    FEATURE_VERSION,
    TARGET_SIZE,
    extract_melspectrogram,
)

PROJECT_ROOT = Path(__file__).parent.parent
CACHE_DIR = PROJECT_ROOT / "data" / "asvspoof_cache"
ASVSPOOF_ROOT = Path(os.environ.get("ASVSPOOF_ROOT", r"D:\guardpay\LA\LA"))

SPLITS = {
    "train": ("ASVspoof2019_LA_train", "ASVspoof2019.LA.cm.train.trn.txt"),
    "dev":   ("ASVspoof2019_LA_dev",   "ASVspoof2019.LA.cm.dev.trl.txt"),
    "eval":  ("ASVspoof2019_LA_eval",  "ASVspoof2019.LA.cm.eval.trl.txt"),
}

SEED = 42


def corpus_available() -> bool:
    return (ASVSPOOF_ROOT / "ASVspoof2019_LA_cm_protocols").is_dir()


def read_protocol(split: str) -> tuple[list[str], np.ndarray]:
    """
    Parse an ASVspoof2019 LA CM protocol file.

    Line format: SPEAKER_ID  UTTERANCE_ID  -  ATTACK_ID  {bonafide|spoof}
    Returns (flac paths, int64 labels) with bonafide=0, spoof=1.
    """
    sub_dir, proto_name = SPLITS[split]
    proto = ASVSPOOF_ROOT / "ASVspoof2019_LA_cm_protocols" / proto_name
    flac_dir = ASVSPOOF_ROOT / sub_dir / "flac"

    if not proto.exists():
        raise FileNotFoundError(f"protocol not found: {proto}")
    if not flac_dir.is_dir():
        raise FileNotFoundError(f"flac directory not found: {flac_dir}")

    files, labels = [], []
    with open(proto, "r", encoding="utf-8") as fh:
        for line in fh:
            parts = line.split()
            if len(parts) < 5:
                continue
            files.append(str(flac_dir / f"{parts[1]}.flac"))
            labels.append(0 if parts[4] == "bonafide" else 1)
    return files, np.asarray(labels, dtype=np.int64)


def subsample(files: list[str], labels: np.ndarray, limit: int):
    """Stratified subsample that preserves the real bonafide:spoof ratio."""
    if not limit or limit >= len(files):
        return files, labels
    rng = np.random.default_rng(SEED)
    bona, spoof = np.flatnonzero(labels == 0), np.flatnonzero(labels == 1)
    n_bona = max(1, int(round(limit * len(bona) / len(labels))))
    n_spoof = max(1, limit - n_bona)
    idx = np.concatenate([
        rng.choice(bona, min(n_bona, len(bona)), replace=False),
        rng.choice(spoof, min(n_spoof, len(spoof)), replace=False),
    ])
    rng.shuffle(idx)
    return [files[i] for i in idx], labels[idx]


def cache_paths(split: str, n: int) -> tuple[Path, Path]:
    """Cache key includes FEATURE_VERSION so preprocessing changes invalidate it."""
    tag = f"{split}_v{FEATURE_VERSION}_{n}"
    return CACHE_DIR / f"{tag}_X.npy", CACHE_DIR / f"{tag}_y.npy"


def _extract_one(path: str):
    """Worker: (128,128) float16 spectrogram, or None if unreadable."""
    try:
        return extract_melspectrogram(path).astype(np.float16)
    except Exception:
        return None


def build(split: str, limit: int | None, workers: int, force: bool = False):
    files, labels = read_protocol(split)
    files, labels = subsample(files, labels, limit)
    n = len(files)

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    x_path, y_path = cache_paths(split, n)
    if x_path.exists() and y_path.exists() and not force:
        print(f"[extract] {split}: cache hit -> {x_path.name}")
        return x_path, y_path

    print(f"[extract] {split}: {n} files, {workers} workers, "
          f"bonafide={int((labels==0).sum())} spoof={int((labels==1).sum())}", flush=True)

    X = np.zeros((n, *TARGET_SIZE), dtype=np.float16)
    keep = np.zeros(n, dtype=bool)
    t0 = time.time()

    with ProcessPoolExecutor(max_workers=workers) as pool:
        for i, feat in enumerate(pool.map(_extract_one, files, chunksize=32)):
            if feat is not None:
                X[i] = feat
                keep[i] = True
            if (i + 1) % 2500 == 0 or i + 1 == n:
                el = time.time() - t0
                rate = (i + 1) / max(el, 1e-9)
                print(f"    {i+1:>6}/{n}  {rate:5.0f} f/s  "
                      f"elapsed {el/60:4.1f}m  ETA {(n-i-1)/max(rate,1e-9)/60:4.1f}m", flush=True)

    dropped = int((~keep).sum())
    if dropped:
        print(f"[extract] {split}: dropped {dropped} unreadable file(s)")

    X, y = X[keep], labels[keep]
    np.save(x_path, X)
    np.save(y_path, y)
    print(f"[extract] {split}: saved {X.shape} -> {x_path.name} ({time.time()-t0:.0f}s)", flush=True)
    return x_path, y_path


def main():
    ap = argparse.ArgumentParser(description="ASVspoof feature extractor")
    ap.add_argument("--split", choices=list(SPLITS), help="single split to extract")
    ap.add_argument("--all", action="store_true", help="extract train, dev and eval")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--workers", type=int, default=max(1, min(8, (os.cpu_count() or 4) - 2)))
    ap.add_argument("--force", action="store_true", help="ignore existing cache")
    args = ap.parse_args()

    if not corpus_available():
        print(f"[extract] ERROR: ASVspoof corpus not found at {ASVSPOOF_ROOT}", file=sys.stderr)
        return 2

    targets = list(SPLITS) if args.all else ([args.split] if args.split else [])
    if not targets:
        ap.error("pass --split <name> or --all")

    for split in targets:
        build(split, args.limit, args.workers, args.force)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
