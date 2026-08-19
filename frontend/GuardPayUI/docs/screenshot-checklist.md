# Screenshot Checklist — GuardPay AI Demo

This checklist captures every screen + state combination needed for the slide deck
"Demo Screenshots" section and README. Capture in this exact order using the
ScreenshotHarness (`/src/screens/__dev__/ScreenshotHarness.tsx`).

---

## Required Screenshots

| # | Filename | Screen | State / Params | Notes |
|---|---|---|---|---|
| 01 | `01-home.png` | HomeScreen | Default (idle) | Show balance + recent txns |
| 02 | `02-beneficiary-known.png` | BeneficiaryScreen | Known UPI ID (e.g. `rahul@okaxis`) | No NEW badge |
| 03 | `03-beneficiary-new.png` | BeneficiaryScreen | Unknown UPI ID (e.g. `scammer@ybl`) | **NEW badge visible** |
| 04 | `04-amount.png` | AmountScreen | Amount = ₹25,000, note set | Amount-in-words visible |
| 05 | `05-riskeval.png` | RiskEvalScreen | Loading state (spinner) | Shows AI signal pills |
| 06 | `06-pin.png` | PinScreen | Risk < 40, ALLOWED | No friction, clean PIN pad |
| 07 | `07-warning-shap.png` | WarningScreen | riskScore=58, 3 SHAP factors | **KEY DEMO SCREEN** |
| 08 | `08-intercept-lock.png` | InterceptScreen | riskScore=94, locked | **KEY DEMO SCREEN — no PIN path** |
| 09 | `09-warning-hindi.png` | WarningScreen | Hindi language, riskScore=62 | Multilingual demo |
| 10 | `10-call-banner.png` | Any screen | SimulatedCallBanner visible | Shows fraud call overlay |

---

## Slide Deck Mapping

| Slide | Screenshot |
|---|---|
| Problem statement | `03-beneficiary-new.png` |
| Risk tier demo | `07-warning-shap.png` |
| Hard intercept | `08-intercept-lock.png` |
| Multilingual support | `09-warning-hindi.png` |
| Green path (safe) | `06-pin.png` |

---

> **Note**: Screenshots saved to `/docs/screenshots/` directory.
> Capture using the ScreenshotHarness (dev-only route, not in Release builds).
