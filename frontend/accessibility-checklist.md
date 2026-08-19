# ♿ GuardPay AI — Accessibility Audit Checklist & Compliance Report

This document records the full accessibility (a11y) audit for the **GuardPay AI React Native Frontend** in accordance with WCAG 2.1 AA guidelines and Bharti Hackathon 2026 specifications.

---

## 1. Audit Summary

| Category | Status | Details |
|---|---|---|
| **Screen Reader Support** | ✅ COMPLIANT | `accessible`, `accessibilityRole`, `accessibilityLabel`, and `accessibilityHint` on all interactive and informational elements. |
| **Dynamic / Live Content** | ✅ COMPLIANT | `accessibilityLiveRegion="assertive"` on countdown timer; `accessibilityLiveRegion="polite"` on intercept status line. |
| **Color Contrast & Senior Mode**| ✅ COMPLIANT | High-contrast palette (`#0F0F1A` / `#FFFFFF` / `#4ADE80` / `#F59E0B` / `#EF4444`); Senior Mode provides 1.5× font scaling & high-contrast yellow/amber badges. |
| **Non-Technical Language** | ✅ COMPLIANT | `simplifiedStrings.ts` translates ML SHAP outputs to plain language when Senior Citizen Mode is active. |
| **Voice Assistance (TTS)** | ✅ COMPLIANT | Multilingual speech synthesizer (`expo-speech`) reads fraud risk warnings aloud automatically in EN, HI, MR, TA. |
| **Emergency Accessibility** | ✅ COMPLIANT | One-tap Emergency Family Call floating action button (`EmergencyContactButton.tsx`) present across all screens. |

---

## 2. Element-by-Element Accessibility Registry

### 📱 `PINScreen` (Tier: ALLOWED)
- **Safe State Header**: `accessibilityRole="header"`, reads "Enter UPI PIN. Transaction verified — proceed safely".
- **PIN Dot Tracker**: `accessible={true}`, announces `${pin.length} of 6 digits entered`.
- **Numeric Keypad**: Each numeric key has `accessibilityRole="button"`, `accessibilityLabel="Number X"`, `accessibilityHint="Enters number X"`.
- **Backspace Key**: `accessibilityRole="button"`, `accessibilityLabel="Backspace"`, `accessibilityHint="Deletes the last entered digit"`.
- **Cancel Button**: `accessibilityRole="button"`, `accessibilityLabel="Cancel"`, returns user safely to Home screen.

---

### ⚠️ `WarningScreen` (Tier: WARNING)
- **Warning Header**: High-contrast icon + header announcing medium risk detection.
- **RiskGauge**: `accessibilityRole="progressbar"`, `accessibilityValue={{ min: 0, max: 100, now: score }}`, reads `Risk score: ${score} out of 100, risk category: WARNING`.
- **ExplanationList**: `accessibilityRole="summary"`, each factor row has `accessibilityRole="text"` reading the item (or simplified string if Senior Mode).
- **TTS Speaker Icon**: `accessibilityRole="button"`, toggles mute / replay with distinct state announcements (`Play spoken warning aloud` vs `Stop spoken warning`).
- **Action Buttons**:
  - `Cancel Transaction` (Amber, Primary dominant): `accessibilityRole="button"`, `accessibilityLabel="Cancel Transaction"`.
  - `Proceed Anyway` (Grey, Secondary): `accessibilityRole="button"`, `accessibilityLabel="Proceed Anyway"`.

---

### 🛑 `HoldScreen` (Tier: ADAPTIVE_HOLD)
- **Cooling-Off Timer Card**:
  - `accessibilityRole="timer"`
  - `accessibilityLiveRegion="assertive"`
  - `accessibilityLabel="Cooling-off countdown: ${secondsLeft} seconds remaining"`
  - Auto-cancels and announces alert when countdown reaches 0:00.
- **Step-Up Verification Keypad**: 4-digit OTP input with screen-reader feedback on every keypress.
- **Evidence Record Notice**: Informative screen reader notice explaining cryptographic tamper-proof logging.

---

### 🔒 `InterceptScreen` (Tier: HARD_INTERCEPT)
- **Lock Animation**: Visual pulsating lock with high-contrast `#DC2626` glow.
- **Live Status Line**:
  - `accessibilityRole="text"`
  - `accessibilityLiveRegion="polite"`
  - Dynamically speaks state transitions: `Calling trusted contact` → `Waiting for response` → `Transaction frozen. Bank alerted`.
- **Single Cancel Action**: Hard block without bypass routes back to PIN or Payment; screen reader informs user that payment has been safely cancelled.

---

### 👴 Senior Citizen Mode (`SeniorModeContext` & Components)
- **`useScaledFontSize(base)`**: Applies `1.5×` multiplier to all typography across the app.
- **`SeniorModeBanner`**: Root-level banner with `accessibilityRole="alert"` announcing active senior mode.
- **`EmergencyContactButton`**: Persistent FAB with `accessibilityRole="button"`, `accessibilityLabel="Call emergency family contact"`, dials user-specified phone or `112`.
- **`SettingsScreen`**: `accessibilityRole="switch"` with toggle announcements and emergency contact input field.

---

## 3. Testing & Verification Checklist

- [x] Verified with screen reader navigation flow (Focus order follows logical top-to-bottom layout).
- [x] High-contrast ratio (> 7:1) verified for all primary action buttons on dark backgrounds.
- [x] Zero inaccessible touch targets: Minimum touch target size ≥ 48x48dp.
- [x] Zero blocking modal traps in hard intercept state.
- [x] Tested fallback behavior when device TTS is muted or unavailable.
