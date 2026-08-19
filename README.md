<h1 align="center">
  <img src="docs/assets/logo.png" alt="GuardPay AI" width="120"/><br/>
  GuardPay AI ðŸ›¡ï¸
</h1>

<p align="center">
  <strong>Real-Time UPI Fraud Intervention Engine</strong><br/>
  SDG 16 â€” Peace, Justice & Strong Institutions
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Hackathon-Bharti%202026-blue?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/Status-Submission%20Ready%20%E2%9C%85-brightgreen?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge"/>
</p>

---

## ðŸš¨ What Is GuardPay AI?

GuardPay AI is a smart middleware application that intercepts high-risk UPI payment flows in real time. It detects **digital arrest scams**, **AI voice cloning**, and **coercive psychological manipulation** before a victim's money leaves their account.

Unlike static text warnings, GuardPay AI computes a **dynamic, explainable risk score** and enforces **graduated friction** proportional to the threat level.

---

## ðŸŽ¯ Risk Tier System

| Risk Score | Tier | Action |
|---|---|---|
| < 40 | ðŸŸ¢ SAFE | Payment proceeds normally to PIN pad |
| 40â€“70 | ðŸŸ¡ WARNING | Explainable warning in regional language shown before PIN pad |
| 70â€“90 | ðŸŸ  ELEVATED | Cooling-off timer + step-up verification + evidence bundle captured |
| > 90 | ðŸ”´ HARD INTERCEPT | UI locked + Twilio IVR call to trusted contact + bank fraud alert |

---

## ðŸ—ï¸ Architecture Overview

```
Mobile App (React Native)
    â”‚
    â”œâ”€â”€ WebSocket â”€â”€â–º Audio Stream â”€â”€â–º CNN Voice Clone Detector
    â”‚                                  â””â”€â–º Whisper Transcription â”€â”€â–º NLP Coercion Engine
    â”‚
    â”œâ”€â”€ POST /api/v1/risk-score
    â”‚       â”œâ”€â”€ audio_analyzer
    â”‚       â”œâ”€â”€ coercion_engine
    â”‚       â”œâ”€â”€ ocr_engine  (screen-share detection)
    â”‚       â”œâ”€â”€ reputation_service  (Bank Reputation Network)
    â”‚       â”œâ”€â”€ behaviour_analyzer
    â”‚       â””â”€â”€ risk_fusion (asyncio.gather â†’ weighted formula â†’ SHAP explainability)
    â”‚
    â””â”€â”€ Risk Response
            â”œâ”€â”€ < 40  â†’ PIN Pad (no friction)
            â”œâ”€â”€ 40-70 â†’ Warning Screen (multilingual)
            â”œâ”€â”€ 70-90 â†’ Cooling Timer + Evidence Bundle (.enc, AES-256-GCM)
            â””â”€â”€ > 90  â†’ Hard Intercept + Twilio IVR + Bank/PSP mTLS Alert
```

---

## ðŸ§° Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Mobile** | React Native (TypeScript) |
| **Backend API** | Python Â· FastAPI Â· WebSockets |
| **AI/ML** | PyTorch CNN (voice clone) Â· OpenAI Whisper-tiny Â· Groq Llama 3 (NLP) |
| **OCR** | Google ML Kit Vision / pytesseract (fallback) |
| **Voice IVR** | Twilio Programmable Voice |
| **Database** | MongoDB / Supabase |
| **Security** | AES-256-GCM evidence bundles Â· mTLS bank alert channel |
| **Explainability** | SHAP (LinearExplainer on risk calibrator) |

---

## ðŸ‘¥ Team & Branch Ownership

| Member | Role | Branch |
|---|---|---|
| **Shanteshwar** | Backend Lead Â· FastAPI, WebSocket, Twilio, Auth | `shantesh/backend` |
| **Jatin** | AI/ML Lead Â· CNN, Whisper, SHAP, Risk Fusion | `jatin/ai-models` |
| **Nikita** | Frontend Lead Â· React Native, Audio Streaming, UI | `nikita/frontend` |
| **Raghav** | Frontend Â· Senior Citizen Mode, Accessibility | `raghav/frontend` |

---

## ðŸ“ Repository Structure

```
guardpay-ai/
â”œâ”€â”€ backend/                  # FastAPI backend (Shanteshwar)
â”‚   â”œâ”€â”€ main.py
â”‚   â”œâ”€â”€ routers/
â”‚   â”œâ”€â”€ services/
â”‚   â”‚   â”œâ”€â”€ audio_analyzer.py
â”‚   â”‚   â”œâ”€â”€ coercion_engine.py
â”‚   â”‚   â”œâ”€â”€ ocr_engine.py
â”‚   â”‚   â”œâ”€â”€ reputation_service.py
â”‚   â”‚   â”œâ”€â”€ behaviour_analyzer.py
â”‚   â”‚   â”œâ”€â”€ risk_fusion.py
â”‚   â”‚   â”œâ”€â”€ twilio_service.py
â”‚   â”‚   â”œâ”€â”€ evidence_builder.py
â”‚   â”‚   â””â”€â”€ bank_alert_service.py
â”‚   â””â”€â”€ schemas/
â”œâ”€â”€ models/                   # AI model files & training (Jatin)
â”‚   â”œâ”€â”€ voice_cnn.pt
â”‚   â””â”€â”€ training/
â”œâ”€â”€ frontend/                 # React Native app (Nikita + Raghav)
â”‚   â””â”€â”€ GuardPayUI/
â”œâ”€â”€ data/
â”‚   â”œâ”€â”€ mock/                 # Mock data for demo (committed)
â”‚   â””â”€â”€ asvspoof/             # NOT committed (too large)
â”œâ”€â”€ scripts/                  # Utility scripts
â”œâ”€â”€ tests/
â”‚   â”œâ”€â”€ smoke_test.py
â”‚   â”œâ”€â”€ e2e_scenarios.py
â”‚   â””â”€â”€ unit/
â”œâ”€â”€ docs/
â”œâ”€â”€ .env.example              # Template â€” copy to .env and fill secrets
â”œâ”€â”€ requirements.txt
â””â”€â”€ README.md
```

---

## âš¡ Quick Start

### 1. Clone & Branch

```bash
# Clone the repo
git clone https://github.com/<YOUR_ORG>/guardpay-ai.git
cd guardpay-ai

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
npx react-native start
# Android:  npx react-native run-android
# iOS:      npx react-native run-ios
```

---

## ðŸ” Environment Variables

Copy `.env.example` to `.env` and fill in:

```
GROQ_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
SUPABASE_URL=
SUPABASE_ANON_KEY=
MONGODB_URI=
BANK_ALERT_ENDPOINT=http://localhost:9000/fraud-alert
```

> âš ï¸ **Never commit your `.env` file.** It is covered by `.gitignore`.

---

## ðŸ§ª Running Tests

```bash
# Smoke test (requires backend running on :8000)
python tests/smoke_test.py

# End-to-end scenario tests (Green / Yellow / Red paths)
python tests/e2e_scenarios.py

# Unit tests (fully mocked, no live services needed)
pytest tests/unit/ -v
```

---

## ðŸ“‹ Commit Message Convention

```
feat(backend): add risk-score endpoint with asyncio.gather
feat(ai): implement CNN voice clone detector with MFCC pipeline
feat(frontend): add RiskEvalScreen with animated progress bar
fix(backend): handle WebSocket disconnection gracefully
chore: update requirements.txt with shap dependency
```

---

## ðŸ—‚ï¸ Key Documents

- [Solution Document](Docs/GuardPay_AI_Solution_Document%20(1).docx)
- [Master Playbook](Docs/GuardPay_AI_Hackathon_Playbook(medium).docx)

---

## ðŸ“± Frontend Setup

### Prerequisites
- Node.js â‰¥ 18.x
- npm â‰¥ 9.x
- Expo CLI (installed automatically via npx)
- Android Emulator or iOS Simulator (or Expo Go app on a physical device)

### Installation

```bash
cd frontend
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
cp frontend/.env.example frontend/.env
```

| Variable | Description | Default |
|---|---|---|
| `API_BASE_URL` | Shanteshwar's FastAPI backend URL | `http://localhost:8000` |
| `WS_BASE_URL` | WebSocket URL for live audio streaming | `ws://localhost:8000` |
| `DEFAULT_LANGUAGE` | Default TTS/i18n language code | `en-IN` |
| `SENIOR_MODE_DEFAULT` | Enable Senior Citizen Mode on first launch | `false` |

> âš ï¸ **`API_BASE_URL` must point at Shanteshwar's running FastAPI instance.** If you're running on a physical device, use your machine's local IP (e.g. `http://192.168.1.x:8000`) instead of `localhost`.

---

## ðŸ“œ License

MIT Â© Team GuardPay â€” Bharti Hackathon 2026

