"""
train_cnn.py — Voice-Clone CNN Training Script
GuardPay AI · AI/ML Module (Jatin)

Trains a lightweight 2-D CNN on ASVspoof 2019 LA dev+eval splits
(or synthetic fallback) to detect AI-synthesised / voice-cloned audio.

Target: >= 85% validation accuracy.
Output: models/voice_cnn.pt

Usage:
    python models/train_cnn.py

Commit: feat(cnn): train voice-clone CNN on ASVspoof dev split
"""

from __future__ import annotations

import os
import random
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler

# Import shared feature extractor
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from models.audio_features import batch_extract, TARGET_SIZE

# ── Paths ──────────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).parent.parent
DATA_ASVSPOOF = PROJECT_ROOT / "data" / "asvspoof"
DATA_MOCK     = PROJECT_ROOT / "data" / "mock" / "synthetic_audio"
MODEL_OUT     = PROJECT_ROOT / "models" / "voice_cnn.pt"

# ── Hyper-parameters ───────────────────────────────────────────────────────────
EPOCHS    = 20
LR        = 1e-3
BATCH_SIZE = 32
VAL_SPLIT  = 0.2
SEED       = 42


# ── Architecture ───────────────────────────────────────────────────────────────

class VoiceCloneCNN(nn.Module):
    """
    Lightweight 2-D CNN for binary spoof detection.
    Input:  (B, 1, 128, 128) Mel-spectrogram
    Output: (B, 1) sigmoid probability that audio is synthetic/cloned
    """

    def __init__(self):
        super().__init__()
        self.block1 = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),           # → (B, 32, 64, 64)
        )
        self.block2 = nn.Sequential(
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),           # → (B, 64, 32, 32)
        )
        self.pool = nn.AdaptiveAvgPool2d(1)   # → (B, 64, 1, 1)
        self.classifier = nn.Sequential(
            nn.Flatten(),              # → (B, 64)
            nn.Linear(64, 1),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.block1(x)
        x = self.block2(x)
        x = self.pool(x)
        return self.classifier(x)


# ── Dataset helper ─────────────────────────────────────────────────────────────

class SpectrogramDataset(Dataset):
    def __init__(self, features: np.ndarray, labels: np.ndarray):
        self.features = torch.from_numpy(features).unsqueeze(1)   # (N,1,H,W)
        self.labels   = torch.from_numpy(labels.astype(np.float32)).unsqueeze(1)

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        return self.features[idx], self.labels[idx]


# ── Data loading ───────────────────────────────────────────────────────────────

def _collect_asvspoof_files() -> tuple[list, list] | None:
    """
    Walk the ASVspoof 2019 LA data directory and collect file paths + labels.
    Returns (file_list, label_list) or None if data not present.
    """
    flac_dir = DATA_ASVSPOOF / "LA"
    protocol_dir = DATA_ASVSPOOF / "LA" / "ASVspoof2019_LA_cm_protocols"

    if not flac_dir.exists():
        return None

    # Try to find protocol files (dev + eval)
    proto_files = list(protocol_dir.glob("*.txt")) if protocol_dir.exists() else []
    if not proto_files:
        # Fallback: scan recursively for .flac files
        all_flac = list(flac_dir.rglob("*.flac"))
        if not all_flac:
            return None
        # Heuristic: files with 'genuine' or 'bonafide' in path → 0, else → 1
        files, labels = [], []
        for f in all_flac:
            label = 0 if ("genuine" in f.name.lower() or "bonafide" in f.name.lower()) else 1
            files.append(str(f))
            labels.append(label)
        return files, labels

    files, labels = [], []
    for proto in proto_files:
        with open(proto) as fh:
            for line in fh:
                parts = line.strip().split()
                if len(parts) < 5:
                    continue
                _, utt_id, _, _, label_str = parts[:5]
                label = 0 if label_str == "bonafide" else 1
                # Find the actual flac file
                flac = list(flac_dir.rglob(f"{utt_id}.flac"))
                if flac:
                    files.append(str(flac[0]))
                    labels.append(label)
    return (files, labels) if files else None


def _collect_synthetic_files() -> tuple[list, list]:
    """
    Load from the synthetic .npy fallback in data/mock/synthetic_audio/.
    If no files exist, generate them on the fly.
    """
    npy_files = list(DATA_MOCK.glob("*.npy"))

    if not npy_files:
        print("[train_cnn] Synthetic .npy files not found — generating on-the-fly ...")
        DATA_MOCK.mkdir(parents=True, exist_ok=True)
        # Generate 400 bonafide + 400 spoof synthetic spectrograms
        for i in range(400):
            arr = np.random.randn(128, 128).astype(np.float32)
            np.save(DATA_MOCK / f"bonafide_{i:04d}.npy", arr)
        for i in range(400):
            arr = np.clip(np.random.randn(128, 128).astype(np.float32) + 0.5, -1, 1)
            np.save(DATA_MOCK / f"spoof_{i:04d}.npy", arr)
        npy_files = list(DATA_MOCK.glob("*.npy"))

    files, labels = [], []
    for f in npy_files:
        label = 1 if "spoof" in f.name else 0
        files.append(str(f))
        labels.append(label)
    return files, labels


def load_data() -> tuple[np.ndarray, np.ndarray]:
    """
    Load and extract features from ASVspoof (preferred) or synthetic fallback.
    Returns (features, labels) arrays.
    """
    result = _collect_asvspoof_files()
    if result:
        files, labels = result
        print(f"[train_cnn] Using ASVspoof data — {len(files)} samples")
    else:
        print("[train_cnn] ASVspoof data not found — using synthetic fallback")
        files, labels = _collect_synthetic_files()
        print(f"[train_cnn] Synthetic data — {len(files)} samples")

    print("[train_cnn] Extracting features (this may take a few minutes) ...")
    features, labels_arr = batch_extract(files, labels)
    print(f"[train_cnn] Feature extraction complete. Shape: {features.shape}")
    return features, labels_arr


# ── Training ───────────────────────────────────────────────────────────────────

def train():
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)

    # ── Load data ──────────────────────────────────────────────────────────────
    features, labels = load_data()
    n_total = len(labels)

    # Train / val split
    indices = np.random.permutation(n_total)
    n_val  = max(1, int(n_total * VAL_SPLIT))
    val_idx, train_idx = indices[:n_val], indices[n_val:]

    train_feats, train_labels = features[train_idx], labels[train_idx]
    val_feats,   val_labels   = features[val_idx],   labels[val_idx]

    # ── DataLoaders ────────────────────────────────────────────────────────────
    train_ds = SpectrogramDataset(train_feats, train_labels)
    val_ds   = SpectrogramDataset(val_feats,   val_labels)

    # WeightedRandomSampler to handle class imbalance
    class_counts = np.bincount(train_labels)
    weights = (1.0 / class_counts)[train_labels]
    sampler = WeightedRandomSampler(weights, num_samples=len(weights), replacement=True)

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, sampler=sampler)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False)

    print(f"[train_cnn] Train={len(train_ds)}  Val={len(val_ds)}  "
          f"Classes={dict(enumerate(class_counts.tolist()))}")

    # ── Model, loss, optimiser ─────────────────────────────────────────────────
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[train_cnn] Training on: {device}")

    model = VoiceCloneCNN().to(device)
    criterion = nn.BCELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)

    best_val_acc = 0.0
    start_time = time.time()

    # ── Training loop ──────────────────────────────────────────────────────────
    for epoch in range(1, EPOCHS + 1):
        # --- Train ---
        model.train()
        train_loss = 0.0
        for x_batch, y_batch in train_loader:
            x_batch, y_batch = x_batch.to(device), y_batch.to(device)
            optimizer.zero_grad()
            preds = model(x_batch)
            loss  = criterion(preds, y_batch)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * len(x_batch)

        train_loss /= len(train_ds)

        # --- Validate ---
        model.eval()
        correct = total = 0
        val_loss = 0.0
        with torch.no_grad():
            for x_batch, y_batch in val_loader:
                x_batch, y_batch = x_batch.to(device), y_batch.to(device)
                preds = model(x_batch)
                val_loss += criterion(preds, y_batch).item() * len(x_batch)
                predicted = (preds >= 0.5).float()
                correct  += (predicted == y_batch).sum().item()
                total    += len(y_batch)

        val_loss /= len(val_ds)
        val_acc   = correct / total if total > 0 else 0.0

        print(
            f"  Epoch [{epoch:02d}/{EPOCHS}]  "
            f"train_loss={train_loss:.4f}  "
            f"val_loss={val_loss:.4f}  "
            f"val_acc={val_acc*100:.2f}%"
        )

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), MODEL_OUT)

    elapsed = time.time() - start_time

    # ── Final report ───────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print(f"Training complete in {elapsed/60:.1f} min")
    print(f"Best val accuracy: {best_val_acc*100:.2f}%")

    if best_val_acc >= 0.85:
        print("✓  Target of >= 85% accuracy ACHIEVED")
    else:
        # NOTE: below target — log honestly per promptbook instructions
        print(
            f"⚠  Val accuracy {best_val_acc*100:.2f}% is BELOW 85% target.\n"
            "   # NOTE: below target, see troubleshooting in README.\n"
            "   Possible fixes: more training data, normalisation, more epochs.\n"
            "   Risk fusion weights (W1) will be reduced to compensate."
        )

    print(f"Model saved → {MODEL_OUT}")
    print("=" * 60)
    return best_val_acc


if __name__ == "__main__":
    train()
