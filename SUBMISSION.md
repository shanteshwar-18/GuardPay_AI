# 🛡️ GuardPay AI — Final Submission

**Real-Time Multi-Modal UPI Fraud Intervention Engine**  
Bharti Hackathon 2026

---

## 🚀 Quick Start

```bash
# 1. Clone & install
git clone https://github.com/shanteshwar-18/GuardPay_AI.git
cd GuardPay_AI
pip install -e .

# 2. Copy environment template
cp .env.example .env
# → Fill in GROQ_API_KEY, TWILIO_*, SUPABASE_*, MONGODB_URI

# 3. (Optional) Seed 5,000 UPI reputation records
#    → auto-seeds on first startup if MongoDB is connected

# 4. Start mock bank server (in a separate terminal)
python scripts/mock_bank_server.py

# 5. Start backend
python run.py
# → API: http://localhost:8000
# → Swagger docs: http://localhost:8000/docs

# 6. Run all tests
python -m pytest tests/ -v

# 7. Launch mobile app
cd frontend/GuardPayUI
npx expo start
```

---

## 📐 Architecture

```
React Native (Expo)
    │
    ├── WS  /ws/audio-stream         ← 3-sec PCM audio chunks
    │
    └── POST /api/v1/risk-score       ← Transaction evaluation
              │
              └── asyncio.gather() ──► 6 AI modules in parallel
                    ├── VoiceCloneCNN       (W=0.25)
                    ├── Whisper + Llama 3   (W=0.20)
                    ├── OCR fuzzy match     (W=0.15)
                    ├── MongoDB reputation  (W=0.20)
                    ├── Bloom filter        (W=0.10)
                    └── Isolation Forest    (W=0.10)
                              │
                              └── SHAP Fusion → Score 0–100
                                        │
                          ┌─────────────┼──────────────┐
                        SAFE        WARNING           HARD_INTERCEPT
                       (< 40)      (40–90)              (≥ 90)
                      PIN pad   SHAP warning     Twilio IVR + Evidence
                                                  + mTLS Bank Alert
```

---

## 🎯 Risk Tiers

| Tier | Score | Response |
|---|---|---|
| **SAFE** | 0–39 | Zero friction → PIN pad |
| **WARNING** | 40–69 | Amber screen + SHAP explanation |
| **ELEVATED** | 70–89 | Evidence captured + cooling-off |
| **HARD_INTERCEPT** | 90–100 | Payment blocked + Twilio IVR + Bank alert |

---

## 🔑 Key Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health + version |
| `POST` | `/api/v1/risk-score` | **Main** — evaluate transaction risk |
| `GET` | `/api/v1/session/{txn_id}/status` | Poll IVR outcome |
| `WS` | `/ws/audio-stream` | Real-time audio pipeline |
| `POST` | `/api/v1/ocr` | Screenshot scam-phrase detection |
| `POST` | `/api/v1/feedback` | Capture scam outcome for recalibration |
| `GET` | `/api/v1/stats` | False-positive rate dashboard |
| `POST` | `/api/v1/twilio/callback` | DTMF webhook (Press 1=auth / 2=freeze) |

---

## 🧠 AI Stack

| Module | Model | Source |
|---|---|---|
| Voice Clone Detection | VoiceCloneCNN (128×128 Mel-spectrogram) | `models/audio_analyzer.py` |
| Speech-to-Text | OpenAI Whisper-tiny | `models/transcriber.py` |
| Coercion Detection | TF-IDF → Groq Llama 3 (EN/HI/MR/TA) | `models/coercion_engine.py` |
| Behaviour Analysis | Isolation Forest (10-feature vector) | `models/behaviour_analyzer.py` |
| Screen OCR | pytesseract + fuzzy Levenshtein | `backend/services/ocr_engine.py` |
| Risk Fusion | Weighted SHAP (6 factors) | `backend/services/risk_fusion.py` |

---

## 🔒 Security Features

- **AES-256-GCM** encrypted evidence bundles (`/evidence/{txn_id}.enc`)
- **mTLS** mutual authentication on bank fraud alerts
- **3× exponential backoff** retry on bank alert delivery
- **No raw audio** stored or transmitted — only feature vectors
- **Secrets via `.env`** — zero hardcoded credentials (security audit: 0 issues)

---

## ♿ Accessibility

- **Senior Citizen Mode**: 1.5× font scale, plain-language warnings, emergency "Call Family" FAB
- **Multilingual TTS**: Auto-reads warnings in English, Hindi, Marathi, Tamil
- **SHAP Explanations**: Human-readable "why is this risky" breakdown on every warning

---

## 🧪 Test Results

```
pytest tests/unit/test_backend.py   →  24/24 PASSED
pytest tests/unit/test_ai_modules.py → 24/24 PASSED
python scripts/security_audit.py    →  PASS (0 issues)
python scripts/verify_phase0.py     →  7/7 PASS
npm test (GuardPayUI)               →  19/19 PASSED
```

---

## 👥 Team

| Member | Role | Branch |
|---|---|---|
| Shanteshwar | Backend Lead | `shantesh/backend` |
| Jatin | AI/ML Lead | `jatin/ai-models` |
| Nikita | Frontend Lead | `nikita/frontend` |
| Raghav | Frontend + UX | `raghav/frontend` |

---

## 📄 License

MIT — See [LICENSE](frontend/LICENSE)

---

*GuardPay AI — Because every rupee deserves protection.*
