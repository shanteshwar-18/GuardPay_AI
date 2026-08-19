"""
Phase 8 Integration Smoke Test
Tests the full AI pipeline as Shanteshwar's backend calls it.
"""
import sys, io, asyncio
sys.path.insert(0, '.')

import numpy as np
import soundfile as sf

# Generate a synthetic 1-second 440Hz sine wave WAV
t = np.linspace(0, 1.0, 16000, endpoint=False)
audio = (0.3 * np.sin(2 * 3.14159 * 440 * t)).astype('float32')
buf = io.BytesIO()
sf.write(buf, audio, 16000, format='WAV')
WAV_BYTES = buf.getvalue()   # bytes — passed directly, NOT nested BytesIO

results = []

# ── Test 1: CNN audio_analyzer ────────────────────────────────────────────────
print("\n[1] CNN audio_analyzer...")
from models.audio_analyzer import analyze_sync
r1 = analyze_sync(WAV_BYTES)
ok1 = 'spoof_probability' in r1 and 0.0 <= r1['spoof_probability'] <= 1.0
print(f"    spoof_probability={r1['spoof_probability']:.4f} -- {'PASS' if ok1 else 'FAIL'}")
results.append(('CNN audio_analyzer', ok1))

# ── Test 2: Coercion engine ───────────────────────────────────────────────────
print("\n[2] Coercion engine...")
from models.coercion_engine import classify
r2 = classify('cbi officer you are under digital arrest transfer money now or face arrest')
ok2 = r2['label'] == 'COERCIVE' and r2['score'] > 0.3
print(f"    label={r2['label']} score={r2['score']:.3f} -- {'PASS' if ok2 else 'FAIL'}")
results.append(('Coercion engine', ok2))

# ── Test 3: OCR engine ────────────────────────────────────────────────────────
print("\n[3] OCR engine...")
from backend.services.ocr_engine import analyze_screen
r3 = analyze_screen(text='CBI officer arrest warrant pay immediately money laundering')
ok3 = r3['ocr_score'] > 0.2
print(f"    ocr_score={r3['ocr_score']} -- {'PASS' if ok3 else 'FAIL'}")
results.append(('OCR engine', ok3))

# ── Test 4: Behaviour analyzer ────────────────────────────────────────────────
print("\n[4] Behaviour analyzer...")
from models.behaviour_analyzer import score
r4 = score({'screen_share_active':1,'tap_cadence_hz':18,'payment_amount':50000,
            'call_duration_sec':300,'app_switches_per_min':30,'typing_speed_cps':1,
            'brightness_change':0,'volume_change':0,'beneficiary_is_new':1,
            'time_since_last_txn_hr':0.1})
ok4 = r4['anomaly_score'] > 0.5 and r4['is_anomaly']
print(f"    anomaly_score={r4['anomaly_score']:.3f} is_anomaly={r4['is_anomaly']} -- {'PASS' if ok4 else 'FAIL'}")
results.append(('Behaviour analyzer', ok4))

# ── Test 5: Risk fusion ───────────────────────────────────────────────────────
print("\n[5] Risk fusion (6-factor SHAP)...")
from models.risk_fusion import fuse
rf = fuse({'voice_score': r1['spoof_probability'],
           'coercion_score': r2['score'],
           'ocr_score': r3['ocr_score'],
           'reputation_score': 0.5,
           'new_beneficiary': 1,
           'anomaly_score': r4['anomaly_score']})
ok5 = rf['risk_tier'] in ('WARNING', 'ELEVATED', 'HARD_INTERCEPT', 'ALLOWED')
ok5 = ok5 and 0 <= rf['risk_score'] <= 100
print(f"    tier={rf['risk_tier']} score={rf['risk_score']} shap_top1={rf['shap_top3'][0]['factor']} -- {'PASS' if ok5 else 'FAIL'}")
results.append(('Risk fusion', ok5))

# ── Test 6: Full async pipeline via ai_stubs ──────────────────────────────────
print("\n[6] Full async pipeline (ai_stubs asyncio.gather)...")
import base64
WAV_B64 = base64.b64encode(WAV_BYTES).decode('utf-8')

async def test_pipeline():
    from backend.services.ai_stubs import analyze_audio, transcribe_audio, detect_coercion, analyze_behaviour
    voice, transcript, coercion, behaviour = await asyncio.gather(
        analyze_audio(WAV_B64),   # ai_stubs expects base64-encoded audio
        transcribe_audio(WAV_B64),
        detect_coercion('cbi officer digital arrest transfer money now'),
        analyze_behaviour({'screen_share_active':1,'tap_cadence_hz':15,'payment_amount':50000,
                           'call_duration_sec':300,'app_switches_per_min':20,'typing_speed_cps':1,
                           'brightness_change':0,'volume_change':0,'beneficiary_is_new':1,
                           'time_since_last_txn_hr':0.1}),
    )
    # voice=float, transcript=str, coercion=float, behaviour=float
    print(f"    voice_spoof_prob={voice:.4f}")
    print(f"    transcript='{str(transcript)[:60]}'")
    print(f"    coercion_score={coercion:.4f}")
    beh_score = behaviour if isinstance(behaviour, float) else behaviour.get('anomaly_score', 0.0)
    print(f"    behaviour_anomaly={beh_score:.3f}")
    ok = (isinstance(voice, float) and 0.0 <= voice <= 1.0 and
          isinstance(transcript, str) and
          isinstance(coercion, float) and
          isinstance(beh_score, float))
    print(f"    Full pipeline -- {'PASS' if ok else 'FAIL'}")
    return ok

ok6 = asyncio.run(test_pipeline())
results.append(('Full async pipeline', ok6))

# ── Summary ───────────────────────────────────────────────────────────────────
passed = sum(1 for _, ok in results if ok)
total  = len(results)
print(f"\n{'='*60}")
print(f"  Phase 8 Smoke Test: {passed}/{total} PASS")
for label, ok in results:
    print(f"    {'PASS' if ok else 'FAIL'}  {label}")
print('='*60)
sys.exit(0 if passed == total else 1)
