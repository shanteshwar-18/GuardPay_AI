<h1 align="center">
  <img src="docs/assets/logo.png" alt="GuardPay AI" width="120"/><br/>
  GuardPay AI 🛡️
</h1>

<p align="center">
  <strong>Real-Time UPI Fraud Intervention Engine</strong><br/>
  SDG 16 — Peace, Justice & Strong Institutions
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Hackathon-Bharti%202026-blue?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/Status-Submission%20Ready%20✅-brightgreen?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge"/>
</p>

---

## 🚨 What Is GuardPay AI?

GuardPay AI is a smart middleware application that intercepts high-risk UPI payment flows in real time. It detects **digital arrest scams**, **AI voice cloning**, and **coercive psychological manipulation** before a victim's money leaves their account.

Unlike static text warnings, GuardPay AI computes a **dynamic, explainable risk score** and enforces **graduated friction** proportional to the threat level.

---

## 🎯 Risk Tier System

| Risk Score | Tier | Action |
|---|---|---|
| < 40 | 🟢 SAFE | Payment proceeds normally to PIN pad |
| 40–70 | 🟡 WARNING | Explainable warning in regional language shown before PIN pad |
| 70–90 | 🟠 ELEVATED | Cooling-off timer + step-up verification + evidence bundle captured |
| > 90 | 🔴 HARD INTERCEPT | UI locked + Twilio IVR call to trusted contact + bank fraud alert |

---

## 🏗️ Architecture Overview

```text
Mobile App (React Native)
    │
    ├── WebSocket ──► Audio Stream ──► CNN Voice Clone Detector
    │                                  └─► Whisper Transcription ──► NLP Coercion Engine
    │
    ├── POST /api/v1/risk-score
    │       ├── audio_analyzer
    │       ├── coercion_engine
    │       ├── ocr_engine  (screen-share detection)
    │       ├── reputation_service  (Bank Reputation Network)
    │       ├── behaviour_analyzer
    │       └── risk_fusion (asyncio.gather → weighted formula → SHAP explainability)
    │
    └── Risk Response
            ├── < 40  → PIN Pad (no friction)
            ├── 40-70 → Warning Screen (multilingual)
            ├── 70-90 → Cooling Timer + Evidence Bundle (.enc, AES-256-GCM)
            └── > 90  → Hard Intercept + Twilio IVR + Bank/PSP mTLS Alert
```

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Mobile** | React Native (TypeScript) |
| **Backend API** | Python · FastAPI · WebSockets |
| **AI/ML** | PyTorch CNN (voice clone) · OpenAI Whisper-tiny · Groq Llama 3 (NLP) |
| **OCR** | Google ML Kit Vision / pytesseract (fallback) |
| **Voice IVR** | Twilio Programmable Voice |
| **Database** | MongoDB / Supabase |
| **Security** | AES-256-GCM evidence bundles · mTLS bank alert channel |
| **Explainability** | SHAP (LinearExplainer on risk calibrator) |

---

## 👥 Team & Branch Ownership

| Member | Role | Branch |
|---|---|---|
| **Shanteshwar** | Backend Lead · FastAPI, WebSocket, Twilio, Auth | `shantesh/backend` |
| **Jatin** | AI/ML Lead · CNN, Whisper, SHAP, Risk Fusion | `jatin/ai-models` |
| **Nikita** | Frontend Lead · React Native, Audio Streaming, UI | `nikita/frontend` |
| **Raghav** | Frontend · Senior Citizen Mode, Accessibility | `raghav/frontend` |

---

## 📁 Repository Structure

```text
guardpay-ai/
├── backend/                  # FastAPI backend (Shanteshwar)
│   ├── main.py
│   ├── routers/
│   ├── services/
│   │   ├── audio_analyzer.py
│   │   ├── coercion_engine.py
│   │   ├── ocr_engine.py
│   │   ├── reputation_service.py
│   │   ├── behaviour_analyzer.py
│   │   ├── risk_fusion.py
│   │   ├── twilio_service.py
│   │   ├── evidence_builder.py
│   │   └── bank_alert_service.py
│   └── schemas/
├── models/                   # AI model files & training (Jatin)
│   ├── voice_cnn.pt
│   └── training/
├── frontend/                 # React Native app (Nikita + Raghav)
│   └── GuardPayUI/
├── data/
│   ├── mock/                 # Mock data for demo (committed)
│   └── asvspoof/             # NOT committed (too large)
├── scripts/                  # Utility scripts
├── tests/
│   ├── smoke_test.py
│   ├── e2e_scenarios.py
│   └── unit/
├── docs/
├── .env.example              # Template — copy to .env and fill secrets
├── requirements.txt
└── README.md
```

---

## ⚡ Quick Start

### 1. Clone & Branch

```bash
# Clone the repo
git clone https://github.com/shanteshwar-18/GuardPay_AI.git
cd GuardPay_AI

# Switch to your personal branch (off dev)
git checkout dev
git checkout -b <your-branch>   # shantesh/backend | jatin/ai-models | nikita/frontend | raghav/frontend
```

### 2. Backend Setup (Shanteshwar / Jatin)

```bash
cd backend
python -m venv guardpay_env
# Windows
guardpay_env\Scripts\activate
# macOS/Linux
source guardpay_env/bin/activate

pip install -r ../requirements.txt
cp ../.env.example ../.env    # Fill in your secrets
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup (Nikita / Raghav)

```bash
cd frontend/GuardPayUI
npm install
npx expo start
```

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` and fill in:

```text
GROQ_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
SUPABASE_URL=
SUPABASE_ANON_KEY=
MONGODB_URI=
BANK_ALERT_ENDPOINT=http://localhost:9000/fraud-alert
```

> ⚠️ **Never commit your `.env` file.** It is covered by `.gitignore`.

---

## 🧪 Running Tests

```bash
# Smoke test (requires backend running on :8000)
python scripts/smoke_test_phase8.py

# End-to-end scenario tests (Green / Yellow / Red paths)
python tests/e2e_scenarios.py

# Unit tests (fully mocked, no live services needed)
pytest tests/unit/ -v
```

---

## 📋 Commit Message Convention

```text
feat(backend): add risk-score endpoint with asyncio.gather
feat(ai): implement CNN voice clone detector with MFCC pipeline
feat(frontend): add RiskEvalScreen with animated progress bar
fix(backend): handle WebSocket disconnection gracefully
chore: update requirements.txt with shap dependency
```

---

## 📁 Key Documents

- [Solution Document](Docs/GuardPay_AI_Solution_Document%20(1).docx)
- [Master Playbook](Docs/GuardPay_AI_Hackathon_Playbook(medium).docx)
- [Demo Presentation Playbook](Docs/DEMO_PRESENTATION_PLAYBOOK.md)

---

## 📱 Frontend Setup

### Prerequisites
- Node.js ≥ 18.x
- npm ≥ 9.x
- Expo CLI (installed automatically via npx)
- Android Emulator or iOS Simulator (or Expo Go app on a physical device)

### Installation

```bash
cd frontend/GuardPayUI
npm install
```

### Running the App

```bash
# Start the Expo dev server (Metro bundler)
npx expo start

# Run on Android emulator
npm run android

# Run on iOS simulator (macOS only)
npm run ios

# Run in web browser
npm run web
```

### Environment Variables

Copy the frontend env template and update for your local setup:

```bash
cp frontend/GuardPayUI/.env.example frontend/GuardPayUI/.env
```

| Variable | Description | Default |
|---|---|---|
| `API_BASE_URL` | Shanteshwar's FastAPI backend URL | `http://localhost:8000` |
| `WS_BASE_URL` | WebSocket URL for live audio streaming | `ws://localhost:8000` |
| `DEFAULT_LANGUAGE` | Default TTS/i18n language code | `en-IN` |
| `SENIOR_MODE_DEFAULT` | Enable Senior Citizen Mode on first launch | `false` |

> ⚠️ **`API_BASE_URL` must point at Shanteshwar's running FastAPI instance.** If you're running on a physical device, use your machine's local IP (e.g. `http://192.168.1.x:8000`) instead of `localhost`.

---

## 📄 License

MIT © Team GuardPay — Bharti Hackathon 2026
