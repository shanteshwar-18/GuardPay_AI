# GuardPay AI — Frontend (React Native)

## 📱 Nikita's Frontend — `nikita/frontend` branch

**Role**: Frontend Lead | React Native TypeScript  
**Branch**: `nikita/frontend` → PRs to `dev`

---

## 🏗️ Project Structure

```
frontend/GuardPayUI/
├── App.tsx                          # Entry point — bootstraps i18n + navigator
├── package.json                     # All dependencies
├── tsconfig.json                    # TypeScript config
├── src/
│   ├── screens/
│   │   ├── HomeScreen.tsx           # Balance + recent txns + Send Money CTA
│   │   ├── BeneficiaryScreen.tsx    # UPI ID input + NEW payee badge
│   │   ├── AmountScreen.tsx         # Amount entry + amount-in-words
│   │   ├── RiskEvalScreen.tsx       # Animated loading + risk API call
│   │   ├── PinScreen.tsx            # Frictionless PIN pad (ALLOWED)
│   │   ├── WarningScreen.tsx        # Risk gauge + SHAP factor list (WARNING)
│   │   ├── InterceptScreen.tsx      # Full lock UI (HARD_INTERCEPT)
│   │   ├── HoldScreen.tsx           # Stub — Raghav's countdown timer
│   │   ├── __tests__/               # Jest UI tests
│   │   └── __dev__/                 # ScreenshotHarness (dev-only)
│   ├── components/
│   │   ├── RiskFactorList.tsx       # Shared SHAP factor list (Warning + Intercept)
│   │   └── SimulatedCallBanner.tsx  # "Active Call: Unknown Caller" overlay
│   ├── navigation/
│   │   └── AppNavigator.tsx         # Full payment flow stack
│   ├── services/
│   │   ├── config.ts                # API_BASE_URL, WS_BASE_URL, timeouts
│   │   ├── format.ts                # INR formatting + amount-in-words
│   │   ├── tts.ts                   # TTS stub (Raghav wires real engine)
│   │   ├── audioStream.ts           # WebSocket audio streaming service
│   │   └── languageState.tsx        # Language context + AsyncStorage persist
│   ├── i18n/
│   │   ├── index.ts                 # i18next initialisation
│   │   └── translations.ts          # EN / HI / MR / TA message templates
│   ├── theme/
│   │   └── colors.ts               # Risk-tier palette constants
│   ├── mock/
│   │   └── mockData.ts              # Mock beneficiaries, transactions, languages
│   └── types/
│       └── navigation.ts            # RootStackParamList + shared types
└── docs/
    ├── screenshot-checklist.md
    └── screenshots/                 # Captured screenshots for slide deck
```

---

## 🚀 Setup & Run

```bash
# 1. Install dependencies
cd frontend/GuardPayUI
npm install

# 2. Start Metro bundler
npx react-native start

# 3. Run on iOS simulator
npx react-native run-ios

# 4. Run on Android emulator
npx react-native run-android

# 5. Reset cache if Metro crashes
npx react-native start --reset-cache
```

---

## 🌐 Backend Configuration

Edit `src/services/config.ts` (do NOT hardcode credentials):

```ts
export const API_BASE_URL = 'http://localhost:8000';   // Shanteshwar's FastAPI
export const WS_BASE_URL  = 'ws://localhost:8000';     // WebSocket endpoint
```

---

## 🎯 Risk Tier → Screen Routing

| Score | Tier | Screen |
|---|---|---|
| < 40 | `ALLOWED` | `PinScreen` — no friction |
| 40–70 | `WARNING` | `WarningScreen` — SHAP gauge + multilingual warning |
| 70–90 | `ADAPTIVE_HOLD` | `HoldScreen` — countdown timer (Raghav) |
| > 90 | `HARD_INTERCEPT` | `InterceptScreen` — full lock, no PIN path |

---

## 🧪 Running Tests

```bash
npx jest --ci
```

---

## 📋 Git Commit Reference (Nikita's commits)

See `MASTER GIT COMMIT CHECKLIST — NIKITA` in the PromptBook for the full ordered list.

Key commits:
- `chore: init React Native project with navigation skeleton`
- `feat(ui): add beneficiary screen with NEW payee badge detection`
- `feat(ui): render warning card with risk breakdown and multilingual label`
- `feat(ui): implement hard intercept screen with lock animation`
- `feat(ui): integrate risk score API call in RiskEvalScreen with routing logic`
