/**
 * GuardPay AI — Typed backend client
 *
 * Product spec §42: "Create a shared frontend type/interface for risk responses.
 * Do not duplicate risk calculation logic in frontend. Frontend displays backend
 * decision."
 *
 * Every network call in the app goes through this module. Screens never build URLs,
 * never parse raw JSON, and never compute a tier — they consume typed results and
 * render whatever the backend decided.
 */

import { apiUrl, API_TIMEOUT_MS } from './config';
import type { RiskTierId } from '../config/riskTiers';

// ── Wire types (mirror backend/schemas/models.py) ─────────────────────────────

export type FactorSeverity = 'normal' | 'unusual' | 'suspicious' | 'critical';
export type RiskDecision = 'ALLOW' | 'WARN' | 'HOLD' | 'BLOCK';
export type RequiredAction = 'NONE' | 'VERIFY_CODE' | 'TRUSTED_CONTACT_VERIFICATION' | 'BLOCKED';

export type PaymentState =
  | 'CREATED' | 'EVALUATING' | 'RISK_DECISION'
  | 'ALLOWED' | 'WARNING' | 'HELD' | 'INTERCEPTED'
  | 'RELEASED' | 'AUTHORIZED' | 'COMPLETED' | 'CANCELLED' | 'FROZEN';

export interface RiskFactorDto {
  name: string;
  score: number;
  severity: FactorSeverity;
  explanation: string;
  /** Optional raw/technical detail, shown only in the collapsible section. */
  technical?: string;
}

export interface RiskEvaluation {
  riskScore: number;
  riskTier: string;                 // backend vocabulary; map with resolveTier()
  decision: RiskDecision;
  requiredAction: RequiredAction;
  factors: RiskFactorDto[];
  transactionId: string;
  timestamp: string;
  evidenceBundleId?: string | null;
  ivrCallInitiated?: boolean;
  mode?: 'model' | 'demo';
  state?: PaymentState;
}

export interface PaymentSession {
  session_id: string;
  state: PaymentState;
  created_at: string;
  receiver_upi_id?: string;
  amount?: number;
  note?: string;
  risk?: RiskEvaluation;
  verification_passed?: boolean;
}

/** Mirrors the backend record exactly — verified against a live response. */
export interface TransactionRecord {
  transaction_id: string;
  session_id: string;
  receiver_upi_id: string;
  sender_upi_id?: string | null;
  beneficiary_name?: string;
  amount: number;
  note?: string | null;
  state: PaymentState;
  /** Terminal outcome: PENDING | COMPLETED | CANCELLED | FROZEN … */
  outcome?: string;
  /** Bucket used by the Activity filter chips: safe | warning | held | blocked */
  category?: ActivityFilter;
  risk_score?: number;
  risk_tier?: string;
  decision?: RiskDecision;
  required_action?: RequiredAction;
  factors?: RiskFactorDto[];
  verification_status?: string;
  evidence_bundle_id?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface TrustedContact {
  contact_id: string;
  name: string;
  phone_number: string;
  relationship?: string;
  is_primary?: boolean;
  created_at?: string;
}

export type DemoScenario = 'SAFE' | 'MEDIUM' | 'HIGH_RISK' | 'CRITICAL';

/** Thrown for any non-2xx response so callers can branch on status (e.g. 403 gate). */
export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const { method = 'GET', body, timeoutMs = API_TIMEOUT_MS } = options;

  // React Native's fetch has no built-in timeout; without this an unreachable
  // backend leaves the security check spinning forever instead of failing closed.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(apiUrl(path), {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    let parsed: any = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) {
      const detail =
        (parsed && (parsed.detail || parsed.message)) || `Request failed (${res.status})`;
      throw new ApiError(res.status, String(detail), parsed);
    }
    return parsed as T;
  } finally {
    clearTimeout(timer);
  }
}

// ── Health ────────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: string;
  version: string;
  services: Record<string, string>;
}

export const getHealth = () => request<HealthResponse>('/health', { timeoutMs: 4000 });

// ── Payment session lifecycle (§37 authorization gate) ────────────────────────

export const createSession = (input: {
  receiver_upi_id: string;
  amount: number;
  note?: string;
  sender_upi_id?: string;
}) => request<PaymentSession>('/api/v1/payment/session', { method: 'POST', body: input });

/**
 * Run the risk evaluation for a session.
 * `demo_scenario` is only honoured when the backend has demo mode enabled; it is
 * rejected with 400 otherwise, so it can never influence a real evaluation.
 */
export const evaluateSession = (sessionId: string, demoScenario?: DemoScenario) =>
  request<RiskEvaluation>(`/api/v1/payment/session/${sessionId}/evaluate`, {
    method: 'POST',
    body: demoScenario ? { demo_scenario: demoScenario } : {},
    timeoutMs: 20000,   // multi-modal evaluation can legitimately take a few seconds
  });

export const getSession = (sessionId: string) =>
  request<PaymentSession>(`/api/v1/payment/session/${sessionId}`);

export const requestVerification = (sessionId: string) =>
  request<{ sent: boolean; channel?: string; code?: string; expires_in?: number; simulated?: boolean }>(
    `/api/v1/payment/session/${sessionId}/request-verification`,
    { method: 'POST', body: {}, timeoutMs: 15000 },
  );

export const verifyCode = (sessionId: string, code: string) =>
  request<{ verified: boolean; state: PaymentState; attempts_remaining: number }>(
    `/api/v1/payment/session/${sessionId}/verify-code`,
    { method: 'POST', body: { code } },
  );

/**
 * Simulated PIN authorization.
 *
 * NOTE: no PIN value is transmitted. The backend gate decides purely from session
 * state, and the spec forbids collecting or storing a real UPI PIN. A 403 here is
 * the gate correctly refusing an unauthorized transition — surface it, never retry.
 */
export const authorizePayment = (sessionId: string, pinLength: number) =>
  request<{ state: PaymentState; transaction_id: string; completed_at?: string }>(
    `/api/v1/payment/session/${sessionId}/authorize`,
    { method: 'POST', body: { pin_length: pinLength, simulated: true } },
  );

export const cancelSession = (sessionId: string) =>
  request<{ state: PaymentState }>(`/api/v1/payment/session/${sessionId}/cancel`, {
    method: 'POST',
    body: {},
  });

// ── History ───────────────────────────────────────────────────────────────────

export type ActivityFilter = 'all' | 'safe' | 'warning' | 'held' | 'blocked';

// NOTE: these two endpoints return BARE ARRAYS, not an envelope object. Verified
// against the running backend — do not "fix" them into `{transactions: [...]}`.
export const listTransactions = (filter: ActivityFilter = 'all') =>
  request<TransactionRecord[]>(`/api/v1/transactions?filter=${filter}`);

export const getTransaction = (txnId: string) =>
  request<TransactionRecord>(`/api/v1/transactions/${txnId}`);

// ── Trusted contacts ──────────────────────────────────────────────────────────

export const listTrustedContacts = () =>
  request<TrustedContact[]>('/api/v1/trusted-contacts');

export const addTrustedContact = (contact: {
  name: string;
  phone_number: string;
  relationship?: string;
  is_primary?: boolean;
}) => request<TrustedContact>('/api/v1/trusted-contacts', { method: 'POST', body: contact });

export const removeTrustedContact = (contactId: string) =>
  request<{ removed?: boolean; contact_id?: string }>(
    `/api/v1/trusted-contacts/${contactId}`,
    { method: 'DELETE' },
  );

// ── Session status (existing endpoint, used by the intercept screen) ──────────

export const getSessionStatus = (txnId: string) =>
  request<{ transaction_id: string; status: string; ivr_outcome?: string; risk_score?: number }>(
    `/api/v1/session/${txnId}/status`,
  );

/** Mask a phone number for display: +919876543210 -> +91 98765 ***10 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\s+/g, '');
  if (digits.length < 6) return digits;
  return `${digits.slice(0, digits.length - 5)}***${digits.slice(-2)}`;
}
