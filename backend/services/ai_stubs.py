"""
GuardPay AI — Stub Services for AI modules
These stubs return safe defaults so the backend runs end-to-end
before Jatin's models are merged. Each stub has a clear TODO.
"""

# ─────────────────────────────────────────────────────────────────────────────
# audio_analyzer.py stub
# TODO Jatin (Phase 2/7): Replace with CNN voice-clone detector
# ─────────────────────────────────────────────────────────────────────────────

async def analyze_audio(audio_base64: str | None) -> float:
    """
    Returns spoof_probability: 0.0 (real voice) to 1.0 (synthetic voice).
    STUB — real implementation: CNN on 128x128 Mel-spectrogram (voice_cnn.pt)
    """
    if not audio_base64:
        return 0.0
    # TODO: decode → librosa MFCC+spectrogram → CNN inference → return sigmoid output
    return 0.0  # safe default stub


# ─────────────────────────────────────────────────────────────────────────────
# transcriber.py stub
# TODO Jatin (Phase 7): Replace with openai-whisper tiny model
# ─────────────────────────────────────────────────────────────────────────────

async def transcribe_audio(audio_base64: str | None) -> str:
    """
    Returns transcript string from 3-second PCM chunk.
    STUB — real implementation: whisper.load_model('tiny').transcribe(audio_path)
    """
    if not audio_base64:
        return ""
    # TODO: decode PCM → save temp WAV → whisper transcribe → return text
    return ""


# ─────────────────────────────────────────────────────────────────────────────
# coercion_engine.py stub
# TODO Jatin (Phase 4.1/7): Groq Llama 3 NLP coercion classification
# ─────────────────────────────────────────────────────────────────────────────

COERCION_KEYWORDS = [
    "arrest", "CBI", "ED", "police", "court", "warrant",
    "account freeze", "RBI", "illegal", "immediate transfer",
    "गिरफ्तार", "खाता बंद", "तुरंत", "जुर्माना",  # Hindi
    "अटक", "खाते गोठवा",                            # Marathi
]


async def detect_coercion(transcript: str) -> float:
    """
    Returns coercion_score: 0.0 (normal) to 1.0 (highly coercive).
    STUB — real: Groq Llama 3 API call for multilingual urgency classification.
    """
    if not transcript:
        return 0.0
    lower = transcript.lower()
    hits = sum(1 for kw in COERCION_KEYWORDS if kw.lower() in lower)
    # Simple keyword density as placeholder
    score = min(1.0, hits * 0.2)
    # TODO: replace with Groq API call for semantic coercion classification
    return score


# ─────────────────────────────────────────────────────────────────────────────
# behaviour_analyzer.py stub
# ─────────────────────────────────────────────────────────────────────────────

async def analyze_behaviour(device_behaviour) -> float:
    """
    Returns behaviour_factor: 0.0 (normal) to 1.0 (high duress signals).
    """
    if device_behaviour is None:
        return 0.0
    score = 0.0
    if device_behaviour.app_switch_locked:
        score += 0.5
    if device_behaviour.unusual_typing_cadence:
        score += 0.3
    if device_behaviour.screen_share_duration_seconds > 120:
        score += min(0.2, device_behaviour.screen_share_duration_seconds / 600)
    return min(1.0, score)
