from backend.schemas.models import RiskScoreRequest, RiskScoreResponse, RiskTier
from backend.core.config import settings
from backend.services.risk_fusion import compute_risk
print("IMPORTS OK")
print(f"Thresholds: WARNING={settings.RISK_THRESHOLD_WARNING}, ELEVATED={settings.RISK_THRESHOLD_ELEVATED}, INTERCEPT={settings.RISK_THRESHOLD_INTERCEPT}")
score, factors = compute_risk({"audio":1.0,"text":1.0,"ocr":1.0,"reputation":1.0,"new_beneficiary":1.0,"device_behaviour":1.0})
print(f"Max risk score: {score}")
print(f"Top factor: {factors[0].name} = {factors[0].contribution_points} pts")
print("VERIFICATION CHECKPOINT PASSED - Phase 1 Core Ready")
