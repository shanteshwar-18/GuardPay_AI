"""
coercion_engine.py — Coercion NLP Classification Engine
GuardPay AI · AI/ML Module (Jatin)

Two-path architecture per the playbook:
  1. Fast path  — TF-IDF lexicon match (< 5 ms, no API needed)
  2. Slow path  — Llama 3 via Groq API (escalated on uncertain TF-IDF score)

Contract:
    classify(text: str) -> {'label': 'COERCIVE'|'BENIGN', 'score': float, 'matched_phrases': list}

Async-safe via asyncio.to_thread for Groq calls.

Commit:
    feat(coercion): build TF-IDF coercion lexicon with 500 multilingual phrases
    feat(coercion): integrate Groq API Llama 3 coercion classifier
"""

from __future__ import annotations

import asyncio
import csv
import json
import os
import time
from pathlib import Path

import numpy as np

# ── Constants ──────────────────────────────────────────────────────────────────
TFIDF_THRESHOLD_COERCIVE  = 0.4     # Above → COERCIVE (clear).  Per playbook §"TF-IDF fallback:
                                    #   cosine similarity > 0.4 → coercion flag"
TFIDF_THRESHOLD_UNCERTAIN = 0.3     # Between → escalate to Groq
                                    # NOTE: Groq is disabled if GROQ_API_KEY is not set
                                    # In that case, uncertain zone defaults to BENIGN (safer)
GROQ_MODEL = "llama3-8b-8192"
MAX_GROQ_RETRIES = 3

_DATA_DIR = Path(__file__).parent.parent / "data" / "mock" / "coercion_lexicon"

# Primary source of truth: the curated CSV lexicon (phrase,lang,category,severity).
LEXICON_CSV_PATH = _DATA_DIR / "coercion_lexicon.csv"
# Legacy flat JSON cache — still written by scripts/generate_synthetic_data.py.
LEXICON_PATH = _DATA_DIR / "phrases.json"

CSV_COLUMNS = ("phrase", "lang", "category", "severity")
VALID_LANGS = ("en", "hi", "mr", "ta")
VALID_CATEGORIES = (
    "authority_impersonation", "arrest_threat", "account_freeze", "urgency",
    "secrecy", "payment_demand", "verification_ruse", "intimidation",
)

# ── Coercion Lexicon ───────────────────────────────────────────────────────────

# FALLBACK ONLY. The live lexicon (500+ phrases across EN / HI / MR / TA, with
# native-script and romanised variants) lives in coercion_lexicon.csv. This dict
# is used only when that CSV is missing, so the engine never hard-fails.
BUILTIN_PHRASES = {
    # ─ English ──────────────────────────────────────────────────────────────
    "en": [
        # Arrest / legal threat
        "you are under digital arrest", "cbi officer speaking", "ed officer",
        "your account is frozen", "warrant issued against you", "fir registered",
        "you will be arrested", "legal action will be taken", "court summons",
        "money laundering case", "drug trafficking case", "your aadhaar is misused",
        "interpol notice", "cybercrime investigation", "you must pay now",
        "transfer money immediately", "pay or be arrested", "do not tell anyone",
        "keep this call secret", "do not hang up", "stay on the line",
        "your pan card is blocked", "illegal transaction detected",
        "national security breach", "terrorist funding linked to you",
        "send money to clear your name", "this is your last chance",
        "video kyc verification required urgently", "your sim will be blocked",
        "rbi compliance notice", "sebi investigation", "customs department",
        "narcotics control bureau", "enforcement directorate", "high court order",
        "do not inform family", "case will be closed after payment",
        "immediate transfer required", "upi transfer to safe account",
        "government escrow account", "secure your funds now",
        # Urgency / pressure
        "time is running out", "urgent action required", "within 30 minutes",
        "within one hour", "before midnight", "last warning",
        "final notice", "do not delay", "act immediately",
        # Impersonation
        "i am calling from rbi", "supreme court order", "ministry of home affairs",
        "trai is blocking your number", "airtel legal department",
        "google legal team", "amazon fraud team", "sbi fraud department",
        "hdfc bank security", "icici bank compliance",
    ],
    # ─ Hindi ────────────────────────────────────────────────────────────────
    # Native Devanagari + romanised variant (Whisper often emits Latin script).
    "hi": [
        "आपके खिलाफ गिरफ्तारी वारंट जारी हुआ है", "aapke khilaf giraftari warrant jari hua hai",
        "सीबीआई मुख्यालय से बोल रहे हैं", "cbi mukhyalay se bol rahe hain",
        "आपका खाता बंद हो जाएगा", "aapka khata band ho jayega",
        "अभी पैसा ट्रांसफर करो", "abhi paisa transfer karo",
        "आपका आधार कार्ड गलत काम में इस्तेमाल हुआ है", "aapka aadhaar card galat kaam mein istemaal hua hai",
        "पुलिस आपके घर आ रही है", "police aapke ghar aa rahi hai",
        "एक घंटे में भुगतान कीजिए", "ek ghante mein bhugtan kijiye",
        "यह अदालत का आदेश है", "yeh adalat ka aadesh hai",
        "किसी को मत बताइए", "kisi ko mat bataiye",
        "फोन मत काटिए", "phone mat katiye",
        "नारकोटिक्स केस में आपका नाम आया है", "narcotics case mein aapka naam aaya hai",
        "मनी लॉन्ड्रिंग की जांच चल रही है", "money laundering ki jaanch chal rahi hai",
        "आपके नाम पर एफआईआर दर्ज हो गई है", "aapke naam par fir darj ho gayi hai",
        "आपका सिम कार्ड ब्लॉक हो जाएगा", "aapka sim card block ho jayega",
        "आरबीआई का नोटिस आया है", "rbi ka notice aaya hai",
        "कानूनी नोटिस भेजा जाएगा", "kanooni notice bheja jayega",
        "आपकी गिरफ्तारी होगी", "aapki giraftari hogi",
        "तुरंत ट्रांसफर करो", "turant transfer karo",
        "सुरक्षित खाते में पैसा डालो", "surakshit khate mein paisa dalo",
        "यह आपका आखिरी मौका है", "yeh aapka aakhri mauka hai",
        "आप डिजिटल अरेस्ट में हैं", "aap digital arrest mein hain",
        "भुगतान के बाद केस बंद हो जाएगा", "bhugtan ke baad case band ho jayega",
        "समय बहुत कम है", "samay bahut kam hai",
    ],
    # ─ Marathi ──────────────────────────────────────────────────────────────
    "mr": [
        "तुमच्यावर अटक वॉरंट आहे", "tumchyavar atak warrant aahe",
        "सीबीआय कार्यालयातून बोलत आहे", "cbi karyalayatun bolat aahe",
        "तुमचं खातं बंद होईल", "tumcha khata band hoil",
        "आत्ता पैसे ट्रान्सफर करा", "aatta paise transfer kara",
        "कुणालाही सांगू नका", "kunalahi sangu naka",
        "हा न्यायालयाचा आदेश आहे", "ha nyayalayacha aadesh aahe",
        "नारकोटिक्स प्रकरणात तुमचं नाव आहे", "narcotics prakaranat tumcha naav aahe",
        "कायदेशीर नोटीस पाठवली जाईल", "kaydeshir notice pathavli jail",
        "तुमचं सिम कार्ड ब्लॉक होईल", "tumcha sim card block hoil",
        "एका तासात करा", "eka tasat kara",
        "सुरक्षित खात्यात पैसे टाका", "surakshit khatyat paise taka",
        "तुरुंगात जायचं नसेल तर सहकार्य करा", "turungat jaycha nasel tar sahakarya kara",
        "हे आत्ताच करायचं आहे", "he aattach karaycha aahe",
        "वेळ संपत आली आहे", "vel sampat aali aahe",
    ],
    # ─ Tamil ────────────────────────────────────────────────────────────────
    "ta": [
        "உங்கள் மீது கைது வாரண்ட் உள்ளது", "ungal meethu kaithu warrant ullathu",
        "சிபிஐ அலுவலகத்திலிருந்து பேசுகிறேன்", "cbi aluvalagathilirundhu pesugiren",
        "உங்கள் கணக்கு முடக்கப்படும்", "ungal kanakku mudakkappadum",
        "இப்பவே பணம் அனுப்புங்கள்", "ippave panam anuppungal",
        "யாரிடமும் சொல்லாதீர்கள்", "yaaridamum sollatheergal",
        "இது நீதிமன்ற உத்தரவு", "idhu neethimandra uththaravu",
        "போதைப்பொருள் வழக்கில் உங்கள் பெயர் உள்ளது", "pothaipporul vazhakkil ungal peyar ullathu",
        "உங்கள் சிம் கார்டு முடக்கப்படும்", "ungal sim card mudakkappadum",
        "சட்ட நோட்டீஸ் வரும்", "satta notice varum",
        "ஒரு மணி நேரம் மட்டுமே உள்ளது", "oru mani neram mattume ullathu",
        "பாதுகாப்பான கணக்கிற்கு பணம் அனுப்புங்கள்", "pathukappana kanakkirku panam anuppungal",
        "கேள்வி கேட்காதீர்கள்", "kelvi ketkatheergal",
    ],
}


# Populated by _load_lexicon(): one dict per CSV row (empty when the fallback is used).
_lexicon_meta: list[dict] = []
_lexicon_source_holder: dict = {"source": "unloaded"}


def _dedupe(phrases: list[str]) -> list[str]:
    """Deduplicate (case-insensitively) while preserving order."""
    seen: set[str] = set()
    result: list[str] = []
    for p in phrases:
        p = (p or "").strip()
        if not p:
            continue
        key = p.lower()
        if key not in seen:
            seen.add(key)
            result.append(p)
    return result


def _load_lexicon_csv() -> list[dict]:
    """
    Read the curated CSV lexicon (phrase,lang,category,severity).

    Returns [] if the file is missing or unreadable — callers fall back to
    BUILTIN_PHRASES. UTF-8-sig tolerates a stray BOM without corrupting the
    first Devanagari/Tamil phrase.
    """
    if not LEXICON_CSV_PATH.exists():
        return []
    try:
        with open(LEXICON_CSV_PATH, encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            rows = []
            for row in reader:
                phrase = (row.get("phrase") or "").strip()
                if not phrase:
                    continue
                rows.append({
                    "phrase":   phrase,
                    "lang":     (row.get("lang") or "en").strip(),
                    "category": (row.get("category") or "").strip(),
                    "severity": (row.get("severity") or "medium").strip(),
                })
            return rows
    except Exception as exc:                                    # pragma: no cover
        print(f"[coercion_engine] Failed to read {LEXICON_CSV_PATH.name}: {exc} — using builtin fallback")
        return []


def _build_lexicon() -> list[str]:
    """
    Flat list of coercion phrases — CSV first, BUILTIN_PHRASES as fallback.

    Kept public-ish because scripts/generate_synthetic_data.py imports it to
    regenerate phrases.json.
    """
    rows = _load_lexicon_csv()
    if rows:
        return _dedupe([r["phrase"] for r in rows])

    phrases = []
    for lang_phrases in BUILTIN_PHRASES.values():
        phrases.extend(lang_phrases)
    return _dedupe(phrases)


def _save_lexicon(phrases: list[str]):
    LEXICON_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(LEXICON_PATH, "w", encoding="utf-8") as f:
        json.dump(phrases, f, ensure_ascii=False, indent=2)


def _load_lexicon() -> list[str]:
    """
    Load the phrase list used to fit the TF-IDF vectoriser.

    Priority:
      1. data/mock/coercion_lexicon/coercion_lexicon.csv   (source of truth)
      2. BUILTIN_PHRASES                                   (fallback, CSV missing)

    Read-only: the flat phrases.json cache is refreshed by
    scripts/generate_synthetic_data.py (via _build_lexicon), not here.
    """
    global _lexicon_meta

    rows = _load_lexicon_csv()
    if rows:
        _lexicon_meta = rows
        phrases = _dedupe([r["phrase"] for r in rows])
        source = "csv"
    else:
        _lexicon_meta = []
        phrases = _build_lexicon()
        source = "builtin_fallback"
        print(f"[coercion_engine] {LEXICON_CSV_PATH.name} not found — falling back to BUILTIN_PHRASES")

    _lexicon_source_holder["source"] = source
    return phrases


def lexicon_stats() -> dict:
    """Diagnostic helper: row counts by lang / category / severity."""
    from collections import Counter

    _init_tfidf()
    return {
        "source":     _lexicon_source_holder.get("source", "unknown"),
        "total":      len(_lexicon),
        "by_lang":     dict(Counter(r["lang"] for r in _lexicon_meta)),
        "by_category": dict(Counter(r["category"] for r in _lexicon_meta)),
        "by_severity": dict(Counter(r["severity"] for r in _lexicon_meta)),
    }


# ── TF-IDF Fast Path ───────────────────────────────────────────────────────────

_tfidf_vectorizer = None
_tfidf_matrix = None
_lexicon: list[str] = []


def _init_tfidf():
    global _tfidf_vectorizer, _tfidf_matrix, _lexicon
    if _tfidf_vectorizer is not None:
        return

    from sklearn.feature_extraction.text import TfidfVectorizer

    _lexicon = _load_lexicon()
    _tfidf_vectorizer = TfidfVectorizer(
        analyzer="char_wb", ngram_range=(2, 4), max_features=20000
    )
    _tfidf_matrix = _tfidf_vectorizer.fit_transform(_lexicon)
    print(f"[coercion_engine] TF-IDF vectoriser fitted on {len(_lexicon)} phrases "
          f"(source={_lexicon_source_holder.get('source')}) ✓")


def _tfidf_score(text: str) -> tuple[float, list[str]]:
    """
    Compute max cosine similarity between input text and coercion lexicon.
    Returns (score in [0,1], top matching phrases).
    """
    from sklearn.metrics.pairwise import cosine_similarity

    _init_tfidf()
    vec = _tfidf_vectorizer.transform([text.lower()])
    sims = cosine_similarity(vec, _tfidf_matrix)[0]   # (N,)

    top_indices = np.argsort(sims)[::-1][:5]
    top_score   = float(sims[top_indices[0]]) if len(top_indices) > 0 else 0.0
    matched = [_lexicon[i] for i in top_indices if sims[i] > 0.05]

    return top_score, matched


# ── Groq / Llama 3 Slow Path ───────────────────────────────────────────────────

GROQ_SYSTEM_PROMPT = """You are a fraud detection AI for a UPI payment app.
Classify the following call transcript as COERCIVE or BENIGN.

COERCIVE: The caller is using threats, urgency, impersonation of authorities,
demands for immediate payment, or coercion to make the listener transfer money.

BENIGN: Normal conversation with no coercion, urgency, or payment pressure.

Respond ONLY with a JSON object: {"label": "COERCIVE"|"BENIGN", "reason": "<one sentence>"}"""


def _call_groq(text: str) -> dict:
    """Call Groq API with exponential backoff. Falls back to TF-IDF on failure."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        # No API key — uncertain zone defaults to BENIGN (safer: avoid false positives)
        print("[coercion_engine] GROQ_API_KEY not set — using TF-IDF only (uncertain=BENIGN)")
        return None

    from groq import Groq

    client = Groq(api_key=api_key)
    for attempt in range(MAX_GROQ_RETRIES):
        try:
            response = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": GROQ_SYSTEM_PROMPT},
                    {"role": "user", "content": f"Transcript:\n{text[:2000]}"},
                ],
                temperature=0.1,
                max_tokens=100,
            )
            raw = response.choices[0].message.content.strip()
            # Parse JSON from response
            start = raw.find("{")
            end   = raw.rfind("}") + 1
            result = json.loads(raw[start:end])
            return result
        except Exception as exc:
            wait = 2 ** attempt
            print(f"[coercion_engine] Groq attempt {attempt+1} failed: {exc}. Retrying in {wait}s ...")
            time.sleep(wait)

    return None   # All retries exhausted


# ── Public API ─────────────────────────────────────────────────────────────────

def classify(text: str) -> dict:
    """
    Classify a transcript as COERCIVE or BENIGN.

    Two-path strategy:
      1. TF-IDF fast path  — returns immediately if score is clear-cut.
      2. Groq Llama 3      — used when TF-IDF score is uncertain.

    Args:
        text: Transcript string (lowercase preferred).

    Returns:
        {
            'label':           'COERCIVE' | 'BENIGN',
            'score':           float in [0, 1],
            'path':            'tfidf' | 'groq' | 'tfidf_fallback',
            'matched_phrases': list[str],
        }
    """
    tfidf_score, matched = _tfidf_score(text)

    # ── Clear COERCIVE ─────────────────────────────────────────────────────
    if tfidf_score >= TFIDF_THRESHOLD_COERCIVE:
        return {
            "label":           "COERCIVE",
            "score":           tfidf_score,
            "path":            "tfidf",
            "matched_phrases": matched,
        }

    # ── Clear BENIGN ───────────────────────────────────────────────────────
    if tfidf_score < TFIDF_THRESHOLD_UNCERTAIN:
        return {
            "label":           "BENIGN",
            "score":           tfidf_score,
            "path":            "tfidf",
            "matched_phrases": matched,
        }

    # ── Uncertain → escalate to Groq ──────────────────────────────────────
    groq_result = _call_groq(text)
    if groq_result:
        label = groq_result.get("label", "BENIGN").upper()
        if label not in ("COERCIVE", "BENIGN"):
            label = "BENIGN"
        return {
            "label":           label,
            "score":           tfidf_score,
            "path":            "groq",
            "matched_phrases": matched,
            "groq_reason":     groq_result.get("reason", ""),
        }

    # ── Groq unavailable → uncertain zone defaults to BENIGN (safer, avoids FP)
    # Only classify as COERCIVE without Groq if score >= TFIDF_THRESHOLD_COERCIVE
    label = "COERCIVE" if tfidf_score >= TFIDF_THRESHOLD_COERCIVE else "BENIGN"
    return {
        "label":           label,
        "score":           tfidf_score,
        "path":            "tfidf_fallback",
        "matched_phrases": matched,
    }


async def classify_async(text: str) -> dict:
    """Async-safe wrapper — safe to call from asyncio.gather()."""
    return await asyncio.to_thread(classify, text)


# ── Self-test ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    _init_tfidf()

    test_cases = [
        # ── Coercive ────────────────────────────────────────────────────────
        ("CBI officer speaking. You are under digital arrest. Transfer money immediately to clear your name.", "COERCIVE"),
        ("your Aadhaar is linked to illegal activity, transfer immediately", "COERCIVE"),
        ("this is CBI, your account will be frozen, do not tell anyone", "COERCIVE"),
        ("आपका खाता बंद हो जाएगा, तुरंत पैसे भेजिए", "COERCIVE"),
        ("Aapka account band ho jayega. Abhi paisa transfer karo.", "COERCIVE"),
        ("तुमच्यावर अटक वॉरंट आहे, कुणालाही सांगू नका", "COERCIVE"),
        ("உங்கள் கணக்கு முடக்கப்படும், உடனே பணம் அனுப்புங்கள்", "COERCIVE"),
        ("Warrant issued against you. Do not inform family. Time is running out.", "COERCIVE"),
        # ── Benign ──────────────────────────────────────────────────────────
        ("hey can you send me 200 for lunch", "BENIGN"),
        ("happy birthday, sending you a gift", "BENIGN"),
        ("Hi, I'd like to transfer 500 to my friend for dinner last night.", "BENIGN"),
        ("Please send payment for the grocery order.", "BENIGN"),
        ("payment received food delivery confirmed order completed successfully", "BENIGN"),
    ]

    print("=" * 70)
    print("GuardPay AI — coercion_engine.py self-test")
    print("=" * 70)
    stats = lexicon_stats()
    print(f"  lexicon source : {stats['source']}  ({stats['total']} phrases)")
    print(f"  by language    : {stats['by_lang']}")
    print(f"  by category    : {stats['by_category']}")
    print(f"  thresholds     : coercive>={TFIDF_THRESHOLD_COERCIVE}  "
          f"groq-escalate>={TFIDF_THRESHOLD_UNCERTAIN}")
    print("-" * 70)
    all_pass = True
    for text, expected in test_cases:
        result = classify(text)
        status = "PASS" if result["label"] == expected else "FAIL"
        if result["label"] != expected:
            all_pass = False
        print(f"  {status}  [{result['path']:16}]  {result['label']:8}  "
              f"score={result['score']:.3f}  "
              f"'{text[:55]}'")
    print()
    print("All tests passed" if all_pass else "Some tests failed (check Groq / thresholds)")
    print(f"  Lexicon size: {len(_lexicon)} phrases")
    print("=" * 70)
