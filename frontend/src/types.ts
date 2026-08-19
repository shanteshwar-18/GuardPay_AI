/**
 * GuardPay AI — Shared Type Definitions
 *
 * Central type definitions imported by all screens.
 * RiskScoreResponse matches Shanteshwar's backend Pydantic schema.
 */

/** Risk tier identifiers returned by the backend */
export type RiskTier = 'ALLOWED' | 'WARNING' | 'ADAPTIVE_HOLD' | 'HARD_INTERCEPT';

/**
 * Response from POST /api/v1/risk-score
 *
 * This is the single most important shared type in the frontend —
 * every outcome screen receives it as a navigation route param.
 */
export interface RiskScoreResponse {
  /** Computed risk score, 0–100 */
  score: number;
  /** Risk tier classification */
  tier: RiskTier;
  /** Human-readable SHAP explanation strings (e.g. "Voice anomaly detected: +25 pts") */
  explanation: string[];
  /** Raw factor scores keyed by factor name, values 0–1 */
  factors: Record<string, number>;
  /** Evidence bundle ID (present when risk > 70) */
  evidence_bundle_id?: string;
}

/** Session status for InterceptScreen polling */
export type SessionStatus = 'CALLING' | 'AWAITING_RESPONSE' | 'FROZEN';

/** Navigation param list for the app's stack navigator */
export type RootStackParamList = {
  Home: undefined;
  Beneficiary: undefined;
  Amount: undefined;
  RiskEval: undefined;
  PIN: { riskResponse: RiskScoreResponse };
  Warning: { riskResponse: RiskScoreResponse };
  Hold: { riskResponse: RiskScoreResponse };
  Intercept: { riskResponse: RiskScoreResponse };
  Settings: undefined;
  Success: undefined;
};
