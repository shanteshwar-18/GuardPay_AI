/**
 * GuardPay AI — Navigation Types
 *
 * The full route-param contract for the 14 user-side screens (product spec §3, §51).
 * Every screen that reads `route.params` must conform to these shapes.
 *
 * The payment flow is session-driven: once a protected session is created, screens
 * carry `sessionId` and re-read authoritative state from the backend rather than
 * passing a growing bag of fields between routes. The denormalised `amount` /
 * `beneficiary` fields exist only so a screen can render immediately without a
 * round-trip — they are display data, never the basis for a security decision.
 */

import type { RiskTierId } from '../config/riskTiers';
import type { RiskFactorDto, TransactionRecord } from '../services/api';

export type Beneficiary = {
  upiId: string;
  name: string;
  isNewBeneficiary: boolean;
};

/** Legacy shape still used by the original RiskFactorList component. */
export type RiskFactor = {
  factor: string;
  points: number;
};

/** Backend tier vocabulary. Use `resolveTier()` to map onto RiskTierId for the UI. */
export type RiskTier = 'ALLOWED' | 'WARNING' | 'ADAPTIVE_HOLD' | 'HARD_INTERCEPT';

/** Shared payload for every screen in an active protected payment session. */
export type SessionContext = {
  sessionId: string;
  transactionId?: string;
  beneficiary: Beneficiary;
  amount: number;
  note?: string;
};

export type RootStackParamList = {
  // ── Entry flow ──────────────────────────────────────────────────────────────
  Splash: undefined;
  Onboarding: undefined;
  Permissions: { fromSettings?: boolean } | undefined;

  // ── Main tabs ───────────────────────────────────────────────────────────────
  Home: undefined;
  Activity: { initialFilter?: 'all' | 'safe' | 'warning' | 'held' | 'blocked' } | undefined;
  TransactionDetail: { transactionId: string; record?: TransactionRecord };
  Settings: undefined;
  TrustedContacts: undefined;

  // ── Payment flow ────────────────────────────────────────────────────────────
  Payment: { prefillUpiId?: string } | undefined;

  /** Protected security session: creates the session and runs risk evaluation. */
  RiskEval: SessionContext & { demoScenario?: 'SAFE' | 'MEDIUM' | 'HIGH_RISK' | 'CRITICAL' };

  /**
   * ONE data-driven decision screen for all four tiers (spec §45), replacing the
   * former separate Warning / Hold / Intercept screens. Behaviour — including
   * whether the PIN pad is reachable — comes from config/riskTiers.ts.
   */
  RiskDecision: SessionContext & {
    tier: RiskTierId;
    riskScore: number;
    factors: RiskFactorDto[];
    requiredAction?: string;
    evidenceBundleId?: string | null;
    mode?: 'model' | 'demo';
  };

  /** Trusted-contact IVR verification (HOLD / INTERCEPT). */
  TrustedContact: SessionContext & { tier: RiskTierId; riskScore: number };

  /** 4-digit code step. `origin` decides where a success returns to. */
  VerificationCode: SessionContext & {
    tier: RiskTierId;
    riskScore: number;
    origin?: 'trustedContact' | 'warning';
  };

  /** Simulated UPI PIN. Reachable ONLY when the gate allows it (spec §21, §37). */
  Pin: SessionContext & { tier: RiskTierId; riskScore: number; verified?: boolean };

  PaymentSuccess: {
    transactionId: string;
    amount: number;
    beneficiary: Beneficiary;
    completedAt?: string;
  };

  // ── Legacy routes (kept so older deep links / tests keep resolving) ─────────
  Beneficiary: undefined;
  Amount: { beneficiary: Beneficiary };
  Warning: SessionContext & { riskScore: number; tier: RiskTier; explanation: RiskFactor[] };
  Hold: SessionContext & { riskScore: number; tier: RiskTier; explanation: RiskFactor[] };
  Intercept: SessionContext & { riskScore: number; tier: RiskTier; explanation: RiskFactor[] };

  // Dev-only: Screenshot harness — absent in production builds
  ScreenshotHarness: undefined;
};
