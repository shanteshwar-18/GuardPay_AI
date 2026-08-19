"""Quick validation script for OCR, Coercion, Risk Fusion, and Behaviour modules."""
import sys
sys.path.insert(0, '.')

results = []

# --- OCR Engine ---
from backend.services.ocr_engine import analyze_screen
r = analyze_screen(text='CBI officer arrest warrant pay immediately money laundering')
ok = r['ocr_score'] > 0.2
print(f"OCR scam: score={r['ocr_score']} -- {'PASS' if ok else 'FAIL'}")
results.append(('OCR scam detection', ok))

r2 = analyze_screen(text='payment successful Rs 500 zomato food order delivered')
ok2 = r2['ocr_score'] < 0.2
print(f"OCR normal: score={r2['ocr_score']} -- {'PASS' if ok2 else 'FAIL'}")
results.append(('OCR normal (low score)', ok2))

# --- Coercion Engine ---
from models.coercion_engine import classify, _init_tfidf
_init_tfidf()
rc = classify('cbi officer you are under digital arrest transfer money now or face arrest warrant')
ok3 = rc['label'] == 'COERCIVE'
print(f"Coercion scam: label={rc['label']} score={round(rc['score'],3)} -- {'PASS' if ok3 else 'FAIL'}")
results.append(('Coercion COERCIVE', ok3))

rb = classify('payment successful zomato food order delivered thank you')
ok4 = rb['score'] < 0.35  # May be BENIGN or low-score uncertain — should not be high-confidence COERCIVE
print(f"Coercion benign: label={rb['label']} score={round(rb['score'],3)} -- {'PASS' if ok4 else 'FAIL'}")
results.append(('Coercion benign (low score)', ok4))

# --- Risk Fusion ---
from models.risk_fusion import fuse
safe = fuse({'voice_score': 0.05, 'coercion_score': 0.0, 'ocr_score': 0.0,
             'reputation_score': 0.0, 'new_beneficiary': 0, 'anomaly_score': 0.05})
red  = fuse({'voice_score': 0.95, 'coercion_score': 0.98, 'ocr_score': 0.9,
             'reputation_score': 0.8, 'new_beneficiary': 1, 'anomaly_score': 0.9})

ok5 = safe['risk_tier'] == 'ALLOWED'
ok6 = red['risk_tier']  == 'HARD_INTERCEPT'
print(f"Risk fusion safe: tier={safe['risk_tier']} score={safe['risk_score']} -- {'PASS' if ok5 else 'FAIL'}")
print(f"Risk fusion red:  tier={red['risk_tier']} score={red['risk_score']} -- {'PASS' if ok6 else 'FAIL'}")
top3 = [x['factor'] for x in red['shap_top3']]
print(f"SHAP top-3: {top3}")
results.append(('Risk fusion ALLOWED', ok5))
results.append(('Risk fusion HARD_INTERCEPT', ok6))

# Risk score increases monotonically with risk signals
ok7 = red['risk_score'] > safe['risk_score']
print(f"Risk score ordering (red > safe): {red['risk_score']} > {safe['risk_score']} -- {'PASS' if ok7 else 'FAIL'}")
results.append(('Risk score monotonic', ok7))

# --- Behaviour Analyzer ---
from models.behaviour_analyzer import score
duress = score({'screen_share_active': 1, 'tap_cadence_hz': 18.0,
                'app_switches_per_min': 30, 'payment_amount': 50000,
                'call_duration_sec': 300, 'typing_speed_cps': 0.8,
                'brightness_change': 0, 'volume_change': 0,
                'beneficiary_is_new': 1, 'time_since_last_txn_hr': 0.1})
normal = score({'screen_share_active': 0, 'tap_cadence_hz': 1.5,
                'app_switches_per_min': 2, 'payment_amount': 500,
                'call_duration_sec': 0, 'typing_speed_cps': 5.0,
                'brightness_change': 0, 'volume_change': 0,
                'beneficiary_is_new': 0, 'time_since_last_txn_hr': 24.0})
ok8 = duress['anomaly_score'] > normal['anomaly_score']
print(f"Behaviour duress={round(duress['anomaly_score'],3)} normal={round(normal['anomaly_score'],3)} -- {'PASS' if ok8 else 'FAIL'}")
results.append(('Behaviour anomaly ordering', ok8))

# --- Summary ---
passed = sum(1 for _, ok in results if ok)
total  = len(results)
print(f"\n{'='*55}")
print(f"  Module validation: {passed}/{total} PASS")
for label, ok in results:
    print(f"    {'PASS' if ok else 'FAIL'}  {label}")
print('='*55)
sys.exit(0 if passed == total else 1)
