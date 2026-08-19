"""
run_phase8.py — Phase 8 Integration Script (Jatin - AI/ML)
GuardPay AI

Executes the full Phase 8 sequence:
1. Generate synthetic training data (Phase 0)
2. Train VoiceCloneCNN + save voice_cnn.pt (PROMPT 4)
3. Train Isolation Forest + save models (PROMPT 8)
4. Run Phase 0 verification (7 checks)
5. Run unit test suite
6. Run Phase 8 smoke test against live backend (optional)

Usage:
    python scripts/run_phase8.py           # full run
    python scripts/run_phase8.py --quick   # skip CNN training (use random weights)
    python scripts/run_phase8.py --no-smoke # skip backend smoke test
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

PYTHON = str(ROOT / "guardpay_env" / "Scripts" / "python.exe")
if not Path(PYTHON).exists():
    PYTHON = sys.executable  # fallback to current python


def run(label: str, cmd: list[str], cwd=ROOT) -> bool:
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    t0 = time.monotonic()
    result = subprocess.run(cmd, cwd=cwd)
    elapsed = time.monotonic() - t0
    status = "PASS" if result.returncode == 0 else "FAIL"
    print(f"\n  [{status}] {label} ({elapsed:.1f}s)")
    return result.returncode == 0


def main():
    parser = argparse.ArgumentParser(description="GuardPay Phase 8 runner")
    parser.add_argument("--quick",    action="store_true", help="Skip full CNN training")
    parser.add_argument("--no-smoke", action="store_true", help="Skip backend smoke test")
    args = parser.parse_args()

    results = []
    start = time.monotonic()

    print("\n" + "="*60)
    print("  GuardPay AI — Phase 8 Integration Runner")
    print("  Jatin (AI/ML Lead)")
    print("="*60)

    # Step 1: Synthetic data generation
    ok = run(
        "STEP 1: Generate synthetic training data (Phase 0)",
        [PYTHON, str(ROOT / "scripts" / "generate_synthetic_data.py")]
    )
    results.append(("Synthetic data generation", ok))

    # Step 2: Train Isolation Forest (fast — no GPU needed)
    ok = run(
        "STEP 2: Train Isolation Forest behaviour model (PROMPT 8)",
        [PYTHON, "-c",
         "import sys; sys.path.insert(0,'.')\n"
         "from models.behaviour_analyzer import train_and_save; train_and_save()\n"
         "print('Isolation Forest trained and saved')"]
    )
    results.append(("Isolation Forest training", ok))

    # Step 3: CNN training (full or quick)
    if args.quick:
        ok = run(
            "STEP 3: CNN quick-init (--quick flag: random weights, no training)",
            [PYTHON, "-c",
             "import sys; sys.path.insert(0,'.')\n"
             "import torch\n"
             "from models.audio_analyzer import VoiceCloneCNN\n"
             "model = VoiceCloneCNN()\n"
             "torch.save(model.state_dict(), 'models/voice_cnn.pt')\n"
             "print('Saved quick-init voice_cnn.pt (random weights)')"]
        )
    else:
        ok = run(
            "STEP 3: Train VoiceCloneCNN on synthetic data (PROMPT 4)",
            [PYTHON, str(ROOT / "models" / "train_cnn.py")]
        )
    results.append(("CNN training", ok))

    # Step 4: Phase 0 verification
    ok = run(
        "STEP 4: Phase 0 verification suite (7 checks)",
        [PYTHON, str(ROOT / "scripts" / "verify_phase0.py")]
    )
    results.append(("Phase 0 verification", ok))

    # Step 5: Unit tests
    ok = run(
        "STEP 5: Unit test suite",
        [PYTHON, "-m", "pytest", str(ROOT / "tests" / "unit" / "test_ai_modules.py"),
         "-v", "--tb=short", "-x"]
    )
    results.append(("Unit tests", ok))

    # Step 6: Pipeline orchestrator self-test
    ok = run(
        "STEP 6: Pipeline orchestrator self-test (3 scenarios)",
        [PYTHON, str(ROOT / "backend" / "services" / "pipeline_orchestrator.py")]
    )
    results.append(("Pipeline orchestrator", ok))

    # Step 7: Backend smoke test (optional)
    if not args.no_smoke:
        smoke_path = ROOT / "tests" / "smoke_test.py"
        if smoke_path.exists():
            ok = run(
                "STEP 7: Backend smoke test (requires backend running on :8000)",
                [PYTHON, str(smoke_path)]
            )
            results.append(("Smoke test", ok))
        else:
            print("\n  [SKIP] smoke_test.py not found on this branch")

    # Final summary
    elapsed_total = time.monotonic() - start
    passed = sum(1 for _, ok in results if ok)
    total = len(results)
    print("\n" + "="*60)
    print(f"  Phase 8 Results: {passed}/{total} steps passed ({elapsed_total:.1f}s)")
    print("="*60)
    for label, ok in results:
        print(f"  {'OK' if ok else 'FAIL':4s}  {label}")
    print("="*60)

    if passed == total:
        print("\n  Phase 8 COMPLETE - Ready for PR merge to dev!")
    else:
        print(f"\n  {total - passed} step(s) failed - check output above.")

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
