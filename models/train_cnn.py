"""
train_cnn.py — Voice-Clone CNN Training Script
GuardPay AI · AI/ML Module (Jatin)

Trains the lightweight 2-D CNN on the real ASVspoof 2019 LA corpus to detect
AI-synthesised / voice-cloned audio.

    train split -> fit          (attacks A01-A06)
    dev   split -> model select (attacks A01-A06, same families as train)
    eval  split -> final report (attacks A07-A19, UNSEEN families)

Why the metrics are not just "accuracy":
    ASVspoof 2019 LA is ~90% spoof / ~10% bonafide, so a model that answers
    "spoof" every time already scores ~90% raw accuracy while being useless.
    We therefore report balanced accuracy, EER and AUC as the headline numbers
    and treat raw accuracy as secondary.

Usage:
    python models/train_cnn.py                 # full run (extract -> train -> eval)
    python models/train_cnn.py --limit 4000    # quick smoke run on a subset
    python models/train_cnn.py --skip-eval     # train + dev only
    python models/train_cnn.py --quick         # random weights, no training (CI)

Output: models/voice_cnn.pt  (state_dict + preprocessing/threshold metadata)

Commit: feat(cnn): train voice-clone CNN on ASVspoof LA — real corpus
"""

from __future__ import annotations

import argparse
import json
import os
import random
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler

sys.path.insert(0, str(Path(__file__).parent.parent))
from models.audio_features import FEATURE_VERSION, TARGET_SIZE  # noqa: E402
from models import feature_extractor as fx  # noqa: E402  (torch-free helper)

# ── Paths ──────────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).parent.parent
DATA_MOCK = PROJECT_ROOT / "data" / "mock" / "synthetic_audio"
MODEL_OUT = PROJECT_ROOT / "models" / "voice_cnn.pt"
METRICS_OUT = PROJECT_ROOT / "models" / "voice_cnn_metrics.json"
CACHE_DIR = PROJECT_ROOT / "data" / "asvspoof_cache"

# The corpus lives outside the repo (it is far too large to commit).
# Override with the ASVSPOOF_ROOT environment variable.
ASVSPOOF_ROOT = Path(os.environ.get("ASVSPOOF_ROOT", r"D:\guardpay\LA\LA"))

SPLITS = {
    "train": ("ASVspoof2019_LA_train", "ASVspoof2019.LA.cm.train.trn.txt"),
    "dev":   ("ASVspoof2019_LA_dev",   "ASVspoof2019.LA.cm.dev.trl.txt"),
    "eval":  ("ASVspoof2019_LA_eval",  "ASVspoof2019.LA.cm.eval.trl.txt"),
}

# ── Hyper-parameters ───────────────────────────────────────────────────────────
EPOCHS = 20
LR = 1e-3
BATCH_SIZE = 64
SEED = 42


# ── Architecture (exactly as specified in the playbook §2.2 / Step 2.1) ────────

class VoiceCloneCNN(nn.Module):
    """
    Lightweight 2-D CNN for binary spoof detection.
    Input:  (B, 1, 128, 128) Mel-spectrogram in [-1, 1]
    Output: (B, 1) sigmoid probability that the audio is synthetic/cloned
    """

    def __init__(self):
        super().__init__()
        self.block1 = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),           # -> (B, 32, 64, 64)
        )
        self.block2 = nn.Sequential(
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),           # -> (B, 64, 32, 32)
        )
        self.pool = nn.AdaptiveAvgPool2d(1)   # -> (B, 64, 1, 1)
        self.classifier = nn.Sequential(
            nn.Flatten(),              # -> (B, 64)
            nn.Linear(64, 1),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.block1(x)
        x = self.block2(x)
        x = self.pool(x)
        return self.classifier(x)


# ── Dataset ────────────────────────────────────────────────────────────────────

class SpectrogramDataset(Dataset):
    """Wraps a float16 feature matrix on disk/RAM and casts to float32 per item."""

    def __init__(self, features: np.ndarray, labels: np.ndarray):
        self.features = features                      # (N, 128, 128) float16
        self.labels = labels.astype(np.float32)       # (N,)

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        x = torch.from_numpy(self.features[idx].astype(np.float32)).unsqueeze(0)
        y = torch.tensor([self.labels[idx]], dtype=torch.float32)
        return x, y


# ── Feature loading (extraction runs in a torch-free subprocess) ───────────────

def build_features(split: str, limit: int | None, workers: int) -> tuple[np.ndarray, np.ndarray]:
    """
    Load cached Mel-spectrograms for one split, extracting them first if needed.

    Extraction is delegated to models/feature_extractor.py as a SUBPROCESS rather
    than done inline. Windows spawns multiprocessing workers by re-importing the
    parent __main__ module; if that module is this one, every worker would load
    torch and exhaust the page file (WinError 1455).
    """
    files, labels = fx.read_protocol(split)
    files, labels = fx.subsample(files, labels, limit)
    x_path, y_path = fx.cache_paths(split, len(files))

    if not (x_path.exists() and y_path.exists()):
        cmd = [sys.executable, str(Path(__file__).parent / "feature_extractor.py"),
               "--split", split, "--workers", str(workers)]
        if limit:
            cmd += ["--limit", str(limit)]
        print(f"[train_cnn] extracting {split} via subprocess: {' '.join(cmd[1:])}", flush=True)
        result = subprocess.run(cmd, cwd=str(PROJECT_ROOT))
        if result.returncode != 0:
            raise RuntimeError(f"feature extraction failed for split={split}")

    X = np.load(x_path, mmap_mode="r")
    y = np.load(y_path)
    print(f"[train_cnn] {split}: features {X.shape} "
          f"(bonafide={int((y==0).sum())}, spoof={int((y==1).sum())})", flush=True)
    return X, y


def _synthetic_fallback() -> tuple[np.ndarray, np.ndarray]:
    """Last-resort synthetic data if the ASVspoof corpus is unavailable."""
    print("[train_cnn] ASVspoof corpus not found — generating synthetic fallback")
    DATA_MOCK.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(SEED)
    bona = rng.standard_normal((400, *TARGET_SIZE)).astype(np.float16)
    spoof = np.clip(rng.standard_normal((400, *TARGET_SIZE)) + 0.5, -1, 1).astype(np.float16)
    X = np.concatenate([bona, spoof])
    y = np.concatenate([np.zeros(400, dtype=np.int64), np.ones(400, dtype=np.int64)])
    return X, y


# ── Metrics ────────────────────────────────────────────────────────────────────

def compute_eer(y_true: np.ndarray, scores: np.ndarray) -> tuple[float, float]:
    """
    Equal Error Rate — the standard ASVspoof metric.
    Returns (eer, threshold_at_eer).
    """
    from sklearn.metrics import roc_curve
    fpr, tpr, thr = roc_curve(y_true, scores)
    fnr = 1 - tpr
    i = int(np.nanargmin(np.abs(fnr - fpr)))
    return float((fpr[i] + fnr[i]) / 2), float(thr[i])


def evaluate(model, X, y, device, threshold=0.5, batch=512) -> dict:
    """Run inference over a split and return the full metric set."""
    from sklearn.metrics import balanced_accuracy_score, roc_auc_score

    model.eval()
    scores = np.zeros(len(y), dtype=np.float64)
    with torch.no_grad():
        for s in range(0, len(y), batch):
            xb = torch.from_numpy(X[s:s + batch].astype(np.float32)).unsqueeze(1).to(device)
            scores[s:s + batch] = model(xb).squeeze(1).cpu().numpy()

    pred = (scores >= threshold).astype(int)
    eer, eer_thr = compute_eer(y, scores)
    return {
        "accuracy": float((pred == y).mean()),
        "balanced_accuracy": float(balanced_accuracy_score(y, pred)),
        "auc": float(roc_auc_score(y, scores)),
        "eer": eer,
        "eer_threshold": eer_thr,
        "threshold_used": float(threshold),
        "n": int(len(y)),
        "n_bonafide": int((y == 0).sum()),
        "n_spoof": int((y == 1).sum()),
    }


def _fmt(name: str, m: dict) -> str:
    return (f"  {name:<6} acc={m['accuracy']*100:5.2f}%  "
            f"bal_acc={m['balanced_accuracy']*100:5.2f}%  "
            f"EER={m['eer']*100:5.2f}%  AUC={m['auc']:.4f}  "
            f"(n={m['n']}, bona={m['n_bonafide']}, spoof={m['n_spoof']})")


# ── Training ───────────────────────────────────────────────────────────────────

def train(args):
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    torch.set_num_threads(max(1, (os.cpu_count() or 4) - 2))
    print(f"[train_cnn] device={device}  threads={torch.get_num_threads()}")

    corpus_ok = (ASVSPOOF_ROOT / "ASVspoof2019_LA_cm_protocols").is_dir()
    if corpus_ok:
        Xtr, ytr = build_features("train", args.limit, args.workers)
        Xdv, ydv = build_features("dev", args.limit, args.workers)
    else:
        X, y = _synthetic_fallback()
        cut = int(0.8 * len(y))
        Xtr, ytr, Xdv, ydv = X[:cut], y[:cut], X[cut:], y[cut:]

    counts = np.bincount(ytr, minlength=2)
    print(f"[train_cnn] train={len(ytr)} (bonafide={counts[0]}, spoof={counts[1]})  dev={len(ydv)}")

    # WeightedRandomSampler counteracts the ~1:9 bonafide:spoof imbalance so the
    # model cannot minimise loss by simply always predicting "spoof".
    weights = (1.0 / np.maximum(counts, 1))[ytr]
    sampler = WeightedRandomSampler(
        torch.as_tensor(weights, dtype=torch.double), num_samples=len(weights), replacement=True
    )
    train_loader = DataLoader(
        SpectrogramDataset(Xtr, ytr), batch_size=BATCH_SIZE, sampler=sampler, num_workers=0
    )

    model = VoiceCloneCNN().to(device)
    criterion = nn.BCELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="max", factor=0.5, patience=3)

    best_auc, best_state, best_dev = 0.0, None, None
    start = time.time()

    # Model selection uses dev AUC, not accuracy at a fixed 0.5 threshold.
    # Under this corpus's ~1:9 bonafide:spoof imbalance, accuracy at 0.5 says more
    # about where the threshold happens to sit than about how well the model
    # separates the classes — early epochs score ~50% balanced accuracy while
    # already reaching AUC 0.88. AUC is threshold-free, and the operating point is
    # chosen separately (at the dev EER) once the best checkpoint is picked.
    for epoch in range(1, args.epochs + 1):
        model.train()
        running, seen = 0.0, 0
        for xb, yb in train_loader:
            xb, yb = xb.to(device), yb.to(device)
            optimizer.zero_grad()
            loss = criterion(model(xb), yb)
            loss.backward()
            optimizer.step()
            running += loss.item() * len(xb)
            seen += len(xb)

        dev_m = evaluate(model, Xdv, ydv, device)
        scheduler.step(dev_m["auc"])
        marker = ""
        if dev_m["auc"] > best_auc:
            best_auc = dev_m["auc"]
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
            best_dev = dev_m
            marker = "  <- best"
        print(f"  Epoch [{epoch:02d}/{args.epochs}] loss={running/max(seen,1):.4f}  "
              f"dev_AUC={dev_m['auc']:.4f}  dev_EER={dev_m['eer']*100:5.2f}%  "
              f"bal_acc@EER={(1-dev_m['eer'])*100:5.2f}%{marker}", flush=True)

    if best_state is not None:
        model.load_state_dict(best_state)

    # Operating threshold is chosen on DEV (never on eval) to avoid tuning on the
    # very split we use to report generalisation.
    op_threshold = best_dev["eer_threshold"] if best_dev else 0.5
    print(f"\n[train_cnn] selected operating threshold from dev EER point: {op_threshold:.4f}")

    results = {"dev": evaluate(model, Xdv, ydv, device, op_threshold)}
    if corpus_ok and not args.skip_eval:
        Xev, yev = build_features("eval", args.limit, args.workers)
        results["eval"] = evaluate(model, Xev, yev, device, op_threshold)

    elapsed = time.time() - start
    print("\n" + "=" * 74)
    print(f"Training complete in {elapsed/60:.1f} min")
    for split in ("dev", "eval"):
        if split in results:
            print(_fmt(split, results[split]))

    headline = results.get("eval", results["dev"])
    target_met = headline["balanced_accuracy"] >= 0.85
    if target_met:
        print("\n[OK] Target >= 85% balanced accuracy ACHIEVED on "
              f"{'eval (unseen attacks)' if 'eval' in results else 'dev'}")
    else:
        print(f"\n[WARN] Balanced accuracy {headline['balanced_accuracy']*100:.2f}% is BELOW the 85% target.")
        print("       NOTE: the eval split contains attack families (A07-A19) never seen")
        print("       in training (A01-A06), so this is a generalisation gap, not a bug.")

    torch.save(
        {
            "state_dict": model.state_dict(),
            "feature_version": FEATURE_VERSION,
            "threshold": op_threshold,
            "metrics": results,
            "arch": "VoiceCloneCNN",
            "trained_on": "ASVspoof2019_LA" if corpus_ok else "synthetic",
        },
        MODEL_OUT,
    )
    METRICS_OUT.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"\nModel saved   -> {MODEL_OUT}")
    print(f"Metrics saved -> {METRICS_OUT}")
    print("=" * 74)
    return headline["balanced_accuracy"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="VoiceCloneCNN trainer")
    parser.add_argument("--quick", action="store_true",
                        help="Skip training — save randomly-initialised weights for CI/testing")
    parser.add_argument("--limit", type=int, default=None,
                        help="Cap samples per split (stratified) for a fast smoke run")
    parser.add_argument("--epochs", type=int, default=EPOCHS)
    parser.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 4) - 2))
    parser.add_argument("--skip-eval", action="store_true", help="Skip the eval split")
    args = parser.parse_args()

    if args.quick:
        print("[train_cnn] --quick mode: saving random-weight model (no training)")
        MODEL_OUT.parent.mkdir(parents=True, exist_ok=True)
        torch.save(
            {
                "state_dict": VoiceCloneCNN().state_dict(),
                "feature_version": FEATURE_VERSION,
                "threshold": 0.5,
                "metrics": {},
                "arch": "VoiceCloneCNN",
                "trained_on": "random-init",
            },
            MODEL_OUT,
        )
        print(f"[train_cnn] Saved quick-init model -> {MODEL_OUT}")
    else:
        train(args)
