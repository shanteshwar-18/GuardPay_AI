# GuardPay AI — Frontend Final Submission Checklist
# Prompt 14 · Phase 12 · Nikita/Frontend

---

## Pre-Submission Checks

### ✅ No Hardcoded Secrets
- [ ] Search `/src` for hardcoded API keys or credentials
- [ ] Confirm `config.ts` uses only placeholder constants (no real tokens)
- [ ] Confirm `.gitignore` covers `.env` files

```bash
# Run this to verify — should return 0 results
grep -r "sk-\|api_key\|secret\|password" src/ --include="*.ts" --include="*.tsx"
```

### ✅ UI Test Suite Passes
```bash
npx jest --ci
# Expected: 0 failures, all 15 tests green
```

### ✅ All Screens Render Without Warnings
Check each screen for console warnings in DEV build:
- [ ] HomeScreen — balance card, transactions list, Send Money CTA
- [ ] BeneficiaryScreen — known payee (no badge), unknown payee (NEW badge)
- [ ] AmountScreen — amount-in-words updates live
- [ ] RiskEvalScreen — spinner animates, TODO comment in place for Section 6
- [ ] PinScreen — 6-dot PIN pad, success flow, ALLOWED_GREEN theme
- [ ] WarningScreen — risk gauge, SHAP list sorted desc, Proceed + Cancel
- [ ] InterceptScreen — full red lock, pulsing icon, Cancel only (no PIN path)
- [ ] HoldScreen — stub screen with Raghav's TODO note

### ✅ SHAP Explanation Renders at Variable Lengths
- [ ] Pass 1-item explanation array → renders correctly
- [ ] Pass 3-item explanation array → renders correctly (standard case)
- [ ] Pass 6-item explanation array → scrollable, no overflow

### ✅ Multilingual Text
- [ ] EN: warning.mainMessage resolves with correct interpolation
- [ ] HI: हिंदी warning text visible
- [ ] MR: मराठी warning text visible
- [ ] TA: தமிழ் warning text visible

### ✅ Screenshot Harness (dev-only)
- [ ] ScreenshotHarness route only present when `__DEV__ === true`
- [ ] All 10 scenarios reachable from the harness menu
- [ ] Capture screenshots to `/docs/screenshots/` per checklist

### ✅ Git History
- [ ] `git log --oneline` shows all 20 commits from Nikita
- [ ] At least one commit within last 2 hours of submission window
- [ ] `git log --author=Nikita` shows correct authorship

### ✅ Branch Status
- [ ] `nikita/frontend` is up-to-date with `origin/nikita/frontend`
- [ ] No uncommitted changes (`git status` = clean)
- [ ] PR ready to merge into `dev`

---

## Merge Sequence (Prompt 11 → Prompt 14)

```bash
# Step 1: Ensure local nikita/frontend is clean and pushed
git status                          # must be clean
git push origin nikita/frontend     # confirm up-to-date

# Step 2: Switch to dev and pull latest
git checkout dev
git pull origin dev

# Step 3: Merge nikita/frontend into dev
git merge nikita/frontend --no-ff -m "chore: merge nikita/frontend into dev"

# Step 4: Resolve any conflicts (navigation types, theme colors, RiskFactorList)
# Then:
git push origin dev

# Step 5: Tag Nikita's final commit
git tag -a nikita-final -m "Nikita frontend complete — Prompts 1-14 done"
git push origin nikita-final
```

---

## File Coverage Map (all 36 files on nikita/frontend)

| File | Prompt | Committed |
|---|---|---|
| `App.tsx` | P1 | ✅ `890cc8c` |
| `package.json` | P1 + fix | ✅ `1e81dbc` |
| `tsconfig.json` | P1 | ✅ `890cc8c` |
| `babel.config.js` | Config | ✅ `1e81dbc` |
| `metro.config.js` | Config | ✅ `1e81dbc` |
| `.eslintrc.js` | Config | ✅ `1e81dbc` |
| `.gitignore` | Config | ✅ `1e81dbc` |
| `jest.config.js` | Config | ✅ `1e81dbc` |
| `src/theme/colors.ts` | P1 | ✅ `890cc8c` |
| `src/services/config.ts` | P1 | ✅ `890cc8c` |
| `src/services/format.ts` | P3 | ✅ `890cc8c` |
| `src/services/tts.ts` | P8 | ✅ `c939757` |
| `src/services/audioStream.ts` | P10 | ✅ `69feb55` |
| `src/services/languageState.tsx` | P8 | ✅ `c939757` |
| `src/types/navigation.ts` | P2 | ✅ `1faf242` |
| `src/mock/mockData.ts` | P2 | ✅ `a212b08` |
| `src/i18n/index.ts` | P8 | ✅ `c939757` |
| `src/i18n/translations.ts` | P8 | ✅ `c939757` |
| `src/navigation/AppNavigator.tsx` | P2 + P13 | ✅ `3dc8ac6` |
| `src/components/RiskFactorList.tsx` | P7 | ✅ `69236dc` |
| `src/components/SimulatedCallBanner.tsx` | P2 | ✅ `5bbc1ab` |
| `src/screens/HomeScreen.tsx` | P3 | ✅ `db7625a` |
| `src/screens/PinScreen.tsx` | P3 | ✅ `db7625a` |
| `src/screens/BeneficiaryScreen.tsx` | P4 | ✅ `9fff9e7` |
| `src/screens/AmountScreen.tsx` | P4 | ✅ `4472c59` |
| `src/screens/RiskEvalScreen.tsx` | P5+P9 | ✅ `da7c3d9` |
| `src/screens/WarningScreen.tsx` | P6 | ✅ `092ff55` |
| `src/screens/InterceptScreen.tsx` | P7 | ✅ `4de3570` |
| `src/screens/HoldScreen.tsx` | Stub | ✅ `890cc8c` |
| `src/screens/__dev__/ScreenshotHarness.tsx` | P13 | ✅ `3dc8ac6` |
| `src/screens/__tests__/PaymentFlow.test.tsx` | P12 | ✅ `1e81dbc` |
| `src/__mocks__/axios.ts` | P12 | ✅ `1e81dbc` |
| `src/__mocks__/audioStream.ts` | P12 | ✅ `1e81dbc` |
| `src/__mocks__/react-native-tts.ts` | P12 | ✅ `1e81dbc` |
| `src/__mocks__/async-storage.ts` | P12 | ✅ `1e81dbc` |
| `docs/screenshot-checklist.md` | P13 | ✅ `890cc8c` |

**Total: 36 files, 20 commits, all on `nikita/frontend`**

---

## Nikita's Speaking Points (Demo Narration)

> "Every screen adds friction exactly in proportion to risk — nothing more.
> Known payee, low amount → straight to PIN, zero interruption.
> The moment risk rises: amber Warning card with the actual SHAP-ranked factors,
> in the victim's own language — Hindi, Marathi, Tamil, or English.
> If it's critical: the Intercept screen locks it outright, literally no path
> back to the PIN pad, while a real call goes to the trusted contact."

Point to:
1. **NEW badge** on BeneficiaryScreen (first-time payee)
2. **Risk gauge + SHAP list** on WarningScreen
3. **Locked Cancel-only** state on InterceptScreen
