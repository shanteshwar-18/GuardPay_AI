/**
 * GuardPay AI — Risk Tier Configuration (SINGLE SOURCE OF TRUTH)
 *
 * Product spec §13: "The thresholds must be configurable from one central place.
 * Do not hardcode thresholds in multiple frontend components."
 * Product spec §45: the risk UI must be data-driven — one reusable decision screen
 * configured per tier, rather than four near-duplicate screens.
 *
 * These thresholds mirror the backend (backend/routers/risk_score.py::_determine_tier
 * and RISK_THRESHOLD_* in .env). The BACKEND remains the source of truth for the
 * decision itself — `tierFromScore` exists only as a fallback for rendering when a
 * response predates the tier field, never to override a tier the backend returned.
 */

import { risk as riskColors } from '../theme';

export type RiskTierId = 'SAFE' | 'WARNING' | 'HOLD' | 'INTERCEPT';

/** Score boundaries — the ONLY place these numbers appear in the frontend. */
export const RISK_THRESHOLDS = {
  warning: 40,    // >= 40  -> WARNING
  hold: 70,       // >= 70  -> HOLD
  intercept: 90,  // >= 90  -> INTERCEPT
} as const;

/**
 * The backend's tier vocabulary differs from the UI's: it emits ELEVATED and
 * HARD_INTERCEPT. Map both spellings so a backend rename cannot silently fall
 * through to SAFE — which would show a PIN pad on an intercepted payment.
 */
const BACKEND_TIER_ALIASES: Record<string, RiskTierId> = {
  SAFE: 'SAFE',
  ALLOWED: 'SAFE',
  WARNING: 'WARNING',
  ELEVATED: 'HOLD',
  HOLD: 'HOLD',
  HARD_INTERCEPT: 'INTERCEPT',
  INTERCEPT: 'INTERCEPT',
  CRITICAL: 'INTERCEPT',
  FROZEN: 'INTERCEPT',
};

export interface RiskTierConfig {
  id: RiskTierId;
  /** i18n keys — never raw copy, so every tier is translatable (§26). */
  titleKey: string;
  descriptionKey: string;
  /** Simplified, louder copy used when Senior Citizen Mode is on (§25). */
  seniorTitleKey: string;
  seniorDescriptionKey: string;
  color: string;
  softColor: string;
  borderColor: string;
  darkColor: string;
  icon: string;
  primaryCtaKey: string;
  secondaryCtaKey: string;
  /** Authorization gate: may the simulated PIN pad be reached from this tier? */
  pinAllowed: boolean;
  /** Does the user have to clear a verification step before PIN becomes reachable? */
  requiresVerification: boolean;
  /** Does clearing it specifically require the trusted-contact/IVR flow? */
  requiresTrustedContact: boolean;
  /** Is an encrypted evidence bundle expected for this tier? */
  preservesEvidence: boolean;
  /** Route to navigate to after the decision screen's primary CTA. */
  primaryRoute: 'Pin' | 'TrustedContact' | 'VerificationCode' | null;
  badgeLabelKey: string;
}

export const RISK_TIERS: Record<RiskTierId, RiskTierConfig> = {
  SAFE: {
    id: 'SAFE',
    titleKey: 'risk.safe.title',
    descriptionKey: 'risk.safe.description',
    seniorTitleKey: 'risk.safe.seniorTitle',
    seniorDescriptionKey: 'risk.safe.seniorDescription',
    color: riskColors.safe.main,
    softColor: riskColors.safe.soft,
    borderColor: riskColors.safe.border,
    darkColor: riskColors.safe.dark,
    icon: '✓',
    primaryCtaKey: 'risk.safe.primaryCta',
    secondaryCtaKey: 'risk.common.cancel',
    pinAllowed: true,
    requiresVerification: false,
    requiresTrustedContact: false,
    preservesEvidence: false,
    primaryRoute: 'Pin',
    badgeLabelKey: 'risk.badge.safe',
  },
  WARNING: {
    id: 'WARNING',
    titleKey: 'risk.warning.title',
    descriptionKey: 'risk.warning.description',
    seniorTitleKey: 'risk.warning.seniorTitle',
    seniorDescriptionKey: 'risk.warning.seniorDescription',
    color: riskColors.warning.main,
    softColor: riskColors.warning.soft,
    borderColor: riskColors.warning.border,
    darkColor: riskColors.warning.dark,
    icon: '!',
    primaryCtaKey: 'risk.warning.primaryCta',
    secondaryCtaKey: 'risk.common.cancel',
    // PIN only after the verification step clears (§45).
    pinAllowed: false,
    requiresVerification: true,
    requiresTrustedContact: false,
    preservesEvidence: true,
    primaryRoute: 'VerificationCode',
    badgeLabelKey: 'risk.badge.warning',
  },
  HOLD: {
    id: 'HOLD',
    titleKey: 'risk.hold.title',
    descriptionKey: 'risk.hold.description',
    seniorTitleKey: 'risk.hold.seniorTitle',
    seniorDescriptionKey: 'risk.hold.seniorDescription',
    color: riskColors.hold.main,
    softColor: riskColors.hold.soft,
    borderColor: riskColors.hold.border,
    darkColor: riskColors.hold.dark,
    icon: '⏱',
    primaryCtaKey: 'risk.hold.primaryCta',
    secondaryCtaKey: 'risk.common.cancel',
    pinAllowed: false,
    requiresVerification: true,
    requiresTrustedContact: true,
    preservesEvidence: true,
    primaryRoute: 'TrustedContact',
    badgeLabelKey: 'risk.badge.hold',
  },
  INTERCEPT: {
    id: 'INTERCEPT',
    titleKey: 'risk.intercept.title',
    descriptionKey: 'risk.intercept.description',
    seniorTitleKey: 'risk.intercept.seniorTitle',
    seniorDescriptionKey: 'risk.intercept.seniorDescription',
    color: riskColors.intercept.main,
    softColor: riskColors.intercept.soft,
    borderColor: riskColors.intercept.border,
    darkColor: riskColors.intercept.dark,
    icon: '🔒',
    primaryCtaKey: 'risk.intercept.primaryCta',
    secondaryCtaKey: 'risk.common.cancel',
    // Hard rule (§17, §53): the PIN pad must NEVER be reachable after INTERCEPT.
    pinAllowed: false,
    requiresVerification: true,
    requiresTrustedContact: true,
    preservesEvidence: true,
    primaryRoute: 'TrustedContact',
    badgeLabelKey: 'risk.badge.intercept',
  },
};

/** Fallback only — prefer the tier the backend returned. */
export function tierFromScore(score: number): RiskTierId {
  if (score >= RISK_THRESHOLDS.intercept) return 'INTERCEPT';
  if (score >= RISK_THRESHOLDS.hold) return 'HOLD';
  if (score >= RISK_THRESHOLDS.warning) return 'WARNING';
  return 'SAFE';
}

/**
 * Resolve the tier to render.
 *
 * Trusts the backend's tier string when recognised. An UNRECOGNISED tier is
 * deliberately NOT treated as SAFE — it escalates via the score instead, because
 * failing open here would surface a PIN pad on a payment the engine may have
 * blocked.
 */
export function resolveTier(backendTier: string | undefined | null, score: number): RiskTierId {
  if (backendTier) {
    const mapped = BACKEND_TIER_ALIASES[String(backendTier).toUpperCase().trim()];
    if (mapped) return mapped;
    if (__DEV__) {
      console.warn(`[riskTiers] unknown backend tier "${backendTier}" — falling back to score ${score}`);
    }
  }
  return tierFromScore(score);
}

export function getTierConfig(tier: RiskTierId): RiskTierConfig {
  return RISK_TIERS[tier];
}

/** Colour for a raw score, used by gauges and history badges. */
export function colorForScore(score: number): string {
  return RISK_TIERS[tierFromScore(score)].color;
}

/**
 * Central authorization guard for the client.
 *
 * The backend gate is authoritative (§37); this mirrors it so the UI cannot even
 * offer a route the backend would reject.
 */
export function isPinReachable(tier: RiskTierId, verificationPassed: boolean): boolean {
  const cfg = RISK_TIERS[tier];
  if (cfg.pinAllowed) return true;
  if (tier === 'INTERCEPT') return false;   // never, under any condition
  return cfg.requiresVerification && verificationPassed;
}
