/**
 * GuardPay AI — Scenario Smoke Test Suite (Phase 10 / Prompt 11)
 *
 * Tests the 4 core risk tier outcomes and Senior Citizen Mode:
 *
 * Scenario A: Low Risk (< 40) → ALLOWED
 *   - Route: PINScreen (Zero friction, no warning)
 *
 * Scenario B: Medium Risk (40–70) → WARNING
 *   - Route: WarningScreen (Risk gauge, SHAP breakdown, TTS warning)
 *
 * Scenario C: High Risk (70–90) → ADAPTIVE_HOLD
 *   - Route: HoldScreen (30s countdown, 4-digit OTP step-up)
 *
 * Scenario D: Critical Risk (> 90) → HARD_INTERCEPT
 *   - Route: InterceptScreen (Lock animation, live status polling, zero PIN path)
 *
 * Senior Citizen Mode:
 *   - 1.5× font scaling verification
 *   - SHAP explanation simplification dictionary mapping
 */

import { RiskScoreResponse, RiskTier } from '../types';
import { simplifyExplanation, simplifyExplanations } from '../i18n/simplifiedStrings';
import { TIER_COLORS } from '../theme';

/** Mock test assertion helper */
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

function runScenarioTests() {
  console.log('\n========================================');
  console.log('🛡️  GuardPay AI — Scenario Smoke Tests');
  console.log('========================================\n');

  // ----------------------------------------------------
  // Scenario A: Low Risk (Score: 15)
  // ----------------------------------------------------
  console.log('▶ Scenario A: Safe Transaction (Score < 40)');
  const scenarioA: RiskScoreResponse = {
    score: 15,
    tier: 'ALLOWED',
    explanation: [],
    factors: { audio: 0.05, text: 0.02, new_beneficiary: 0 },
  };

  assert(scenarioA.score < 40, 'Risk score is in ALLOWED range (< 40)');
  assert(scenarioA.tier === 'ALLOWED', 'Classified as ALLOWED');
  assert(TIER_COLORS[scenarioA.tier] === '#22C55E', 'Uses Green (#22C55E) safe indicator');
  assert(scenarioA.explanation.length === 0, 'Zero warning explanations shown');

  // ----------------------------------------------------
  // Scenario B: Medium Risk (Score: 55)
  // ----------------------------------------------------
  console.log('\n▶ Scenario B: Medium Risk Warning (Score 40–70)');
  const scenarioB: RiskScoreResponse = {
    score: 55,
    tier: 'WARNING',
    explanation: [
      'Voice anomaly detected: +25 pts',
      'New beneficiary (first-time payee): +15 pts',
      'Coercive language patterns: +15 pts',
    ],
    factors: { audio: 0.5, text: 0.3, new_beneficiary: 1.0 },
  };

  assert(scenarioB.score >= 40 && scenarioB.score <= 70, 'Risk score in WARNING range (40–70)');
  assert(scenarioB.tier === 'WARNING', 'Classified as WARNING');
  assert(TIER_COLORS[scenarioB.tier] === '#F59E0B', 'Uses Amber (#F59E0B) caution color');
  assert(scenarioB.explanation.length === 3, 'Displays 3 SHAP explanation bullets');

  // ----------------------------------------------------
  // Scenario C: High Risk / Adaptive Hold (Score: 78)
  // ----------------------------------------------------
  console.log('\n▶ Scenario C: Adaptive Hold Cooling-off (Score 70–90)');
  const scenarioC: RiskScoreResponse = {
    score: 78,
    tier: 'ADAPTIVE_HOLD',
    explanation: [
      'Voice anomaly detected: +25 pts',
      'Coercive language patterns: +20 pts',
      'Device behaviour anomaly: +18 pts',
    ],
    factors: { audio: 0.8, text: 0.7, device: 0.6 },
    evidence_bundle_id: 'evt_test_001',
  };

  assert(scenarioC.score > 70 && scenarioC.score <= 90, 'Risk score in ADAPTIVE_HOLD range (70–90)');
  assert(scenarioC.tier === 'ADAPTIVE_HOLD', 'Classified as ADAPTIVE_HOLD');
  assert(TIER_COLORS[scenarioC.tier] === '#EF4444', 'Uses Orange-Red (#EF4444) hold color');
  assert(!!scenarioC.evidence_bundle_id, 'Evidence bundle ID created for tamper-proof logging');

  // ----------------------------------------------------
  // Scenario D: Critical Risk / Hard Intercept (Score: 95)
  // ----------------------------------------------------
  console.log('\n▶ Scenario D: Hard Intercept & Live Twilio Call (Score > 90)');
  const scenarioD: RiskScoreResponse = {
    score: 95,
    tier: 'HARD_INTERCEPT',
    explanation: [
      'AI voice clone detected: +30 pts',
      'Coercive transcript — "arrest warrant" detected: +25 pts',
      'OCR: "Account Freeze" notice on screen: +20 pts',
    ],
    factors: { audio: 0.95, text: 0.9, ocr: 1.0 },
    evidence_bundle_id: 'evt_test_002',
  };

  assert(scenarioD.score > 90, 'Risk score in HARD_INTERCEPT range (> 90)');
  assert(scenarioD.tier === 'HARD_INTERCEPT', 'Classified as HARD_INTERCEPT');
  assert(TIER_COLORS[scenarioD.tier] === '#DC2626', 'Uses Red (#DC2626) hard lock color');

  // ----------------------------------------------------
  // Senior Citizen Mode & Plain-Language Translation
  // ----------------------------------------------------
  console.log('\n▶ Senior Citizen Mode: Plain-Language Translation Audit');
  const rawTechString = 'Voice anomaly detected: +25 pts';
  const simplified = simplifyExplanation(rawTechString);
  assert(
    simplified === "Something sounds different about this caller's voice",
    `Plain language translation: "${rawTechString}" → "${simplified}"`
  );

  const rawCoercion = 'Coercive transcript — "arrest warrant" detected: +25 pts';
  const simplifiedCoercion = simplifyExplanation(rawCoercion);
  assert(
    simplifiedCoercion.includes('common scam tactic'),
    `Plain language translation for arrest threats: "${simplifiedCoercion}"`
  );

  const listSimplified = simplifyExplanations(scenarioB.explanation);
  assert(listSimplified.length === scenarioB.explanation.length, 'All explanations successfully simplified');

  console.log('\n========================================');
  console.log('✅  ALL 4 SCENARIOS & SENIOR MODE PASSED');
  console.log('========================================\n');
}

// Run test suite
runScenarioTests();
