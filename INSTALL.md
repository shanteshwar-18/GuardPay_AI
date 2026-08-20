# 🛡️ GuardPay AI — Complete Installation & Run Guide

**Repository:** https://github.com/shanteshwar-18/GuardPay_AI  
**Release:** `v1.0.0` | **Branch:** `main`

---

## 📋 Prerequisites

### System Requirements

| Tool | Minimum Version | Check Command |
|---|---|---|
| **Python** | 3.10+ (3.12 recommended) | `python --version` |
| **pip** | 23+ | `pip --version` |
| **Node.js** | 18.x+ | `node --version` |
| **npm** | 9.x+ | `npm --version` |
| **Git** | Any | `git --version` |

### Optional (full AI features)

| Tool | Purpose | Free? |
|---|---|---|
| **Groq API Key** | Llama 3 NLP coercion engine | Yes (console.groq.com) |
| **Twilio Account** | IVR voice call to trusted contact | Paid (demo mode works without it) |
| **MongoDB** | Live reputation database | Yes (demo fallback works without it) |
| **Tesseract OCR** | Screen-share detection | Yes (pytesseract fallback built-in) |

---

## 🔽 Step 1 — Clone the Repository

```bash
git clone https://github.com/shanteshwar-18/GuardPay_AI.git
cd GuardPay_AI
```

---

## ⚙️ Step 2 — Backend Setup (Python / FastAPI)

### 2.1 Create & Activate Virtual Environment

**Windows (PowerShell):**
```powershell
python -m venv guardpay_env
guardpay_env\Scripts\activate
```

**macOS / Linux:**
```bash
python3 -m venv guardpay_env
source guardpay_env/bin/activate
```

### 2.2 Install Python Dependencies

```bash
# IMPORTANT: Install PyTorch CPU-only FIRST (before requirements.txt)
pip install torch --index-url https://download.pytorch.org/whl/cpu

# Install all other dependencies
pip install -r requirements.txt
```

> ⏱️ First install takes ~5–10 minutes. PyTorch + Whisper are large downloads.

### 2.3 Configure Environment Variables

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

Edit `.env` and fill in:

```env
# Required — get free key at https://console.groq.com
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx

# Optional — leave blank for demo mode (mock fallbacks activate automatically)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890

# Optional — mock fallback works without MongoDB
MONGODB_URI=mongodb://localhost:27017/guardpay

# Optional — not needed for demo
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_key_here

# Mock bank alert server (start scripts/mock_bank_server.py separately)
BANK_ALERT_ENDPOINT=http://localhost:9000/fraud-alert

# Server
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000

# Risk thresholds (keep these defaults for the demo)
RISK_THRESHOLD_WARNING=40
RISK_THRESHOLD_ELEVATED=70
RISK_THRESHOLD_INTERCEPT=90
```

### 2.4 Verify AI Pipeline

```bash
python scripts/verify_phase0.py
```
Expected output: `7/7 checks PASS`

---

## 🚀 Step 3 — Start the Backend Server

```bash
python run.py
```

You should see:
```
INFO:     Started server process
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Verify it's working:**
- Browser: http://localhost:8000/health  
- Swagger UI: http://localhost:8000/docs  
- Expected response: `{"status":"ok","version":"1.0.0",...}`

---

## 📱 Step 4 — Frontend Setup (React Native)

### 4.1 Install Dependencies

```bash
cd frontend/GuardPayUI
npm install
```

### 4.2 Configure Backend URL

Open `src/services/config.ts` and set the correct URL for your setup:

```typescript
// Android EMULATOR (most common for demo)
export const API_BASE_URL = 'http://10.0.2.2:8000';
export const WS_BASE_URL  = 'ws://10.0.2.2:8000';

// Physical Android/iOS device on same WiFi
export const API_BASE_URL = 'http://192.168.1.X:8000';   // replace X with your IP
export const WS_BASE_URL  = 'ws://192.168.1.X:8000';

// Local browser / web mode
export const API_BASE_URL = 'http://localhost:8000';
export const WS_BASE_URL  = 'ws://localhost:8000';
```

### 4.3 Start Metro Bundler

```bash
npm start
```

### 4.4 Launch the App

Open a NEW terminal (keep Metro running):

```bash
# Android emulator or USB-connected device
npm run android

# iOS simulator (macOS only)
npm run ios
```

> 💡 **For Android Studio emulator:** Make sure the emulator is already running before `npm run android`.

---

## 🧪 Step 5 — Run All Tests

Run all of these with the backend server running (`python run.py` in a separate terminal):

```bash
# 1. Backend unit tests — no server needed (48 tests)
pytest tests/unit/ -v

# 2. Smoke test — 8 live API checks
python tests/smoke_test.py

# 3. End-to-end demo scenarios — Green / Yellow / Red paths
python tests/e2e_scenarios.py

# 4. Security audit
python scripts/security_audit.py

# 5. Frontend unit tests (from frontend/GuardPayUI directory)
cd frontend/GuardPayUI
npm test
```

**Expected results:**
| Suite | Result |
|---|---|
| Backend unit tests | 48/48 PASS |
| Smoke test | 8/8 PASS |
| E2E scenarios | ALL PASS |
| Security audit | 0 issues / 0 warnings |
| Frontend jest | 19/19 PASS |

---

## 🎬 Step 6 — Full Demo (4-Terminal Setup)

| Terminal | Command | What it does |
|---|---|---|
| **T1** | `python run.py` | Starts FastAPI backend on :8000 |
| **T2** | `python scripts/mock_bank_server.py` | Starts mock bank alert server on :9000 |
| **T3** | `python tests/e2e_scenarios.py` | Runs automated Green/Yellow/Red validation |
| **T4** | `cd frontend/GuardPayUI && npm start` | Starts React Native Metro bundler |

Then in a 5th terminal (or Android Studio):
```bash
cd frontend/GuardPayUI && npm run android
```

---

## 📡 API Endpoints Quick Reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Health check |
| `/api/v1/risk-score` | POST | AI risk evaluation |
| `/api/v1/session/{id}/status` | GET | Poll session state |
| `/api/v1/feedback` | POST | Submit outcome |
| `/api/v1/stats` | GET | False-positive stats |
| `/api/v1/ocr` | POST | Scam phrase detection |
| `/ws/audio-stream` | WebSocket | Live PCM audio |
| `/api/v1/twilio/callback` | POST | DTMF (1=Release / 2=Freeze) |

Full interactive docs: http://localhost:8000/docs

---

## 🔧 Common Issues & Fixes

| Issue | Fix |
|---|---|
| `No module named torch` | Run `pip install torch --index-url https://download.pytorch.org/whl/cpu` first |
| Whisper download on first run | Normal — downloads 72MB weights once, then cached |
| `MongoDB connection refused` | Expected in demo — system auto-uses mock fallbacks |
| `pybloom_live not installed` | `pip install pybloom-live` — set-based fallback is auto-used |
| Android emulator: network error | Use `10.0.2.2:8000` not `localhost` in config.ts |
| Physical device: can't reach API | Backend must bind to `0.0.0.0`; use machine LAN IP in app |
| `npm: not recognized` | Install Node.js from https://nodejs.org |
| PowerShell execution policy | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (run as admin) |
| `TypeScript errors` | Run `npx tsc --noEmit` to check — should show 0 errors |

---

## 🏷️ Release Info

- **Tag:** `v1.0.0`
- **Commit:** `0207672`  
- **All branches merged into `main`** (shantesh/backend, jatin/ai-models, nikita/frontend, raghav/frontend)

---

*MIT © Team GuardPay — Bharti Hackathon 2026*
