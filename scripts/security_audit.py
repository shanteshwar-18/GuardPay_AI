"""
GuardPay AI -- Security Audit Script
PROMPT 16: Grep-audits codebase for hardcoded secrets

Usage: python scripts/security_audit.py
"""

import io
import re
import sys
from pathlib import Path

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ROOT = Path(__file__).parent.parent
ISSUES = []
WARNINGS = []

SKIP_DIRS = {".git", "__pycache__", "guardpay_env", "node_modules", ".eggs", "dist", "scripts"}



def flag(level: str, file: str, line_no: int, detail: str):
    entry = f"  [{level}] {file}:{line_no} — {detail}"
    if level == "ISSUE":
        ISSUES.append(entry)
    else:
        WARNINGS.append(entry)


# ─── Patterns to reject ───────────────────────────────────────────────────────
SECRET_PATTERNS = [
    (re.compile(r'(?i)(sk_live|sk_test|api_key|apikey|secret|password|token)\s*=\s*["\'][^"\']{8,}["\']'), "Hardcoded secret"),
    (re.compile(r'AC[a-zA-Z0-9]{32}'), "Twilio Account SID"),
    (re.compile(r'[a-zA-Z0-9]{32}'), None),  # generic — skip (too broad)
    (re.compile(r'eyJ[a-zA-Z0-9_-]{20,}'), "JWT token"),
    (re.compile(r'AKIA[0-9A-Z]{16}'), "AWS Access Key"),
]

SKIP_EXTS = {".pyc", ".enc", ".pem", ".key", ".crt", ".png", ".jpg", ".pt", ".onnx"}

print("\nGuardPay AI — Security Audit")
print("=" * 50)

# ─── 1. Scan source files for secrets ────────────────────────────────────────
print("\n1. Scanning for hardcoded secrets...")
py_files = [
    f for f in ROOT.rglob("*.py")
    if not any(skip in f.parts for skip in SKIP_DIRS)
    and f.suffix not in SKIP_EXTS
]
for fpath in py_files:
    try:
        content = fpath.read_text(encoding="utf-8", errors="ignore")
        for line_no, line in enumerate(content.splitlines(), 1):
            # Skip comments and known-safe patterns
            stripped = line.strip()
            if stripped.startswith("#"):
                continue
            for pattern, label in SECRET_PATTERNS:
                if label and pattern.search(line):
                    # Ignore .env.example and test files with placeholder values
                    if ".env.example" in str(fpath) or "test" in str(fpath).lower():
                        continue
                    if "your_" in line.lower() or "placeholder" in line.lower():
                        continue
                    flag("ISSUE", str(fpath.relative_to(ROOT)), line_no, f"{label}: {line.strip()[:80]}")
    except Exception:
        pass

if not ISSUES:
    print("  [PASS] No hardcoded secrets found in source files.")

# ─── 2. Check .env is gitignored ─────────────────────────────────────────────
print("\n2. Checking .env is gitignored...")
gitignore = ROOT / ".gitignore"
if gitignore.exists():
    content = gitignore.read_text()
    if ".env" in content and "!.env.example" in content:
        print("  [PASS] .env is in .gitignore, .env.example is exempt.")
    else:
        flag("ISSUE", ".gitignore", 0, ".env is not properly excluded — risk of secret leak!")
else:
    flag("ISSUE", ".gitignore", 0, ".gitignore file missing!")

# ─── 3. Check evidence/ not tracked ──────────────────────────────────────────
print("\n3. Checking evidence/ directory not tracked by git...")
if "evidence/" in content or "evidence" in content:
    print("  [PASS] evidence/ is in .gitignore.")
else:
    flag("ISSUE", ".gitignore", 0, "evidence/ not in .gitignore — encrypted bundles may be committed!")

# ─── 4. Check .env.example completeness ──────────────────────────────────────
print("\n4. Checking .env.example has all required variables...")
env_example = ROOT / ".env.example"
required_vars = [
    "GROQ_API_KEY", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER", "SUPABASE_URL", "SUPABASE_ANON_KEY",
    "MONGODB_URI", "BANK_ALERT_ENDPOINT",
]
if env_example.exists():
    example_content = env_example.read_text()
    for var in required_vars:
        if var not in example_content:
            flag("ISSUE", ".env.example", 0, f"Missing required variable: {var}")
    if not ISSUES:
        print(f"  [PASS] All {len(required_vars)} required variables documented.")
else:
    flag("ISSUE", ".env.example", 0, ".env.example file missing!")

# ─── 5. Check no TODO_PROD markers ───────────────────────────────────────────
print("\n5. Checking for TODO_PROD markers (production blockers)...")
todo_count = 0
for fpath in py_files:
    if fpath.name == "security_audit.py":
        continue  # skip self
    content = fpath.read_text(encoding="utf-8", errors="ignore")
    for line_no, line in enumerate(content.splitlines(), 1):
        if "TODO_PROD" in line:
            flag("ISSUE", str(fpath.relative_to(ROOT)), line_no, f"Production blocker: {line.strip()[:80]}")
            todo_count += 1
if todo_count == 0:
    print("  [PASS] No TODO_PROD markers found.")

# ─── Summary ──────────────────────────────────────────────────────────────────
print("\n" + "=" * 50)
print(f"Issues  : {len(ISSUES)}")
print(f"Warnings: {len(WARNINGS)}")

if ISSUES:
    print("\nFailed checks:")
    for i in ISSUES:
        print(i)
if WARNINGS:
    print("\nWarnings:")
    for w in WARNINGS:
        print(w)

if not ISSUES:
    print("\nSECURITY AUDIT: PASS")
else:
    print("\nSECURITY AUDIT: FAIL — fix issues before submission")

sys.exit(0 if not ISSUES else 1)
